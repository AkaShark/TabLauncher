/**
 * Bench for `rebuildFromRaw` — informs the P2-lite virtualization decision.
 *
 * We bypass the store action and bench `aggregate()` directly with a similar
 * workload (200 and 1000 mock items). The action's overhead beyond aggregate
 * is one chrome.storage.local read, which is constant; aggregate is the
 * algorithmic hot loop the architect flagged.
 */
import { bench, describe } from 'vitest';
import { aggregate } from '@/adapters/feed/aggregate';
import type { FeedItem } from '@/adapters/feed/types';

function mockItems(n: number, sourceCount = 5): FeedItem[][] {
  const perSource: FeedItem[][] = [];
  for (let s = 0; s < sourceCount; s++) {
    const arr: FeedItem[] = [];
    for (let i = 0; i < Math.ceil(n / sourceCount); i++) {
      arr.push({
        id: `s${s}-i${i}`,
        sourceId: `src-${s}`,
        sourceLabel: `Src ${s}`,
        title: `Mock item ${s}/${i} — lorem ipsum dolor sit amet consectetur`,
        url: `https://example.com/s${s}/i${i}`,
        publishedAt: Date.now() - i * 1000,
        summary: 'A '.repeat(40),
        thumbnail: null,
        isRead: false,
      });
    }
    perSource.push(arr);
  }
  return perSource;
}

describe('feed.rebuildFromRaw bench', () => {
  const small = mockItems(200);
  const big = mockItems(1000);

  bench('aggregate 200 items', () => {
    aggregate(small);
  });

  bench('aggregate 1000 items', () => {
    aggregate(big);
  });
});
