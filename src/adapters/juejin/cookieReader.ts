/**
 * Read juejin.cn cookies via chrome.cookies API.
 *
 * Used only by the all-feed (`recommend_all_feed`) path: when a session
 * cookie is present we set credentials:'include' to get a personalized stream.
 *
 * The cate-feed path no longer uses this — it relies on manually pasted curl
 * credentials (uuid + x-secsdk-csrf-token) persisted by src/core/juejinCreds.ts.
 *
 * The function never throws: on any failure (no permission, API missing, etc.)
 * we degrade to `connected: false`.
 */

interface ChromeCookieLike {
  name: string;
  value?: string;
  expirationDate?: number;
}

export interface JuejinCookieStatus {
  connected: boolean;
  details?: {
    sessionidPresent: boolean;
    /** ms epoch when sessionid expires, if known. */
    expiresAt?: number;
  };
  /** anonymous or page-derived uuid for legacy callers; cate_feed no longer
   * relies on this since the tab proxy handles uuid attachment in-page. */
  uuid?: string;
}

const ANON_UUID_KEY = 'airss.juejin.anonUuid';

/** Generates a 19-digit snowflake-like number (string). */
function makeSnowflake(): string {
  // 13-digit ms timestamp + 6-digit random = 19 digits, fits in juejin's expected shape.
  const ts = Date.now().toString();
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return ts + rand;
}

async function getOrCreateAnonUuid(): Promise<string> {
  try {
    const storage = (chrome as unknown as { storage?: { local: { get: (k: string) => Promise<Record<string, unknown>>; set: (v: Record<string, unknown>) => Promise<void> } } }).storage;
    if (!storage?.local) return makeSnowflake();
    const got = await storage.local.get(ANON_UUID_KEY);
    const existing = got[ANON_UUID_KEY];
    if (typeof existing === 'string' && existing.length > 0) return existing;
    const fresh = makeSnowflake();
    await storage.local.set({ [ANON_UUID_KEY]: fresh });
    return fresh;
  } catch {
    return makeSnowflake();
  }
}

export async function readJuejinCookies(): Promise<JuejinCookieStatus> {
  try {
    const cookiesApi = (chrome as unknown as { cookies?: { getAll: (q: { domain: string }) => Promise<ChromeCookieLike[]> } }).cookies;
    if (!cookiesApi || typeof cookiesApi.getAll !== 'function') {
      return { connected: false };
    }
    const list = await cookiesApi.getAll({ domain: 'juejin.cn' });
    if (!Array.isArray(list)) {
      return { connected: false };
    }

    // ByteDance auth cookie names vary across versions. Order = preference.
    const AUTH_NAMES = [
      'sessionid_ss',
      'sid_ucp_v1',
      'uid_tt_ss',
      'sessionid',
      'passport_session',
      'sid_tt',
      'sid_guard',
    ];
    const found = list.find((c) => AUTH_NAMES.includes(c.name) && c.value);
    if (!found) {
      const uuid = await getOrCreateAnonUuid();
      return { connected: false, details: { sessionidPresent: false }, uuid };
    }
    const details: { sessionidPresent: boolean; expiresAt?: number } = {
      sessionidPresent: true,
    };
    if (typeof found.expirationDate === 'number') {
      details.expiresAt = Math.round(found.expirationDate * 1000);
    }
    const uuid = await getOrCreateAnonUuid();
    return { connected: true, details, uuid };
  } catch {
    return { connected: false };
  }
}
