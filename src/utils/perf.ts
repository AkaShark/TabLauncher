/**
 * Tiny perf wrapper around the User Timing API.
 *
 * Gated by `import.meta.env.DEV` — production callers no-op with zero overhead
 * (functions still return sensible values so call sites don't branch).
 *
 * Usage:
 *   mark('feed.refresh.start')
 *   const ms = measure('feed.refresh', 'feed.refresh.start')
 *   const items = await time('feed.rebuild', () => store.rebuildFromRaw())
 */

export const PERF_ENABLED: boolean =
  typeof import.meta !== 'undefined' &&
  !!(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV &&
  typeof performance !== 'undefined' &&
  typeof performance.mark === 'function';

function hasPerformance(): boolean {
  return typeof performance !== 'undefined' && typeof performance.mark === 'function';
}

/** Record a performance mark. No-op in prod or when performance.mark is missing. */
export function mark(name: string): void {
  if (!PERF_ENABLED || !hasPerformance()) return;
  try {
    performance.mark(name);
  } catch {
    /* ignore */
  }
}

/**
 * Measure between two marks (or from a start mark to "now"). Returns the
 * duration in ms, or null when measurement was skipped or threw.
 */
export function measure(name: string, startMark: string, endMark?: string): number | null {
  if (!PERF_ENABLED || !hasPerformance() || typeof performance.measure !== 'function') {
    return null;
  }
  try {
    const entry = endMark
      ? performance.measure(name, startMark, endMark)
      : performance.measure(name, startMark);
    // Some implementations return undefined; fall back to getEntriesByName.
    if (entry && typeof entry.duration === 'number') return entry.duration;
    const entries = performance.getEntriesByName(name, 'measure');
    const last = entries[entries.length - 1];
    return last ? last.duration : null;
  } catch {
    return null;
  }
}

/**
 * Wrap a sync or async function. In dev, marks before/after, measures, and
 * logs `[perf] label: Xms` via console.debug. In prod, returns fn() directly.
 */
export function time<T>(label: string, fn: () => T): T;
export function time<T>(label: string, fn: () => Promise<T>): Promise<T>;
export function time<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
  if (!PERF_ENABLED) return fn();
  const startMark = `${label}.start`;
  const endMark = `${label}.end`;
  mark(startMark);
  const finish = (): void => {
    mark(endMark);
    const ms = measure(label, startMark, endMark);
    if (ms != null) console.debug(`[perf] ${label}: ${ms.toFixed(2)}ms`);
  };
  let result: T | Promise<T>;
  try {
    result = fn();
  } catch (e) {
    finish();
    throw e;
  }
  if (result && typeof (result as Promise<T>).then === 'function') {
    return (result as Promise<T>).then(
      (v) => {
        finish();
        return v;
      },
      (e) => {
        finish();
        throw e;
      },
    );
  }
  finish();
  return result;
}
