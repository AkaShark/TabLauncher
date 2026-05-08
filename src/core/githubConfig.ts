/**
 * Persisted GitHub Trending widget config — period, language, limit, enabled.
 * Stored under `airss.github.config` in chrome.storage.local. Values fall back
 * to DEFAULT_GITHUB_CONFIG when missing or malformed.
 */

import { DEFAULT_GITHUB_CONFIG, type GithubConfig, type GithubPeriod } from '@/adapters/github/types';

const STORAGE_KEY = 'airss.github.config';

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

function isPeriod(v: unknown): v is GithubPeriod {
  return v === 'day' || v === 'week' || v === 'month';
}

function sanitize(raw: unknown): GithubConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_GITHUB_CONFIG };
  const r = raw as Partial<GithubConfig>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_GITHUB_CONFIG.enabled,
    period: isPeriod(r.period) ? r.period : DEFAULT_GITHUB_CONFIG.period,
    lang: typeof r.lang === 'string' ? r.lang : DEFAULT_GITHUB_CONFIG.lang,
    limit:
      typeof r.limit === 'number' && Number.isFinite(r.limit) && r.limit > 0
        ? Math.floor(r.limit)
        : DEFAULT_GITHUB_CONFIG.limit,
  };
}

export async function getConfig(): Promise<GithubConfig> {
  const local = getStorageLocal();
  if (!local) return { ...DEFAULT_GITHUB_CONFIG };
  const out = await local.get(STORAGE_KEY);
  return sanitize(out[STORAGE_KEY]);
}

export async function setConfig(patch: Partial<GithubConfig>): Promise<GithubConfig> {
  const cur = await getConfig();
  const next = sanitize({ ...cur, ...patch });
  const local = getStorageLocal();
  if (local) {
    await local.set({ [STORAGE_KEY]: next });
  }
  return next;
}

export async function clearConfig(): Promise<void> {
  const local = getStorageLocal();
  if (!local) return;
  await local.remove(STORAGE_KEY);
}

export const __GITHUB_CONFIG_STORAGE_KEY = STORAGE_KEY;
