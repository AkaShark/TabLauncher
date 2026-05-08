/**
 * Thin wrapper around chrome.storage.local for cache entries.
 * Key prefix: `airss.cache.` — keeps cache values namespaced from auth/state.
 */

const PREFIX = 'airss.cache.';

export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

function k(key: string): string {
  return `${PREFIX}${key}`;
}

export async function getCached<T>(key: string): Promise<CacheEntry<T> | null> {
  const storageKey = k(key);
  const result = await chrome.storage.local.get(storageKey);
  const raw = result[storageKey];
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.fetchedAt !== 'number') return null;
  return { value: obj.value as T, fetchedAt: obj.fetchedAt };
}

export async function setCached<T>(key: string, value: T): Promise<void> {
  const entry: CacheEntry<T> = { value, fetchedAt: Date.now() };
  await chrome.storage.local.set({ [k(key)]: entry });
}

export async function clearCached(key: string): Promise<void> {
  await chrome.storage.local.remove(k(key));
}
