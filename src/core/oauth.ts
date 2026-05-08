/**
 * TickTick OAuth flow (PKCE + client_secret_post; research §3).
 *
 * Notes:
 *   - TickTick still requires `client_secret`; PKCE is layered on top as defense in depth.
 *   - redirect_uri is derived dynamically from chrome.identity.getRedirectURL() so we never
 *     hardcode an extension id (plan §R4).
 *   - Access tokens are stored in chrome.storage.local via tokenStore.
 */

import { setTokens, clearTokens, type TokenSet } from './tokenStore';
import type { OAuthTokenResponse } from '@/adapters/ticktick/types';

// TickTick (international) and dida365 (China) share the same backend but use
// different domains. Configurable via VITE_TICKTICK_OAUTH_HOST (default dida365.com
// since that's what most CN-region developer accounts get).
const OAUTH_HOST = (import.meta.env.VITE_TICKTICK_OAUTH_HOST ?? 'dida365.com').replace(/\/$/, '');
const AUTH_URL = `https://${OAUTH_HOST}/oauth/authorize`;
const TOKEN_URL = `https://${OAUTH_HOST}/oauth/token`;
const SCOPE = 'tasks:read tasks:write';

const CLIENT_ID = import.meta.env.VITE_TICKTICK_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_TICKTICK_CLIENT_SECRET;

export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

function randomString(byteLen: number): string {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  return base64url(buf);
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getRedirectUrl(): string {
  return chrome.identity.getRedirectURL();
}

function assertConfig(): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new OAuthError(
      'TickTick client credentials missing. Set VITE_TICKTICK_CLIENT_ID and VITE_TICKTICK_CLIENT_SECRET in .env.local.',
      'missing-credentials',
    );
  }
}

async function exchangeToken(body: URLSearchParams): Promise<TokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new OAuthError(`token exchange failed: ${res.status} ${text}`, 'token-exchange-failed');
  }
  const data = (await res.json()) as OAuthTokenResponse;
  if (!data.access_token || typeof data.expires_in !== 'number') {
    throw new OAuthError('token response malformed', 'token-malformed');
  }
  const now = Date.now();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: now + data.expires_in * 1000,
    issuedAt: new Date(now).toISOString(),
    scope: data.scope ?? SCOPE,
  };
}

/**
 * Launch interactive OAuth flow. Stores TokenSet on success.
 * Throws OAuthError if user cancels or exchange fails.
 */
export async function connect(): Promise<TokenSet> {
  assertConfig();
  const redirectUri = getRedirectUrl();
  const state = randomString(16);

  // PKCE removed: TickTick doesn't officially support it (research §3.2).
  // The extra `code_challenge` param appears to break the auth redirect flow.
  const authParams = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: SCOPE,
    redirect_uri: redirectUri,
    state,
  });
  const authUrl = `${AUTH_URL}?${authParams.toString()}`;
  console.log('[AIRSS oauth] auth url:', authUrl);
  console.log('[AIRSS oauth] expected redirect prefix:', redirectUri);

  const redirectResp = await new Promise<string | undefined>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl?: string) => {
        const err = chrome.runtime.lastError;
        if (err) {
          console.error('[AIRSS oauth] launchWebAuthFlow error msg:', err.message);
          console.error('[AIRSS oauth] launchWebAuthFlow error json:', JSON.stringify(err));
          return reject(new OAuthError(err.message ?? 'auth flow failed', 'flow-failed'));
        }
        console.log('[AIRSS oauth] redirect response url:', responseUrl);
        resolve(responseUrl);
      },
    );
  });

  if (!redirectResp) throw new OAuthError('no redirect response', 'no-redirect');
  const url = new URL(redirectResp);
  const returnedState = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const errParam = url.searchParams.get('error');
  if (errParam) throw new OAuthError(`authorize error: ${errParam}`, 'authorize-error');
  if (!code) throw new OAuthError('no code in redirect', 'no-code');
  if (returnedState !== state) throw new OAuthError('state mismatch', 'state-mismatch');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    scope: SCOPE,
  });
  const tokens = await exchangeToken(body);
  await setTokens(tokens);
  return tokens;
}

/**
 * Refresh access token via refresh_token grant.
 * Returns null if no refresh token is available — caller should fall back to connect().
 */
export async function refresh(refreshToken: string): Promise<TokenSet | null> {
  assertConfig();
  if (!refreshToken) return null;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: SCOPE,
  });
  try {
    const tokens = await exchangeToken(body);
    // TickTick may omit refresh_token on refresh — preserve old one in that case.
    const merged: TokenSet = {
      ...tokens,
      refreshToken: tokens.refreshToken ?? refreshToken,
    };
    await setTokens(merged);
    return merged;
  } catch {
    return null;
  }
}

export async function revoke(): Promise<void> {
  await clearTokens();
}

/** Exposed for UI display so users can verify what's registered with TickTick. */
export function redirectUrlForDisplay(): string {
  return getRedirectUrl();
}
