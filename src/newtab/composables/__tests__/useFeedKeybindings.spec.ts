import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { __createKeybindingHandlers } from '../useFeedKeybindings';
import type { FeedItem } from '@/adapters/feed/types';

function makeItem(id: string, url = `https://x/${id}`): FeedItem {
  return {
    id,
    sourceId: 's1',
    sourceLabel: 'S',
    title: id,
    url,
    publishedAt: 0,
    summary: '',
    thumbnail: null,
    isRead: false,
  };
}

function key(k: string, opts: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: k, bubbles: true, ...opts });
}

describe('useFeedKeybindings', () => {
  beforeEach(() => {
    // chrome.tabs is provided by jest-webextension-mock but tabs.create may
    // be undefined; install a stub to keep `o`/Enter happy.
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      ...(globalThis as unknown as { chrome?: typeof chrome }).chrome,
      tabs: { create: vi.fn() },
    } as unknown as typeof chrome;
  });

  it('j/k navigate within bounds; starts at -1', () => {
    const items = ref([makeItem('a'), makeItem('b'), makeItem('c')]);
    const { focusedIndex, onKeyDown } = __createKeybindingHandlers({
      items,
      onToggleRead: () => {},
    });
    expect(focusedIndex.value).toBe(-1);
    onKeyDown(key('j'));
    expect(focusedIndex.value).toBe(0);
    onKeyDown(key('j'));
    expect(focusedIndex.value).toBe(1);
    onKeyDown(key('j'));
    onKeyDown(key('j')); // clamp at 2
    expect(focusedIndex.value).toBe(2);
    onKeyDown(key('k'));
    expect(focusedIndex.value).toBe(1);
    onKeyDown(key('k'));
    onKeyDown(key('k')); // clamp at 0
    expect(focusedIndex.value).toBe(0);
  });

  it('arrow keys are aliases for j/k', () => {
    const items = ref([makeItem('a'), makeItem('b')]);
    const { focusedIndex, onKeyDown } = __createKeybindingHandlers({
      items,
      onToggleRead: () => {},
    });
    onKeyDown(key('ArrowDown'));
    expect(focusedIndex.value).toBe(0);
    onKeyDown(key('ArrowDown'));
    expect(focusedIndex.value).toBe(1);
    onKeyDown(key('ArrowUp'));
    expect(focusedIndex.value).toBe(0);
  });

  it('suppressed when an input is focused', () => {
    const items = ref([makeItem('a'), makeItem('b')]);
    const { focusedIndex, onKeyDown } = __createKeybindingHandlers({
      items,
      onToggleRead: () => {},
    });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const ev = new KeyboardEvent('keydown', { key: 'j', bubbles: true });
    Object.defineProperty(ev, 'target', { value: input });
    onKeyDown(ev);
    expect(focusedIndex.value).toBe(-1); // unchanged
    input.remove();
  });

  it('m toggles read for the focused item', () => {
    const items = ref([makeItem('a'), makeItem('b')]);
    const onToggleRead = vi.fn();
    const { onKeyDown, setFocus } = __createKeybindingHandlers({
      items,
      onToggleRead,
    });
    setFocus(1);
    onKeyDown(key('m'));
    expect(onToggleRead).toHaveBeenCalledWith('b');
  });

  it('o opens current via chrome.tabs.create and marks read', () => {
    const items = ref([makeItem('a', 'https://example.com/a')]);
    const onToggleRead = vi.fn();
    const create = vi.fn();
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      tabs: { create },
    } as unknown as typeof chrome;
    const { onKeyDown, setFocus } = __createKeybindingHandlers({
      items,
      onToggleRead,
    });
    setFocus(0);
    onKeyDown(key('o'));
    expect(create).toHaveBeenCalledWith({ url: 'https://example.com/a', active: false });
    expect(onToggleRead).toHaveBeenCalledWith('a');
  });

  it('gg jumps to first, G jumps to last', () => {
    const items = ref([makeItem('a'), makeItem('b'), makeItem('c'), makeItem('d')]);
    const { focusedIndex, onKeyDown, setFocus } = __createKeybindingHandlers({
      items,
      onToggleRead: () => {},
    });
    setFocus(2);
    onKeyDown(key('G'));
    expect(focusedIndex.value).toBe(3);
    onKeyDown(key('g'));
    onKeyDown(key('g'));
    expect(focusedIndex.value).toBe(0);
  });

  it('? toggles help overlay', () => {
    const items = ref([makeItem('a')]);
    const { helpOpen, onKeyDown } = __createKeybindingHandlers({
      items,
      onToggleRead: () => {},
    });
    expect(helpOpen.value).toBe(false);
    onKeyDown(key('?'));
    expect(helpOpen.value).toBe(true);
    onKeyDown(key('?'));
    expect(helpOpen.value).toBe(false);
  });

  it('does nothing on empty list', () => {
    const items = ref<FeedItem[]>([]);
    const { focusedIndex, onKeyDown } = __createKeybindingHandlers({
      items,
      onToggleRead: () => {},
    });
    onKeyDown(key('j'));
    onKeyDown(key('G'));
    expect(focusedIndex.value).toBe(-1);
  });
});
