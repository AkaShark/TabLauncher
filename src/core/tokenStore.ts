/**
 * Token storage for TickTick OAuth tokens.
 * Persisted under `airss.tokens` in chrome.storage.local.
 *
 * Concurrent refresh dedup: when multiple in-flight 401 fetchers each try to
 * refresh, we share a single Promise via `getRefreshLock` / `setRefreshLock`.
 */

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  /** epoch ms */
  expiresAt: number;
  /** ISO timestamp when issued — for display in settings */
  issuedAt: string;
  scope: string;
}

const STORAGE_KEY = 'airss.tokens';

export async function getTokens(): Promise<TokenSet | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.accessToken !== 'string' || typeof obj.expiresAt !== 'number') return null;
  return {
    accessToken: obj.accessToken,
    refreshToken: typeof obj.refreshToken === 'string' ? obj.refreshToken : null,
    expiresAt: obj.expiresAt,
    issuedAt: typeof obj.issuedAt === 'string' ? obj.issuedAt : '',
    scope: typeof obj.scope === 'string' ? obj.scope : '',
  };
}

export async function setTokens(tokens: TokenSet): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: tokens });
}

export async function clearTokens(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export function isExpired(tokens: TokenSet, skewMs: number = 30_000): boolean {
  return Date.now() + skewMs >= tokens.expiresAt;
}

// In-memory refresh lock — service worker context lives across requests.
let refreshInFlight: Promise<TokenSet | null> | null = null;

export function getRefreshLock(): Promise<TokenSet | null> | null {
  return refreshInFlight;
}

export function setRefreshLock(p: Promise<TokenSet | null> | null): void {
  refreshInFlight = p;
}
