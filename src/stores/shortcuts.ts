import { defineStore } from 'pinia';
import * as repo from '@/core/shortcuts';
import type { Shortcut } from '@/core/shortcuts';

interface State {
  items: Shortcut[];
  loaded: boolean;
}

export const useShortcutsStore = defineStore('shortcuts', {
  state: (): State => ({ items: [], loaded: false }),
  actions: {
    async load(): Promise<void> {
      this.items = await repo.getAll();
      this.loaded = true;
    },

    /** Wire chrome.storage.onChanged so cross-context edits keep the UI live. */
    bindStorage(): void {
      try {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== 'local') return;
          if ('airss.shortcuts' in changes) void this.load();
        });
      } catch {
        /* noop in tests */
      }
    },

    async add(label: string, url: string): Promise<void> {
      await repo.add({ label, url });
      await this.load();
    },

    async remove(id: string): Promise<void> {
      await repo.remove(id);
      await this.load();
    },

    async update(id: string, patch: { label?: string; url?: string }): Promise<void> {
      await repo.update(id, patch);
      await this.load();
    },

    async reorder(ids: string[]): Promise<void> {
      await repo.reorder(ids);
      await this.load();
    },
  },
});
