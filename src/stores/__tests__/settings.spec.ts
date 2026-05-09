import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { installStorageMock } from '../../../tests/helpers/chromeMock';
import {
  useSettingsStore,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from '../settings';

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installStorageMock();
  });

  it('load() returns defaults when storage is empty', async () => {
    const store = useSettingsStore();
    const s = await store.load();
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(store.rsshubBase).toBe('https://rsshub.app');
    expect(store.refreshIntervalMin).toBe(120);
  });

  it('setRsshubBase rejects invalid URL and accepts http(s); trims trailing /', async () => {
    const store = useSettingsStore();
    await store.load();

    expect(await store.setRsshubBase('not-a-url')).toBe(false);
    expect(await store.setRsshubBase('ftp://example.com')).toBe(false);
    expect(store.rsshubBase).toBe('https://rsshub.app');

    expect(await store.setRsshubBase('https://my.rsshub.test/')).toBe(true);
    expect(store.rsshubBase).toBe('https://my.rsshub.test');

    expect(await store.setRsshubBase('http://localhost:1200///')).toBe(true);
    expect(store.rsshubBase).toBe('http://localhost:1200');
  });

  it('setRefreshInterval clamps to [15, 1440]', async () => {
    const store = useSettingsStore();
    await store.load();

    await store.setRefreshInterval(5);
    expect(store.refreshIntervalMin).toBe(15);

    await store.setRefreshInterval(99999);
    expect(store.refreshIntervalMin).toBe(1440);

    await store.setRefreshInterval(60);
    expect(store.refreshIntervalMin).toBe(60);
  });

  it('persists across loads (round-trip via chrome.storage.local)', async () => {
    const store = useSettingsStore();
    await store.load();
    await store.setRsshubBase('https://my.rsshub.test');
    await store.setRefreshInterval(45);

    setActivePinia(createPinia());
    const fresh = useSettingsStore();
    const loaded = await fresh.load();
    expect(loaded.rsshubBase).toBe('https://my.rsshub.test');
    expect(loaded.refreshIntervalMin).toBe(45);
  });

  it('bindStorage hot-reloads when key changes externally', async () => {
    const store = useSettingsStore();
    await store.load();
    store.bindStorage();

    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: {
        rsshubBase: 'https://other.host',
        refreshIntervalMin: 240,
      },
    });

    expect(store.rsshubBase).toBe('https://other.host');
    expect(store.refreshIntervalMin).toBe(240);
  });

  it('sanitizes malformed stored value to defaults', async () => {
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: { rsshubBase: 12345, refreshIntervalMin: 'oops' },
    });
    const store = useSettingsStore();
    const s = await store.load();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });
});
