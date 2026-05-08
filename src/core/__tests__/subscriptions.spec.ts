import { describe, it, expect, beforeEach } from 'vitest';
import { installStorageMock } from '../../../tests/helpers/chromeMock';
import { add, remove, toggle, getAll } from '../subscriptions';

describe('subscriptions', () => {
  beforeEach(() => {
    installStorageMock();
  });

  it('case 1: add twice with the same url — second call returns existing (no duplicate)', async () => {
    const first = await add({ type: 'rss', url: 'https://example.com/feed', label: 'Example' });
    const second = await add({ type: 'rss', url: 'https://example.com/feed', label: 'Example Dupe' });
    expect(first.id).toBe(second.id);
    const all = await getAll();
    expect(all).toHaveLength(1);
  });

  it('case 2: remove — item is no longer in list', async () => {
    const cfg = await add({ type: 'rss', url: 'https://example.com/1', label: 'Feed 1' });
    await add({ type: 'rss', url: 'https://example.com/2', label: 'Feed 2' });
    await remove(cfg.id);
    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all.find((s) => s.id === cfg.id)).toBeUndefined();
  });

  it('case 3: toggle inverts the enabled field', async () => {
    const cfg = await add({ type: 'rss', url: 'https://example.com/toggle', label: 'Toggle Me' });
    expect(cfg.enabled).toBe(true);

    const toggled = await toggle(cfg.id);
    expect(toggled?.enabled).toBe(false);

    const reToggled = await toggle(cfg.id);
    expect(reToggled?.enabled).toBe(true);
  });

  it('getAll returns empty array when storage is empty', async () => {
    const all = await getAll();
    expect(all).toEqual([]);
  });

  it('toggle returns null for unknown id', async () => {
    const result = await toggle('nonexistent-id');
    expect(result).toBeNull();
  });
});
