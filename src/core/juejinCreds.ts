/**
 * Persisted juejin.cn credentials (uuid + x-secsdk-csrf-token) used by the
 * cate_feed path. Source of truth: the user pastes a curl from a logged-in
 * juejin.cn DevTools Network panel; we parse it via `parseJuejinCurl` and
 * persist the extracted pair under `airss.juejin.creds` in chrome.storage.local.
 *
 * Tokens typically expire within a few hours; the UI surfaces `capturedAt`
 * so the user can re-paste when stale.
 */
const STORAGE_KEY = 'airss.juejin.creds';

export interface JuejinCreds {
  uuid: string;
  csrfToken: string;
  /** ms epoch when the curl was pasted. */
  capturedAt: number;
}

interface StorageLocalLike {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

function getStorageLocal(): StorageLocalLike | null {
  const c = (globalThis as unknown as { chrome?: { storage?: { local?: StorageLocalLike } } })
    .chrome;
  return c?.storage?.local ?? null;
}

export async function getCreds(): Promise<JuejinCreds | null> {
  const local = getStorageLocal();
  if (!local) return null;
  const out = await local.get(STORAGE_KEY);
  const raw = out[STORAGE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<JuejinCreds>;
  if (
    typeof r.uuid === 'string' &&
    r.uuid.length > 0 &&
    typeof r.csrfToken === 'string' &&
    r.csrfToken.length > 0 &&
    typeof r.capturedAt === 'number'
  ) {
    return { uuid: r.uuid, csrfToken: r.csrfToken, capturedAt: r.capturedAt };
  }
  return null;
}

export async function setCreds(uuid: string, csrfToken: string): Promise<void> {
  const local = getStorageLocal();
  if (!local) return;
  const value: JuejinCreds = { uuid, csrfToken, capturedAt: Date.now() };
  await local.set({ [STORAGE_KEY]: value });
}

export async function clearCreds(): Promise<void> {
  const local = getStorageLocal();
  if (!local) return;
  await local.remove(STORAGE_KEY);
}

export const __JUEJIN_CREDS_STORAGE_KEY = STORAGE_KEY;
