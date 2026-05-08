import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { installStorageMock } from '../../../tests/helpers/chromeMock';
import { useFeedStore } from '../feed';
import type { FeedSourceConfig, FeedItem } from '@/adapters/feed/types';

function makeSource(overrides: Partial<FeedSourceConfig> = {}): FeedSourceConfig {
  return {
    id: 'src-' + Math.random().toString(36).slice(2),
    type: 'rss',
    url: 'https://example.com/feed.xml',
    label: 'Example RSS',
    addedAt: Date.now(),
    enabled: true,
    ...overrides,
  };
}

/** Default = no-meta juejin (legacy 全站推荐流). Cate-tagged sources override meta. */
function makeJuejinSource(overrides: Partial<FeedSourceConfig> = {}): FeedSourceConfig {
  return makeSource({
    type: 'juejin',
    url: 'juejin://recommend_all_feed',
    label: '掘金',
    ...overrides,
  });
}

function makeItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'item-' + Math.random().toString(36).slice(2),
    sourceId: 'src-1',
    sourceLabel: 'Source',
    title: 'Title',
    url: 'https://example.com/post',
    publishedAt: Date.now(),
    summary: '',
    thumbnail: null,
    isRead: false,
    ...overrides,
  };
}

describe('feed store — tabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installStorageMock();
  });

  // case 1: 没订阅 → tabs = []
  it('case 1: no sources → tabs is empty', () => {
    const store = useFeedStore();
    const result = store.tabs([]);
    expect(result).toHaveLength(0);
  });

  // case 2: 仅 1 个 juejin → tabs = [{id:juejinId,...}]
  it('case 2: single juejin source → one tab with juejin id', () => {
    const src = makeJuejinSource({ id: 'juejin-1', label: '掘金 · 推荐流' });
    const store = useFeedStore();
    const result = store.tabs([src]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('juejin-1');
    expect(result[0]!.label).toBe('掘金 · 推荐流');
  });

  // case 3: 3 个 juejin（含分类）+ 2 个 RSS → tabs.length = 4，最后一个 id='rss-family' label='RSS'
  it('case 3: 3 juejin + 2 rss → 4 tabs, last is rss-family', () => {
    const j1 = makeJuejinSource({ id: 'j1', label: '掘金 · 推荐流', addedAt: 1000 });
    const j2 = makeJuejinSource({ id: 'j2', label: 'iOS · 推荐', addedAt: 2000 });
    const j3 = makeJuejinSource({ id: 'j3', label: 'iOS · 最新', addedAt: 3000 });
    const r1 = makeSource({ id: 'r1', type: 'rss', addedAt: 4000 });
    const r2 = makeSource({ id: 'r2', type: 'substack', addedAt: 5000 });

    const store = useFeedStore();
    const result = store.tabs([j1, j2, j3, r1, r2]);
    expect(result).toHaveLength(4);
    expect(result[0]!.id).toBe('j1');
    expect(result[1]!.id).toBe('j2');
    expect(result[2]!.id).toBe('j3');
    expect(result[3]!.id).toBe('rss-family');
    expect(result[3]!.label).toBe('RSS');
  });

  // case 4: itemsForTab('rss-family') 返回所有非 juejin items
  it('case 4: itemsForTab rss-family returns only non-juejin items', () => {
    const j1 = makeJuejinSource({ id: 'j1' });
    const r1 = makeSource({ id: 'r1', type: 'rss' });
    const itemJ = makeItem({ id: 'i1', sourceId: 'j1' });
    const itemR1 = makeItem({ id: 'i2', sourceId: 'r1' });
    const itemR2 = makeItem({ id: 'i3', sourceId: 'r1' });

    const store = useFeedStore();
    store.items = [itemJ, itemR1, itemR2];

    const result = store.itemsForTab('rss-family', [j1, r1]);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['i2', 'i3']);
  });

  // case 5: itemsForTab(specificJuejinId) 返回该源 items
  it('case 5: itemsForTab with specific juejin id returns only that source items', () => {
    const j1 = makeJuejinSource({ id: 'j1' });
    const j2 = makeJuejinSource({ id: 'j2' });
    const itemA = makeItem({ id: 'a1', sourceId: 'j1' });
    const itemB = makeItem({ id: 'a2', sourceId: 'j1' });
    const itemC = makeItem({ id: 'a3', sourceId: 'j2' });

    const store = useFeedStore();
    store.items = [itemA, itemB, itemC];

    const result = store.itemsForTab('j1', [j1, j2]);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['a1', 'a2']);
  });

  // case 6: unreadByTab 排除 readMap 中的
  it('case 6: unreadByTab excludes items in readMap', () => {
    const j1 = makeJuejinSource({ id: 'j1' });
    const i1 = makeItem({ id: 'i1', sourceId: 'j1', isRead: false });
    const i2 = makeItem({ id: 'i2', sourceId: 'j1', isRead: true });
    const i3 = makeItem({ id: 'i3', sourceId: 'j1', isRead: false });

    const store = useFeedStore();
    store.items = [i1, i2, i3];
    store.readMap = { i2: Date.now() };

    const count = store.unreadByTab('j1', [j1]);
    expect(count).toBe(2);
  });

  // case 7: setActiveTab 持久化 + loadActiveTab 恢复
  it('case 7: setActiveTab persists and loadActiveTab restores', async () => {
    const j1 = makeJuejinSource({ id: 'j1', label: '掘金', addedAt: 1000 });
    const j2 = makeJuejinSource({ id: 'j2', label: 'iOS', addedAt: 2000 });

    const store = useFeedStore();
    await store.setActiveTab('j2');
    expect(store.activeTabId).toBe('j2');

    // Simulate a fresh store loading from storage.
    const store2 = useFeedStore();
    await store2.loadActiveTab([j1, j2]);
    expect(store2.activeTabId).toBe('j2');
  });

  // case 8: loadActiveTab resets to first tab when stored id is invalid
  it('case 8: loadActiveTab falls back to first tab when stored id not in current tabs', async () => {
    const j1 = makeJuejinSource({ id: 'j1', label: '掘金', addedAt: 1000 });

    const store = useFeedStore();
    await store.setActiveTab('stale-id');

    const store2 = useFeedStore();
    await store2.loadActiveTab([j1]);
    expect(store2.activeTabId).toBe('j1');
  });

  // case 9: tabs juejin sources ordered by addedAt ascending
  it('case 9: juejin tabs are ordered by addedAt ascending', () => {
    const j1 = makeJuejinSource({ id: 'j1', addedAt: 3000 });
    const j2 = makeJuejinSource({ id: 'j2', addedAt: 1000 });
    const j3 = makeJuejinSource({ id: 'j3', addedAt: 2000 });

    const store = useFeedStore();
    const result = store.tabs([j1, j2, j3]);
    expect(result.map((t) => t.id)).toEqual(['j2', 'j3', 'j1']);
  });

  // case 10: tabs unreadCount counts correctly per tab
  it('case 10: tabs unreadCount reflects unread items per tab', () => {
    const j1 = makeJuejinSource({ id: 'j1', addedAt: 1000 });
    const r1 = makeSource({ id: 'r1', type: 'rss', addedAt: 2000 });

    const i1 = makeItem({ id: 'i1', sourceId: 'j1' });
    const i2 = makeItem({ id: 'i2', sourceId: 'j1' });
    const i3 = makeItem({ id: 'i3', sourceId: 'r1' });

    const store = useFeedStore();
    store.items = [i1, i2, i3];
    store.readMap = { i1: Date.now() }; // i1 is read

    const result = store.tabs([j1, r1]);
    const j1Tab = result.find((t) => t.id === 'j1');
    const rssTab = result.find((t) => t.id === 'rss-family');
    expect(j1Tab!.unreadCount).toBe(1);
    expect(rssTab!.unreadCount).toBe(1);
  });
});
