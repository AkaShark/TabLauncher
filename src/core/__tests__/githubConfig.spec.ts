import { describe, it, expect, beforeEach } from 'vitest';
import { installStorageMock } from '../../../tests/helpers/chromeMock';
import {
  getConfig,
  setConfig,
  clearConfig,
  __GITHUB_CONFIG_STORAGE_KEY,
} from '../githubConfig';
import { DEFAULT_GITHUB_CONFIG } from '@/adapters/github/types';

describe('githubConfig', () => {
  beforeEach(() => {
    installStorageMock();
  });

  it('getConfig returns defaults when nothing stored', async () => {
    const c = await getConfig();
    expect(c).toEqual(DEFAULT_GITHUB_CONFIG);
  });

  it('setConfig persists full object and getConfig round-trips', async () => {
    const next = await setConfig({
      enabled: true,
      period: 'week',
      lang: 'rust',
      limit: 10,
    });
    expect(next.period).toBe('week');
    const after = await getConfig();
    expect(after.period).toBe('week');
    expect(after.lang).toBe('rust');
    expect(after.limit).toBe(10);
  });

  it('setConfig accepts partial patch and merges', async () => {
    await setConfig({ period: 'month' });
    const c = await getConfig();
    expect(c.period).toBe('month');
    expect(c.lang).toBe(DEFAULT_GITHUB_CONFIG.lang);
    expect(c.limit).toBe(DEFAULT_GITHUB_CONFIG.limit);
  });

  it('getConfig sanitizes malformed stored value to defaults', async () => {
    await chrome.storage.local.set({
      [__GITHUB_CONFIG_STORAGE_KEY]: { period: 'invalid', limit: -5 },
    });
    const c = await getConfig();
    expect(c.period).toBe(DEFAULT_GITHUB_CONFIG.period);
    expect(c.limit).toBe(DEFAULT_GITHUB_CONFIG.limit);
  });

  it('clearConfig removes the persisted entry', async () => {
    await setConfig({ period: 'week' });
    await clearConfig();
    const c = await getConfig();
    expect(c).toEqual(DEFAULT_GITHUB_CONFIG);
  });
});
