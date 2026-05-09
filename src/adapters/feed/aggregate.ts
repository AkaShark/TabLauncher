/**
 * Multi-source feed aggregation: flatten → dedupe (per-source) → sort → cap.
 *
 *   - dedupe key = `${sourceId}::${url || title}` — always source-scoped so
 *     subscribing to overlapping juejin cates (e.g. 推荐流 + iOS · 最新) keeps
 *     each source's own copy. The per-tab filter then surfaces what each
 *     source actually returned, instead of a popular article being attributed
 *     only to whichever source the SW happened to process first.
 *   - sort by publishedAt desc, null sinks to bottom.
 *   - default cap 300 (>= UI MAX_RENDER=200 so per-tab filters don't starve
 *     after the global sort).
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
    const key = `${item.sourceId}::${item.url || item.title}`;
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
