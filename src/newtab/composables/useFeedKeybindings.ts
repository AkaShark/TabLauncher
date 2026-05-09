/**
 * Keyboard navigation for the feed list (P2-lite §4).
 *
 * Bindings (suppressed when an input/textarea/contenteditable is focused):
 *   j / ↓        next item
 *   k / ↑        previous item
 *   o / Enter    open current item URL in a new tab (chrome.tabs.create)
 *   m            toggle read state for the current item
 *   g g          jump to first
 *   G            jump to last
 *   ?            toggle the help overlay
 *
 * Focus model: focusedIndex is -1 on mount (no auto-select). Caller renders
 * `aria-current="true"` and a focus ring on the item at `focusedIndex`.
 */
import { computed, onMounted, onBeforeUnmount, ref, type Ref } from 'vue';
import type { FeedItem } from '@/adapters/feed/types';

export interface UseFeedKeybindingsOptions {
  items: Ref<FeedItem[]>;
  /** Toggle (or mark) read for the given id. */
  onToggleRead: (id: string) => void | Promise<void>;
  /** Optional: scroll a focused item into view. */
  scrollIntoView?: (index: number) => void;
}

export interface UseFeedKeybindingsResult {
  focusedIndex: Ref<number>;
  helpOpen: Ref<boolean>;
  /** Items.length, exposed for templates. */
  count: Ref<number>;
  /** Imperatively set focus (used by click-to-focus, optional). */
  setFocus: (i: number) => void;
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useFeedKeybindings(
  opts: UseFeedKeybindingsOptions,
): UseFeedKeybindingsResult {
  const focusedIndex = ref(-1);
  const helpOpen = ref(false);
  const count = computed(() => opts.items.value.length);
  let lastG = 0;

  function setFocus(i: number): void {
    const len = opts.items.value.length;
    if (len === 0) {
      focusedIndex.value = -1;
      return;
    }
    const clamped = Math.max(0, Math.min(i, len - 1));
    focusedIndex.value = clamped;
    opts.scrollIntoView?.(clamped);
  }

  function next(): void {
    const len = opts.items.value.length;
    if (len === 0) return;
    if (focusedIndex.value < 0) setFocus(0);
    else setFocus(Math.min(focusedIndex.value + 1, len - 1));
  }

  function prev(): void {
    const len = opts.items.value.length;
    if (len === 0) return;
    if (focusedIndex.value < 0) setFocus(0);
    else setFocus(Math.max(0, focusedIndex.value - 1));
  }

  function openCurrent(): void {
    const i = focusedIndex.value;
    if (i < 0) return;
    const it = opts.items.value[i];
    if (!it?.url) return;
    try {
      // active:false → open in background tab (per spec)
      void chrome.tabs.create({ url: it.url, active: false });
    } catch {
      // Fallback for non-extension contexts (tests, dev preview)
      window.open(it.url, '_blank', 'noopener,noreferrer');
    }
    void opts.onToggleRead(it.id);
  }

  function toggleReadCurrent(): void {
    const i = focusedIndex.value;
    if (i < 0) return;
    const it = opts.items.value[i];
    if (!it) return;
    void opts.onToggleRead(it.id);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (isEditableTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // ? toggles help overlay (Shift+/ on US layout — match by key, not code).
    if (e.key === '?') {
      helpOpen.value = !helpOpen.value;
      e.preventDefault();
      return;
    }

    if (helpOpen.value && e.key === 'Escape') {
      helpOpen.value = false;
      e.preventDefault();
      return;
    }

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        next();
        e.preventDefault();
        break;
      case 'k':
      case 'ArrowUp':
        prev();
        e.preventDefault();
        break;
      case 'o':
      case 'Enter':
        openCurrent();
        e.preventDefault();
        break;
      case 'm':
        toggleReadCurrent();
        e.preventDefault();
        break;
      case 'g': {
        const now = Date.now();
        if (now - lastG < 500) {
          setFocus(0);
          lastG = 0;
          e.preventDefault();
        } else {
          lastG = now;
        }
        break;
      }
      case 'G':
        setFocus(opts.items.value.length - 1);
        e.preventDefault();
        break;
      default:
        break;
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown);
  });

  return { focusedIndex, helpOpen, count, setFocus };
}

// Exported separately for unit tests that want to drive handler logic without
// mounting a Vue component.
export function __createKeybindingHandlers(opts: UseFeedKeybindingsOptions): {
  focusedIndex: Ref<number>;
  helpOpen: Ref<boolean>;
  onKeyDown: (e: KeyboardEvent) => void;
  setFocus: (i: number) => void;
} {
  const focusedIndex = ref(-1);
  const helpOpen = ref(false);
  let lastG = 0;

  function setFocus(i: number): void {
    const len = opts.items.value.length;
    if (len === 0) {
      focusedIndex.value = -1;
      return;
    }
    focusedIndex.value = Math.max(0, Math.min(i, len - 1));
    opts.scrollIntoView?.(focusedIndex.value);
  }
  function next(): void {
    const len = opts.items.value.length;
    if (len === 0) return;
    setFocus(focusedIndex.value < 0 ? 0 : Math.min(focusedIndex.value + 1, len - 1));
  }
  function prev(): void {
    const len = opts.items.value.length;
    if (len === 0) return;
    setFocus(focusedIndex.value < 0 ? 0 : Math.max(0, focusedIndex.value - 1));
  }
  function onKeyDown(e: KeyboardEvent): void {
    if (isEditableTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '?') {
      helpOpen.value = !helpOpen.value;
      e.preventDefault();
      return;
    }
    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        next();
        e.preventDefault();
        break;
      case 'k':
      case 'ArrowUp':
        prev();
        e.preventDefault();
        break;
      case 'm': {
        const i = focusedIndex.value;
        if (i >= 0) {
          const it = opts.items.value[i];
          if (it) void opts.onToggleRead(it.id);
        }
        e.preventDefault();
        break;
      }
      case 'o':
      case 'Enter': {
        const i = focusedIndex.value;
        if (i >= 0) {
          const it = opts.items.value[i];
          if (it?.url) {
            try {
              void chrome.tabs.create({ url: it.url, active: false });
            } catch {
              /* test env */
            }
            void opts.onToggleRead(it.id);
          }
        }
        e.preventDefault();
        break;
      }
      case 'g': {
        const now = Date.now();
        if (now - lastG < 500) {
          setFocus(0);
          lastG = 0;
          e.preventDefault();
        } else {
          lastG = now;
        }
        break;
      }
      case 'G':
        setFocus(opts.items.value.length - 1);
        e.preventDefault();
        break;
    }
  }
  return { focusedIndex, helpOpen, onKeyDown, setFocus };
}
