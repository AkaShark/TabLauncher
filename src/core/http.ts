/**
 * HTTP wrapper for TickTick (and similar bearer-auth) calls.
 *
 * Responsibilities:
 *   - 8s AbortController timeout
 *   - Auto-injects Authorization: Bearer <access_token>
 *   - On 401: refresh token (deduped) + retry once
 *   - On 5xx: exponential backoff up to 2 retries
 *   - Marks needsReconnect when refresh fails
 */

import {
  getTokens,
  isExpired,
  setRefreshLock,
  getRefreshLock,
  type TokenSet,
} from './tokenStore';
import { refresh } from './oauth';

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_5XX_RETRIES = 2;

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

let needsReconnect = false;

export function getNeedsReconnect(): boolean {
  return needsReconnect;
}

export function clearNeedsReconnect(): void {
  needsReconnect = false;
}

async function ensureFreshToken(): Promise<TokenSet | null> {
  const t = await getTokens();
  if (!t) return null;
  if (!isExpired(t)) return t;
  return refreshDeduped(t.refreshToken);
}

async function refreshDeduped(refreshToken: string | null): Promise<TokenSet | null> {
  if (!refreshToken) return null;
  const inFlight = getRefreshLock();
  if (inFlight) return inFlight;
  const p = refresh(refreshToken)
    .catch(() => null)
    .finally(() => setRefreshLock(null));
  setRefreshLock(p);
  return p;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface HttpRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

async function fetchOnce(
  req: HttpRequest,
  token: string | null,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(req.headers ?? {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return await fetch(req.url, {
      method: req.method ?? 'GET',
      headers,
      body: req.body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Authenticated request with refresh-on-401 and 5xx exponential backoff.
 * Throws HttpError on non-2xx terminal failure or AbortError on timeout.
 */
export async function authedFetch<T = unknown>(req: HttpRequest): Promise<T> {
  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let token = (await ensureFreshToken())?.accessToken ?? null;
  if (!token) {
    needsReconnect = true;
    throw new HttpError('not connected', 401, 'no-token');
  }

  let attempt = 0;
  let did401Retry = false;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let res: Response;
    try {
      res = await fetchOnce(req, token, timeoutMs);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new HttpError('request timeout', 0, 'timeout');
      }
      throw new HttpError(`network error: ${(e as Error).message}`, 0, 'network');
    }

    if (res.status === 401 && !did401Retry) {
      did401Retry = true;
      const stored = await getTokens();
      const refreshed = await refreshDeduped(stored?.refreshToken ?? null);
      if (!refreshed) {
        needsReconnect = true;
        throw new HttpError('unauthorized', 401, 'token-expired');
      }
      token = refreshed.accessToken;
      continue;
    }

    if (res.status >= 500 && attempt < MAX_5XX_RETRIES) {
      attempt++;
      await sleep(200 * 2 ** (attempt - 1));
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new HttpError(
        `http ${res.status}: ${text.slice(0, 200)}`,
        res.status,
        `http-${res.status}`,
      );
    }

    if (res.status === 204) return undefined as T;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) return (await res.json()) as T;
    return (await res.text()) as unknown as T;
  }
}
