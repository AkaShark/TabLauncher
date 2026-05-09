/**
 * Pinia store for the FeedPanel.
 *
 * Cold start path (plan §M4 sequence):
 *   1. UI calls `loadFromCache()` — synchronous read of cached items + readMap.
 *      Renders skeleton if empty, items otherwise (warm path ≤1s).
 *   2. UI calls `refresh()` — sends `feed/refresh` to the SW.
 *      The SW fetches every enabled source's raw XML, writes results to
 *      `airss.cache.feed.rawXml`, then replies ok+stats.
 *   3. `chrome.storage.onChanged` fires for the rawXml key; this store parses
 *      each XML, aggregates, marks read flags, and exposes `items`.
 *
 * This split is mandatory: MV3 service workers do NOT have DOMParser.
 */

import { defineStore } from 'pinia';
import { aggregate } from '@/adapters/feed/aggregate';
import { parseRssXml } from '@/adapters/feed/rss';
import type { FeedFetchFailure, FeedItem, FeedSourceConfig } from '@/adapters/feed/types';
import { getCached, setCached } from '@/core/cache';
import { getAll as getAllSources } from '@/core/subscriptions';
import { time } from '@/utils/perf';

export interface FeedTabInfo {
  id: string;
  label: string;
  unreadCount: number;
}

const ITEMS_CACHE_KEY = 'feed.items';
const RAW_CACHE_KEY = 'feed.rawXml';
const PREPARSED_CACHE_KEY = 'feed.preparsed';
const READMAP_KEY = 'airss.feed.readMap';
const ACTIVE_TAB_KEY = 'airss.ui.activeFeedTab';
const REFRESH_TIMEOUT_MS = 5_000;
// P2-lite (docs/perf-baseline.md): aggregation at 1000 items costs ~0.06ms,
// so the DOM is the bottleneck — raise from 30 to 200, no virtualization.
const MAX_RENDER = 200;

export type FeedLoadingState =
  | 'idle'
  | 'cold-loading'
  | 'warm-loading'
  | 'loaded'
  | 'error';

export interface FeedError {
  kind: 'no-sources' | 'all-failed' | 'partial' | 'timeout';
  message: string;
  failedSources: FeedFetchFailure[];
}

export interface RawFeedEntry {
  sourceId: string;
  sourceLabel: string;
  xml: string;
  fetchedAt: number;
}

export interface PreparsedFeedEntry {
  sourceId: string;
  sourceLabel: string;
  items: FeedItem[];
  fetchedAt: number;
}

interface FeedState {
  items: FeedItem[];
  loadingState: FeedLoadingState;
  error: FeedError | null;
  lastRefreshedAt: number | null;
  readMap: Record<string, number>;
  activeTabId: string | null;
}

interface RefreshReply {
  ok: boolean;
  data?: { totalItems: number; failed: FeedFetchFailure[] };
  error?: { code: string; message: string };
}

