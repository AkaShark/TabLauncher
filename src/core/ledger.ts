/**
 * Daily completion ledger — local-first 7/30 day trend datasource (plan §OP-4).
 *
 * Stored in chrome.storage.local under `airss.cache.dailyCompletionLedger`
 * as `{ [yyyy-mm-dd]: number }`. Each entry is the count of TickTick tasks
 * whose dueDate is on that day AND status === 1 (completed) at the time the
 * service worker last refreshed.
 *
 * Behaviour:
 *   - recordToday() overwrites today's value (idempotent on repeat refreshes).
 *   - getRange(N) returns the last N days ascending; missing days fill 0.
 *   - dates are computed in the user's local timezone, matching utils/today.ts.
 */

const STORAGE_KEY = 'airss.cache.dailyCompletionLedger';

export type LedgerMap = Record<string, number>;

export interface LedgerPoint {
  date: string; // yyyy-mm-dd
  count: number;
}

/** Format a Date as local-tz `yyyy-mm-dd`. */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function readLedger(): Promise<LedgerMap> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!raw || typeof raw !== 'object') return {};
  const out: LedgerMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      out[k] = v;
    }
  }
  return out;
}

async function writeLedger(map: LedgerMap): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: map });
}

/** Overwrite today's bucket with `count`. */
export async function recordToday(count: number, now: Date = new Date()): Promise<void> {
  const safe = Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
  const key = formatLocalDate(now);
  const map = await readLedger();
  map[key] = safe;
  await writeLedger(map);
}

/**
 * Return last N days (ascending) including today. Missing days fill 0.
 */
export async function getRange(
  days: 7 | 30,
  now: Date = new Date(),
): Promise<LedgerPoint[]> {
  const map = await readLedger();
  const out: LedgerPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = formatLocalDate(d);
    out.push({ date: key, count: map[key] ?? 0 });
  }
  return out;
}

/** Raw map — used by trend store to compute `recorded` (non-zero day count). */
export async function getAllRecorded(): Promise<LedgerMap> {
  return readLedger();
}

/** Number of days where ledger has a recorded entry (>0 count). */
export function countRecordedDays(map: LedgerMap): number {
  let n = 0;
  for (const v of Object.values(map)) {
    if (typeof v === 'number' && v > 0) n++;
  }
  return n;
}
