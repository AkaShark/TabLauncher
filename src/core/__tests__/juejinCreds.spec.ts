import { describe, it, expect, beforeEach } from 'vitest';
import { installStorageMock } from '../../../tests/helpers/chromeMock';
import {
  getCreds,
  setCreds,
  clearCreds,
  __JUEJIN_CREDS_STORAGE_KEY,
} from '../juejinCreds';

describe('juejinCreds', () => {
  beforeEach(() => {
    installStorageMock();
  });

  it('getCreds returns null when nothing stored', async () => {
    const c = await getCreds();
    expect(c).toBeNull();
  });

  it('setCreds round-trips uuid + csrfToken with capturedAt', async () => {
    const before = Date.now();
    await setCreds('uuid-1', 'csrf-1,session-1');
    const after = Date.now();
    const c = await getCreds();
    expect(c).not.toBeNull();
    expect(c?.uuid).toBe('uuid-1');
    expect(c?.csrfToken).toBe('csrf-1,session-1');
    expect(c?.capturedAt).toBeGreaterThanOrEqual(before);
    expect(c?.capturedAt).toBeLessThanOrEqual(after);
  });

  it('clearCreds removes the persisted entry', async () => {
    await setCreds('u', 'c,s');
    await clearCreds();
    expect(await getCreds()).toBeNull();
  });

  it('getCreds returns null when stored value is malformed', async () => {
    await chrome.storage.local.set({
      [__JUEJIN_CREDS_STORAGE_KEY]: { uuid: 'only-uuid' },
    });
    expect(await getCreds()).toBeNull();
  });
});
