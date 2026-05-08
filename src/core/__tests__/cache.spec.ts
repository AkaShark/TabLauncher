import { describe, it, expect, beforeEach } from 'vitest';
import { installStorageMock } from '../../../tests/helpers/chromeMock';
import { getCached, setCached, clearCached } from '../cache';

describe('cache', () => {
  beforeEach(() => {
    installStorageMock();
  });

  it('returns null when key missing', async () => {
    const v = await getCached<string>('missing');
    expect(v).toBeNull();
  });

  it('round-trips a value with fetchedAt', async () => {
    const before = Date.now();
    await setCached('foo', { a: 1 });
    const after = Date.now();
    const v = await getCached<{ a: number }>('foo');
    expect(v).not.toBeNull();
    expect(v?.value).toEqual({ a: 1 });
    expect(v?.fetchedAt).toBeGreaterThanOrEqual(before);
    expect(v?.fetchedAt).toBeLessThanOrEqual(after);
  });

  it('clearCached removes the entry', async () => {
    await setCached('foo', 42);
    await clearCached('foo');
    const v = await getCached('foo');
    expect(v).toBeNull();
  });

  it('returns null on malformed entry', async () => {
    await chrome.storage.local.set({ 'airss.cache.bad': 'not-an-object' });
    const v = await getCached('bad');
    expect(v).toBeNull();
  });
});
