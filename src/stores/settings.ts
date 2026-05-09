/**
 * Pinia store for global user settings.
 *
 * Persisted under chrome.storage.local key `airss.settings.v1`.
 * Covers RSSHub base URL and feed refresh interval; other surfaces (githubConfig,
 * juejinCreds) remain in their own stores per A' synthesis (no migration).
 */

import { defineStore } from 'pinia';

export interface AirssSettings {
  rsshubBase: string;
  refreshIntervalMin: number;
}

export const SETTINGS_STORAGE_KEY = 'airss.settings.v1';

export const DEFAULT_SETTINGS: AirssSettings = {
  rsshubBase: 'https://rsshub.app',
  refreshIntervalMin: 120,
};

const REFRESH_MIN = 15;
const REFRESH_MAX = 1440;

interface StorageLocalLike {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function getStorageLocal(): StorageLocalLike | null {
  const c = (globalThis as unknown as { chrome?: { storage?: { local?: StorageLocalLike } } })
    .chrome;
  return c?.storage?.local ?? null;
}

function normalizeBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed;
}

function isValidBase(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function clampRefresh(min: number): number {
  if (!Number.isFinite(min)) return DEFAULT_SETTINGS.refreshIntervalMin;
  return Math.min(REFRESH_MAX, Math.max(REFRESH_MIN, Math.floor(min)));
}

function sanitize(raw: unknown): AirssSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const r = raw as Partial<AirssSettings>;
  const base =
    typeof r.rsshubBase === 'string' && isValidBase(r.rsshubBase)
      ? normalizeBase(r.rsshubBase)
      : DEFAULT_SETTINGS.rsshubBase;
  const refresh =
    typeof r.refreshIntervalMin === 'number'
      ? clampRefresh(r.refreshIntervalMin)
      : DEFAULT_SETTINGS.refreshIntervalMin;
  return { rsshubBase: base, refreshIntervalMin: refresh };
}

interface SettingsState {
  settings: AirssSettings;
  loaded: boolean;
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    settings: { ...DEFAULT_SETTINGS },
    loaded: false,
  }),
  getters: {
    rsshubBase: (s): string => s.settings.rsshubBase,
    refreshIntervalMin: (s): number => s.settings.refreshIntervalMin,
  },
  actions: {
    async load(): Promise<AirssSettings> {
      const local = getStorageLocal();
      if (!local) {
        this.settings = { ...DEFAULT_SETTINGS };
        this.loaded = true;
        return this.settings;
      }
      const out = await local.get(SETTINGS_STORAGE_KEY);
      this.settings = sanitize(out[SETTINGS_STORAGE_KEY]);
      this.loaded = true;
      return this.settings;
    },

    async setRsshubBase(url: string): Promise<boolean> {
      if (!isValidBase(url)) return false;
      const next: AirssSettings = {
        ...this.settings,
        rsshubBase: normalizeBase(url),
      };
      await this._persist(next);
      return true;
    },

    async setRefreshInterval(min: number): Promise<void> {
      const next: AirssSettings = {
        ...this.settings,
        refreshIntervalMin: clampRefresh(min),
      };
      await this._persist(next);
    },

    async _persist(next: AirssSettings): Promise<void> {
      this.settings = next;
      const local = getStorageLocal();
      if (local) await local.set({ [SETTINGS_STORAGE_KEY]: next });
    },

    /** Subscribe to chrome.storage.onChanged so cross-context edits stay in sync. */
    bindStorage(): void {
      const c = (
        globalThis as unknown as {
          chrome?: {
            storage?: {
              onChanged?: {
                addListener(
                  l: (
                    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
                    area: string,
                  ) => void,
                ): void;
              };
            };
          };
        }
      ).chrome;
      const onChanged = c?.storage?.onChanged;
      if (!onChanged) return;
      onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const ch = changes[SETTINGS_STORAGE_KEY];
        if (!ch) return;
        this.settings = sanitize(ch.newValue);
      });
    },
  },
});