export const useFeedStore = defineStore('feed', {
  state: (): FeedState => ({
    items: [],
    loadingState: 'idle',
    error: null,
    lastRefreshedAt: null,
    readMap: {},
    activeTabId: null,
  }),
  getters: {
    visibleItems: (s): FeedItem[] => s.items.slice(0, MAX_RENDER),
    failedCount: (s): number => s.error?.failedSources.length ?? 0,

    /**
     * Compute the tab list from a given sources array.
     * Each type='juejin' source → its own tab.
     * Any non-juejin source(s) → one merged 'rss-family' tab at the end.
     * Sources are ordered by addedAt ascending; rss-family is always last.
     */
    tabs:
      (s) =>
      (sources: FeedSourceConfig[]): FeedTabInfo[] => {
        // Tab ordering (per user 2026-05-08):
        //   1. category-tagged juejin sources (e.g. iOS · 推荐, iOS · 最新)
        //      — sorted by sortType asc within a category (200 推荐 before 300 最新)
        //   2. uncategorised juejin source (掘金 · 全站推荐流)
        //   3. rss-family (combined RSS / Substack / Medium)
        const enabledJuejin = sources.filter(
          (src) => src.enabled && src.type === 'juejin',
        );
        const cateSources = enabledJuejin
          .filter((src) => src.meta?.cateId !== undefined)
          .sort((a, b) => {
            const ca = a.meta?.cateId ?? '';
            const cb = b.meta?.cateId ?? '';
            if (ca !== cb) return ca.localeCompare(cb);
            const sa = a.meta?.sortType ?? 0;
            const sb = b.meta?.sortType ?? 0;
            return sa - sb;
          });
        const allFeedSources = enabledJuejin
          .filter((src) => src.meta?.cateId === undefined)
          .sort((a, b) => a.addedAt - b.addedAt);
        const juejinSources = [...cateSources, ...allFeedSources];
        const hasRss = sources.some((src) => src.enabled && src.type !== 'juejin');

        const result: FeedTabInfo[] = juejinSources.map((src) => {
          const tabItems = s.items.filter((it) => it.sourceId === src.id);
          const unreadCount = tabItems.filter((it) => !s.readMap[it.id]).length;
          return { id: src.id, label: src.label, unreadCount };
        });

        if (hasRss) {
          const juejinIds = new Set(juejinSources.map((src) => src.id));
          const rssItems = s.items.filter((it) => !juejinIds.has(it.sourceId));
          const unreadCount = rssItems.filter((it) => !s.readMap[it.id]).length;
          result.push({ id: 'rss-family', label: 'RSS', unreadCount });
        }

        return result;
      },

    /**
     * Return items for a given tab id.
     * 'rss-family' → all items whose sourceId is not a juejin source.
     * Otherwise → items whose sourceId === tabId.
     */
    itemsForTab:
      (s) =>
      (tabId: string, sources: FeedSourceConfig[]): FeedItem[] => {
        if (tabId === 'rss-family') {
          const juejinIds = new Set(
            sources.filter((src) => src.type === 'juejin').map((src) => src.id),
          );
          return s.items.filter((it) => !juejinIds.has(it.sourceId));
        }
        return s.items.filter((it) => it.sourceId === tabId);
      },

    /**
     * Count unread items for a given tab.
     */
    unreadByTab:
      (s) =>
      (tabId: string, sources: FeedSourceConfig[]): number => {
        const juejinIds = new Set(
          sources.filter((src) => src.type === 'juejin').map((src) => src.id),
        );
        let tabItems: FeedItem[];
        if (tabId === 'rss-family') {
          tabItems = s.items.filter((it) => !juejinIds.has(it.sourceId));
        } else {
          tabItems = s.items.filter((it) => it.sourceId === tabId);
        }
        return tabItems.filter((it) => !s.readMap[it.id]).length;
      },
  },
  actions: {
    /** Hydrate items + readMap synchronously from cache. */
    async loadFromCache(): Promise<boolean> {
      const [cached, readRaw] = await Promise.all([
        getCached<FeedItem[]>(ITEMS_CACHE_KEY),
        chrome.storage.local.get(READMAP_KEY),
      ]);
      const readMap = (readRaw[READMAP_KEY] ?? {}) as Record<string, number>;
      this.readMap = readMap;
      if (cached && Array.isArray(cached.value)) {
        this.items = cached.value.map((it) => ({ ...it, isRead: !!readMap[it.id] }));
        this.lastRefreshedAt = cached.fetchedAt;
        this.loadingState = 'loaded';
        return true;
      }
      return false;
    },

    /** Ask the SW to fetch all enabled sources. UI is updated via storage.onChanged. */
    async refresh(): Promise<void> {
      const sources = await getAllSources();
      const enabled = sources.filter((s) => s.enabled);
      if (enabled.length === 0) {
        this.loadingState = 'error';
        this.error = {
          kind: 'no-sources',
          message: '暂未添加订阅源',
          failedSources: [],
        };
        return;
      }

      const hasItems = this.items.length > 0;
      this.loadingState = hasItems ? 'warm-loading' : 'cold-loading';
      this.error = null;

      // 5s timeout fallback so cold-loading never wedges the UI.
      const timeoutP = new Promise<RefreshReply>((_, rej) => {
        setTimeout(() => rej(new Error('refresh-timeout')), REFRESH_TIMEOUT_MS);
      });

      try {
        const reply = (await Promise.race([
          chrome.runtime.sendMessage({ type: 'feed/refresh' }) as Promise<RefreshReply>,
          timeoutP,
        ])) as RefreshReply;
        if (!reply || !reply.ok) {
          const message = reply?.error?.message ?? 'refresh failed';
          this.error = {
            kind: 'all-failed',
            message,
            failedSources: [],
          };
          this.loadingState = hasItems ? 'loaded' : 'error';
          return;
        }
        const stats = reply.data ?? { totalItems: 0, failed: [] };
        const failed = stats.failed ?? [];
        if (failed.length === enabled.length) {
          this.error = {
            kind: 'all-failed',
            message: '全部源拉取失败',
            failedSources: failed,
          };
        } else if (failed.length > 0) {
          this.error = {
            kind: 'partial',
            message: `${failed.length} 个源拉取失败`,
            failedSources: failed,
          };
        } else {
          this.error = null;
        }
        // Items themselves are populated by the storage.onChanged listener
        // calling rebuildFromRaw().
        await this.rebuildFromRaw(enabled);
        this.lastRefreshedAt = Date.now();
        this.loadingState = 'loaded';
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg === 'refresh-timeout') {
          this.error = {
            kind: 'timeout',
            message: '拉取超时',
            failedSources: [],
          };
          this.loadingState = hasItems ? 'loaded' : 'error';
        } else {
          this.error = {
            kind: 'all-failed',
            message: msg,
            failedSources: [],
          };
          this.loadingState = hasItems ? 'loaded' : 'error';
        }
      }
    },

    /**
     * Read raw XML cache, parse + aggregate in the foreground (where DOMParser
     * is available), apply readMap, persist as items cache.
     */
    async rebuildFromRaw(sources?: FeedSourceConfig[]): Promise<void> {
      // Architect P2-lite §8 A': hot path — instrument per refresh.
      return time('feed.rebuildFromRaw', async () => {
        const list = sources ?? (await getAllSources()).filter((s) => s.enabled);
        const [rawCached, preCached] = await Promise.all([
          getCached<Record<string, RawFeedEntry>>(RAW_CACHE_KEY),
          getCached<Record<string, PreparsedFeedEntry>>(PREPARSED_CACHE_KEY),
        ]);
        const raw = rawCached?.value ?? {};
        const pre = preCached?.value ?? {};
        if (!rawCached && !preCached) return;

        const perSource: FeedItem[][] = [];
        for (const src of list) {
          if (src.type === 'juejin') {
            const entry = pre[src.id];
            if (entry && Array.isArray(entry.items)) perSource.push(entry.items);
            continue;
          }
          const entry = raw[src.id];
          if (!entry || !entry.xml) continue;
          try {
            const items = parseRssXml(entry.xml, src.id, src.label);
            perSource.push(items);
          } catch (e) {
            // Parse failure — surface in error.failedSources next refresh.
            console.warn('[AIRSS] rss parse failed for', src.label, e);
          }
        }
        const merged = aggregate(perSource).map((it) => ({
          ...it,
          isRead: !!this.readMap[it.id],
        }));
        this.items = merged;
        await setCached(ITEMS_CACHE_KEY, merged);
      });
    },

    async markRead(itemId: string): Promise<void> {
      if (this.readMap[itemId]) return;
      const ts = Date.now();
      this.readMap = { ...this.readMap, [itemId]: ts };
      const idx = this.items.findIndex((i) => i.id === itemId);
      if (idx >= 0) {
        const cur = this.items[idx]!;
        this.items[idx] = { ...cur, isRead: true };
      }
      await chrome.storage.local.set({ [READMAP_KEY]: this.readMap });
    },

    /** Persist the active tab id to chrome.storage.local. */
    async setActiveTab(id: string): Promise<void> {
      this.activeTabId = id;
      await chrome.storage.local.set({ [ACTIVE_TAB_KEY]: id });
    },

    /** Load the persisted active tab id from chrome.storage.local. */
    async loadActiveTab(sources: FeedSourceConfig[]): Promise<void> {
      const raw = await chrome.storage.local.get(ACTIVE_TAB_KEY);
      const stored = raw[ACTIVE_TAB_KEY] as string | undefined;
      // Build valid tab ids from sources so we can validate stored value.
      const juejinIds = sources
        .filter((src) => src.enabled && src.type === 'juejin')
        .map((src) => src.id);
      const hasRss = sources.some((src) => src.enabled && src.type !== 'juejin');
      const validIds = new Set<string>([...juejinIds, ...(hasRss ? ['rss-family'] : [])]);
      if (stored && validIds.has(stored)) {
        this.activeTabId = stored;
      } else {
        // Reset to first tab.
        this.activeTabId = juejinIds[0] ?? (hasRss ? 'rss-family' : null);
      }
    },

    /** Subscribe to SW-driven cache updates. */
    bindStorage(): void {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes['airss.cache.feed.rawXml'] || changes['airss.cache.feed.preparsed']) {
          void this.rebuildFromRaw();
        }
        if (changes[READMAP_KEY]) {
          const next = (changes[READMAP_KEY].newValue ?? {}) as Record<string, number>;
          this.readMap = next;
          this.items = this.items.map((it) => ({ ...it, isRead: !!next[it.id] }));
        }
      });
    },
  },
});
