/**
 * Multi-source feed aggregation: flatten → dedupe → sort → cap.
 *
 * Plan §M4 AC-F4:
 *   - dedupe key = url || `${title}::${sourceId}`
 *   - sort by publishedAt desc, null sinks to bottom
 *   - default cap 300 (must stay >= UI MAX_RENDER=200 to not starve per-tab
 *     filters; with 20+ sources × ~20 items the old 100 cap was clipping
 *     older items out of the per-source tabs after global sort)
 */

import type { FeedItem } from './types';

const DEFAULT_CAP = 300;

export function aggregate(perSource: FeedItem[][], cap: number = DEFAULT_CAP): FeedItem[] {
  const flat: FeedItem[] = [];
  for (const arr of perSource) {
    if (Array.isArray(arr)) flat.push(...arr);
  }

  const seen = new Set<string>();
  const deduped: FeedItem[] = [];
  for (const item of flat) {
    const key = item.url ? item.url : `${item.title}::${item.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => {
    const aN = a.publishedAt == null;
    const bN = b.publishedAt == null;
    if (aN && bN) return 0;
    if (aN) return 1; // null sinks
    if (bN) return -1;
    return (b.publishedAt as number) - (a.publishedAt as number);
  });

  return deduped.slice(0, cap);
}
