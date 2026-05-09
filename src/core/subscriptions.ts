/**
 * Subscription source storage.
 *
 * Persists FeedSourceConfig[] under chrome.storage.local key `airss.subscriptions`.
 * No fetch logic here — this module is the pure CRUD layer.
 */

import type { FeedSourceConfig, FeedSourceType, JuejinCateMeta } from '@/adapters/feed/types';

export const STORAGE_KEY = 'airss.subscriptions';

function newId(): string {
  // crypto.randomUUID is available in MV3 SW + happy-dom + modern browsers.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback (tests on older runtimes).
  const a = Math.random().toString(16).slice(2, 10);
  const b = Math.random().toString(16).slice(2, 10);
  return `${a}-${b}`;
}

export async function getAll(): Promise<FeedSourceConfig[]> {
  const out = await chrome.storage.local.get(STORAGE_KEY);
  const raw = out[STORAGE_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is FeedSourceConfig => {
    return (
      !!x &&
      typeof x === 'object' &&
      typeof (x as FeedSourceConfig).id === 'string' &&
      typeof (x as FeedSourceConfig).url === 'string' &&
      typeof (x as FeedSourceConfig).label === 'string'
    );
  });
}

async function writeAll(list: FeedSourceConfig[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: list });
}

export interface AddInput {
  type: FeedSourceType;
  url: string;
  label: string;
  meta?: JuejinCateMeta;
  /** When false, the source is added in the disabled state. Defaults to true. */
  enabled?: boolean;
}

/**
 * Add a new source. Returns existing config if URL already registered.
 */
export async function add(input: AddInput): Promise<FeedSourceConfig> {
  const list = await getAll();
  const existing = list.find((s) => s.url === input.url);
  if (existing) return existing;
  const cfg: FeedSourceConfig = {
    id: newId(),
    type: input.type,
    url: input.url,
    label: input.label || input.url,
    addedAt: Date.now(),
    enabled: input.enabled ?? true,
    ...(input.meta !== undefined ? { meta: input.meta } : {}),
  };
  list.push(cfg);
  await writeAll(list);
  return cfg;
}

export async function remove(id: string): Promise<void> {
  const list = await getAll();
  const next = list.filter((s) => s.id !== id);
  await writeAll(next);
}

export async function toggle(id: string): Promise<FeedSourceConfig | null> {
  const list = await getAll();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const item = list[idx]!;
  const updated: FeedSourceConfig = { ...item, enabled: !item.enabled };
  list[idx] = updated;
  await writeAll(list);
  return updated;
}

export async function update(
  id: string,
  patch: Partial<Pick<FeedSourceConfig, 'label' | 'enabled'>>,
): Promise<FeedSourceConfig | null> {
  const list = await getAll();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const item = list[idx]!;
  const updated: FeedSourceConfig = { ...item, ...patch };
  list[idx] = updated;
  await writeAll(list);
  return updated;
}
