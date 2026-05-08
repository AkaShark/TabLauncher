import { describe, it, expect } from 'vitest';
import { aggregate } from '../aggregate';
import type { FeedItem } from '../types';

function makeItem(overrides: Partial<FeedItem> & Pick<FeedItem, 'title' | 'url' | 'sourceId'>): FeedItem {
  return {
    id: `id-${overrides.url ?? overrides.title}`,
    sourceLabel: 'Test',
    publishedAt: null,
    summary: '',
    thumbnail: null,
    isRead: false,
    ...overrides,
  };
}

describe('aggregate', () => {
  it('case 1: deduplicates items with the same url, keeping the first', () => {
    const a = makeItem({ title: 'A', url: 'https://example.com/1', sourceId: 'src1', publishedAt: 1000 });
    const b = makeItem({ title: 'A duplicate', url: 'https://example.com/1', sourceId: 'src2', publishedAt: 2000 });
    const result = aggregate([[a], [b]]);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('A');
  });

  it('case 2: deduplicates items with same title+sourceId', () => {
    const a = makeItem({ title: 'Same Title', url: '', sourceId: 'src1', publishedAt: 1000 });
    const b = makeItem({ title: 'Same Title', url: '', sourceId: 'src1', publishedAt: 2000 });
    const result = aggregate([[a, b]]);
    expect(result).toHaveLength(1);
  });

  it('case 3: does NOT deduplicate same title from different sourceIds', () => {
    const a = makeItem({ title: 'Same Title', url: '', sourceId: 'src1' });
    const b = makeItem({ title: 'Same Title', url: '', sourceId: 'src2' });
    const result = aggregate([[a], [b]]);
    expect(result).toHaveLength(2);
  });

  it('case 4: sorts by publishedAt descending, null sinks to bottom', () => {
    const old = makeItem({ title: 'Old', url: 'https://example.com/old', sourceId: 'src1', publishedAt: 1000 });
    const recent = makeItem({ title: 'Recent', url: 'https://example.com/recent', sourceId: 'src1', publishedAt: 9000 });
    const mid = makeItem({ title: 'Mid', url: 'https://example.com/mid', sourceId: 'src1', publishedAt: 5000 });
    const noDate = makeItem({ title: 'NoDate', url: 'https://example.com/nodate', sourceId: 'src1', publishedAt: null });
    const result = aggregate([[old, noDate, mid, recent]]);
    expect(result.map((i) => i.title)).toEqual(['Recent', 'Mid', 'Old', 'NoDate']);
  });

  it('case 5: caps output at 100 items by default', () => {
    const items = Array.from({ length: 150 }, (_, idx) =>
      makeItem({ title: `Item ${idx}`, url: `https://example.com/${idx}`, sourceId: 'src1', publishedAt: idx }),
    );
    const result = aggregate([items]);
    expect(result).toHaveLength(100);
  });

  it('respects custom cap', () => {
    const items = Array.from({ length: 20 }, (_, idx) =>
      makeItem({ title: `Item ${idx}`, url: `https://example.com/${idx}`, sourceId: 'src1' }),
    );
    const result = aggregate([items], 5);
    expect(result).toHaveLength(5);
  });
});
