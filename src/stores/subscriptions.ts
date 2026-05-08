/**
 * Pinia store for feed subscription sources.
 *
 * Architectural rule (plan §M4): all `chrome.permissions.request` calls happen
 * here in the foreground (newtab/options), NEVER in the service worker.
 */

import { defineStore } from 'pinia';
import { add, getAll, remove as removeSource, toggle, STORAGE_KEY } from '@/core/subscriptions';
import { hasPermission, requestForUrl } from '@/core/permissions';
import type { FeedSourceConfig } from '@/adapters/feed/types';
import { substackLabel, substackUrl } from '@/adapters/feed/substack';
import { mediumLabel, mediumUrl } from '@/adapters/feed/medium';

interface SubscriptionsState {
  sources: FeedSourceConfig[];
  loaded: boolean;
  error: string | null;
}

export type AddOutcome =
  | { ok: true; source: FeedSourceConfig }
  | { ok: false; reason: 'permission-denied' | 'invalid' | 'duplicate' | 'unknown'; message: string };

export const useSubscriptionsStore = defineStore('subscriptions', {
  state: (): SubscriptionsState => ({ sources: [], loaded: false, error: null }),
  getters: {
    enabledSources: (s): FeedSourceConfig[] => s.sources.filter((x) => x.enabled),
  },
  actions: {
    async load(): Promise<void> {
      this.sources = await getAll();
      this.loaded = true;
    },

    async addRss(url: string, label?: string): Promise<AddOutcome> {
      this.error = null;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return { ok: false, reason: 'invalid', message: 'invalid URL' };
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { ok: false, reason: 'invalid', message: 'only http(s) is supported' };
      }
      // Ask for host permission unless we already have it (covers built-in hosts).
      const already = await hasPermission(url);
      if (!already) {
        const granted = await requestForUrl(url);
        if (!granted) {
          return { ok: false, reason: 'permission-denied', message: '用户拒绝授予权限' };
        }
      }
      try {
        const cfg = await add({
          type: 'rss',
          url,
          label: label?.trim() || parsed.host,
        });
        await this.load();
        return { ok: true, source: cfg };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, reason: 'unknown', message: msg };
      }
    },

    async addSubstack(handle: string, label?: string): Promise<AddOutcome> {
      try {
        const url = substackUrl(handle);
        const cfg = await add({
          type: 'substack',
          url,
          label: label?.trim() || substackLabel(handle),
        });
        await this.load();
        return { ok: true, source: cfg };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, reason: 'invalid', message: msg };
      }
    },

    /**
     * Add the Juejin recommend feed (singleton — only one Juejin source ever).
     * Idempotent: returns the existing config if already added.
     */
    async addJuejin(): Promise<AddOutcome> {
      const url = 'juejin://recommend_all_feed';
      try {
        const cfg = await add({
          type: 'juejin',
          url,
          label: '掘金 · 推荐流',
        });
        await this.load();
        return { ok: true, source: cfg };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, reason: 'unknown', message: msg };
      }
    },

    /**
     * Add a Juejin category feed subscription.
     * Idempotent: returns existing config if the same cateId+sortType already added.
     *
     * @param cateId        - Juejin category id (e.g. '6809635626661445640' for iOS)
     * @param sortType      - 200 = 推荐, 300 = 最新
     * @param categoryLabel - Human-readable category name (e.g. 'iOS')
     */
    async addJuejinCategory(
      cateId: string,
      sortType: 200 | 300,
      categoryLabel: string,
    ): Promise<AddOutcome> {
      const url = `juejin://cate/${cateId}?sort=${sortType}`;
      const label = `掘金 ${categoryLabel} · ${sortType === 200 ? '推荐' : '最新'}`;
      try {
        const cfg = await add({
          type: 'juejin',
          url,
          label,
          meta: { cateId, sortType, categoryLabel },
        });
        await this.load();
        return { ok: true, source: cfg };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, reason: 'unknown', message: msg };
      }
    },

    async addMedium(input: string, label?: string): Promise<AddOutcome> {
      try {
        const url = mediumUrl(input);
        const cfg = await add({
          type: 'medium',
          url,
          label: label?.trim() || mediumLabel(input),
        });
        await this.load();
        return { ok: true, source: cfg };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, reason: 'invalid', message: msg };
      }
    },

    async remove(id: string): Promise<void> {
      await removeSource(id);
      await this.load();
    },

    async toggle(id: string): Promise<void> {
      await toggle(id);
      await this.load();
    },

    /** Wire chrome.storage.onChanged so cross-context edits keep the UI live. */
    bindStorage(): void {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[STORAGE_KEY]) {
          void this.load();
        }
      });
    },
  },
});
