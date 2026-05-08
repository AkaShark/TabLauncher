import { describe, it, expect } from 'vitest';
import { normalizeJuejinItem, normalizeJuejinFeed } from '../normalizer';
import type { JuejinFeedItem } from '../types';

function makeRaw(overrides: Partial<JuejinFeedItem['item_info']['article_info']> = {}, extra: Partial<JuejinFeedItem> = {}): JuejinFeedItem {
  return {
    item_type: 2,
    item_info: {
      article_id: '7250000000000000001',
      article_info: {
        title: '深入理解 V8',
        brief_content: '关于 V8 的简介',
        cover_image: 'https://p3-juejin.byteimg.com/cover.jpg',
        ctime: '1714000000',
        mtime: '1714100000',
        link_url: 'https://juejin.cn/post/7250000000000000001',
        ...overrides,
      },
      author_user_info: { user_name: '张三', user_id: 'u1' },
    },
    ...extra,
  } as JuejinFeedItem;
}

describe('normalizeJuejinItem', () => {
  it('case 1: maps full raw → FeedItem fields correctly', () => {
    const out = normalizeJuejinItem(makeRaw());
    expect(out).not.toBeNull();
    expect(out!.title).toBe('深入理解 V8');
    expect(out!.url).toBe('https://juejin.cn/post/7250000000000000001');
    expect(out!.summary).toBe('关于 V8 的简介');
    expect(out!.thumbnail).toBe('https://p3-juejin.byteimg.com/cover.jpg');
    expect(out!.sourceId).toBe('juejin');
    expect(out!.isRead).toBe(false);
    expect(out!.id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('case 2: ctime seconds → ms', () => {
    const out = normalizeJuejinItem(makeRaw({ ctime: '1714000000' }));
    expect(out!.publishedAt).toBe(1714000000 * 1000);
  });

  it('case 3: empty cover_image → thumbnail null', () => {
    const out = normalizeJuejinItem(makeRaw({ cover_image: '' }));
    expect(out!.thumbnail).toBeNull();
  });

  it('case 4: brief_content > 280 chars truncates with ellipsis', () => {
    const long = 'a'.repeat(400);
    const out = normalizeJuejinItem(makeRaw({ brief_content: long }));
    const s = out!.summary;
    expect(s.length).toBeLessThanOrEqual(281);
    expect(s.endsWith('…')).toBe(true);
  });

  it('case 5: author name appended to sourceLabel', () => {
    const out = normalizeJuejinItem(makeRaw());
    expect(out!.sourceLabel).toBe('掘金 · 张三');
  });

  it('case 6: missing link_url → built from article_id', () => {
    const raw = makeRaw();
    delete raw.item_info.article_info.link_url;
    const out = normalizeJuejinItem(raw);
    expect(out!.url).toBe('https://juejin.cn/post/7250000000000000001');
  });

  it('case 7: missing author → bare 掘金 label', () => {
    const raw = makeRaw();
    delete raw.item_info.author_user_info;
    const out = normalizeJuejinItem(raw);
    expect(out!.sourceLabel).toBe('掘金');
  });

  it('case 8: null/missing title returns null', () => {
    const raw = makeRaw({ title: '' });
    const out = normalizeJuejinItem(raw);
    expect(out).toBeNull();
  });

  it('case 9: normalizeJuejinFeed skips invalid entries', () => {
    const ok = makeRaw();
    const bad = makeRaw({ title: '' });
    const out = normalizeJuejinFeed([ok, bad]);
    expect(out).toHaveLength(1);
  });
});
