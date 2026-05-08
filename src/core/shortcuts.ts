/**
 * Persisted user-defined shortcuts (quick-link tiles above the task panel).
 * Stored as an array under `airss.shortcuts` in chrome.storage.local.
 */

export interface Shortcut {
  id: string;
  label: string;
  url: string;
  addedAt: number;
}

const STORAGE_KEY = 'airss.shortcuts';

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

function makeId(): string {
  return 'sc-' + Math.random().toString(36).slice(2, 10);
}

function sanitize(raw: unknown): Shortcut[] {
  if (!Array.isArray(raw)) return [];
  const out: Shortcut[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Partial<Shortcut>;
    if (typeof r.url !== 'string' || !r.url) continue;
    if (typeof r.label !== 'string') continue;
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : makeId(),
      label: r.label,
      url: r.url,
      addedAt: typeof r.addedAt === 'number' ? r.addedAt : Date.now(),
    });
  }
  return out;
}

export async function getAll(): Promise<Shortcut[]> {
  const local = getStorageLocal();
  if (!local) return [];
  const out = await local.get(STORAGE_KEY);
  return sanitize(out[STORAGE_KEY]);
}

export async function add(input: { label: string; url: string }): Promise<Shortcut> {
  const label = input.label.trim();
  const url = input.url.trim();
  if (!url) throw new Error('shortcut: empty url');
  // Validate URL — allow only http(s) for safety.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('shortcut: invalid url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('shortcut: protocol must be http(s)');
  }
  const items = await getAll();
  const sc: Shortcut = {
    id: makeId(),
    label: label || parsed.hostname.replace(/^www\./, ''),
    url,
    addedAt: Date.now(),
  };
  items.push(sc);
  const local = getStorageLocal();
  if (local) await local.set({ [STORAGE_KEY]: items });
  return sc;
}

export async function remove(id: string): Promise<void> {
  const items = await getAll();
  const next = items.filter((s) => s.id !== id);
  const local = getStorageLocal();
  if (local) await local.set({ [STORAGE_KEY]: next });
}

export async function update(
  id: string,
  patch: Partial<Pick<Shortcut, 'label' | 'url'>>,
): Promise<Shortcut | null> {
  const items = await getAll();
  const idx = items.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const cur = items[idx]!;
  const next: Shortcut = {
    ...cur,
    label: typeof patch.label === 'string' ? patch.label.trim() || cur.label : cur.label,
    url: typeof patch.url === 'string' && patch.url.trim() ? patch.url.trim() : cur.url,
  };
  items[idx] = next;
  const local = getStorageLocal();
  if (local) await local.set({ [STORAGE_KEY]: items });
  return next;
}

export async function reorder(ids: string[]): Promise<Shortcut[]> {
  const items = await getAll();
  const byId = new Map(items.map((s) => [s.id, s] as const));
  const ordered: Shortcut[] = [];
  for (const id of ids) {
    const s = byId.get(id);
    if (s) {
      ordered.push(s);
      byId.delete(id);
    }
  }
  // Append any remaining (not in payload).
  for (const s of byId.values()) ordered.push(s);
  const local = getStorageLocal();
  if (local) await local.set({ [STORAGE_KEY]: ordered });
  return ordered;
}

export const __SHORTCUTS_STORAGE_KEY = STORAGE_KEY;
