/**
 * Pinia store for the GithubPanel.
 *
 * Cold start path mirrors feed.ts:
 *   1. UI calls `loadFromCache()` — pulls cached items + readMap.
 *   2. UI calls `refresh()` — sends `github/refresh` to the SW; SW writes
 *      cache + replies with stats. Items are read back from cache.
 *   3. `updateConfig(patch)` persists via `github/setConfig` and triggers refresh.
 */

import { defineStore } from 'pinia';
import type { GithubConfig, GithubItem } from '@/adapters/github/types';
import { DEFAULT_GITHUB_CONFIG } from '@/adapters/github/types';
import { getCached } from '@/core/cache';

const ITEMS_CACHE_KEY = 'github.items';
const READMAP_KEY = 'airss.github.readMap';
const REFRESH_TIMEOUT_MS = 8_000;

export type GithubLoadingState =
  | 'idle'
  | 'cold-loading'
  | 'warm-loading'
  | 'loaded'
  | 'error';

export interface GithubError {
  kind: 'fetch-failed' | 'timeout';
  message: string;
}

interface GithubState {
  items: GithubItem[];
  loadingState: GithubLoadingState;
  error: GithubError | null;
  lastRefreshedAt: number | null;
  config: GithubConfig;
  readMap: Record<string, number>;
}

interface RefreshReply {
  ok: boolean;
  data?: { totalItems: number };
  error?: { code: string; message: string };
}

export const useGithubStore = defineStore('github', {
  state: (): GithubState => ({
    items: [],
    loadingState: 'idle',
    error: null,
    lastRefreshedAt: null,
    config: { ...DEFAULT_GITHUB_CONFIG },
    readMap: {},
  }),
  actions: {
    /** Hydrate items + readMap + config synchronously from cache/storage. */
    async loadFromCache(): Promise<boolean> {
      const [cached, readRaw] = await Promise.all([
        getCached<GithubItem[]>(ITEMS_CACHE_KEY),
        chrome.storage.local.get(READMAP_KEY),
      ]);
      const readMap = (readRaw[READMAP_KEY] ?? {}) as Record<string, number>;
      this.readMap = readMap;
      // Pull config via the dedicated module.
      const { getConfig } = await import('@/core/githubConfig');
      this.config = await getConfig();
      if (cached && Array.isArray(cached.value)) {
        this.items = cached.value;
        this.lastRefreshedAt = cached.fetchedAt;
        this.loadingState = 'loaded';
        return true;
      }
      return false;
    },

    /** Ask the SW to fetch latest GitHub Trending. */
    async refresh(): Promise<void> {
      const hasItems = this.items.length > 0;
      this.loadingState = hasItems ? 'warm-loading' : 'cold-loading';
      this.error = null;

      const timeoutP = new Promise<RefreshReply>((_, rej) => {
        setTimeout(() => rej(new Error('refresh-timeout')), REFRESH_TIMEOUT_MS);
      });

      try {
        const reply = (await Promise.race([
          chrome.runtime.sendMessage({ type: 'github/refresh' }) as Promise<RefreshReply>,
          timeoutP,
        ])) as RefreshReply;
        if (!reply || !reply.ok) {
          this.error = {
            kind: 'fetch-failed',
            message: reply?.error?.message ?? 'github refresh failed',
          };
          this.loadingState = hasItems ? 'loaded' : 'error';
          return;
        }
        // Items written to cache by SW; read them back.
        const cached = await getCached<GithubItem[]>(ITEMS_CACHE_KEY);
        if (cached && Array.isArray(cached.value)) {
          this.items = cached.value;
          this.lastRefreshedAt = cached.fetchedAt;
        }
        this.loadingState = 'loaded';
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.error = {
          kind: msg === 'refresh-timeout' ? 'timeout' : 'fetch-failed',
          message: msg,
        };
        this.loadingState = hasItems ? 'loaded' : 'error';
      }
    },

    /** Persist config patch via SW (which also triggers a refresh). */
    async updateConfig(patch: Partial<GithubConfig>): Promise<void> {
      interface SetReply {
        ok: boolean;
        data?: { config: GithubConfig };
        error?: { code: string; message: string };
      }
      const reply = (await chrome.runtime.sendMessage({
        type: 'github/setConfig',
        patch,
      })) as SetReply;
      if (reply && reply.ok && reply.data) {
        this.config = reply.data.config;
      }
      await this.refresh();
    },

    async markRead(itemId: string): Promise<void> {
      if (this.readMap[itemId]) return;
      const ts = Date.now();
      this.readMap = { ...this.readMap, [itemId]: ts };
      await chrome.storage.local.set({ [READMAP_KEY]: this.readMap });
    },
  },
});
