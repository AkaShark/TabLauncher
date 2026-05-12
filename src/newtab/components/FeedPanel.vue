<script setup lang="ts">
import { computed, onMounted, ref, nextTick } from 'vue';
import FeedCard from './FeedCard.vue';
import FeedSkeleton from './FeedSkeleton.vue';
import FeedTabs from './FeedTabs.vue';
import { useFeedStore } from '@/stores/feed';
import { useSubscriptionsStore } from '@/stores/subscriptions';
import { relativeTime } from '@/utils/relativeTime';
import { mark, measure, PERF_ENABLED } from '@/utils/perf';
import { useFeedKeybindings } from '@/newtab/composables/useFeedKeybindings';

const feed = useFeedStore();
const subs = useSubscriptionsStore();
const detailsOpen = ref(false);
const listEl = ref<HTMLDivElement | null>(null);

// P2-lite §2: first-paint mark at script-setup top.
mark('feed.firstPaint.start');

const lastRefreshed = computed(() =>
  feed.lastRefreshedAt ? relativeTime(feed.lastRefreshedAt) : '',
);

const tabs = computed(() => feed.tabs(subs.enabledSources));

const activeTabId = computed(() => feed.activeTabId ?? tabs.value[0]?.id ?? '');

// P2-lite (docs/perf-baseline.md): cap raised from 30 → 200 since DOM cost,
// not aggregation, is the bottleneck.
const MAX_VISIBLE = 200;
const visibleItems = computed(() => {
  const id = activeTabId.value;
  if (!id) return [];
  return feed.itemsForTab(id, subs.enabledSources).slice(0, MAX_VISIBLE);
});

const { focusedIndex, helpOpen, setFocus } = useFeedKeybindings({
  items: visibleItems,
  onToggleRead: (id) => feed.markRead(id),
  scrollIntoView: (i) => {
    const ul = listEl.value;
    if (!ul) return;
    const child = ul.children[i] as HTMLElement | undefined;
    child?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
});

const liveMessage = computed(() => {
  if (feed.error?.kind === 'no-sources') return 'No subscriptions yet.';
  if (feed.error?.kind === 'all-failed') return 'All sources failed.';
  if (feed.error?.kind === 'timeout') return 'Refresh timed out.';
  if (feed.error?.kind === 'partial')
    return `${feed.error.failedSources.length} sources failed.`;
  if (feed.loadingState === 'loaded')
    return `Showing ${visibleItems.value.length} items.`;
  return '';
});

function onTabChange(id: string): void {
  void feed.setActiveTab(id);
  // Reset focus when switching tabs.
  focusedIndex.value = -1;
}

function openOptions(): void {
  try {
    chrome.runtime.openOptionsPage();
  } catch {
    /* noop */
  }
}

async function retry(): Promise<void> {
  await feed.refresh();
}

onMounted(async () => {
  feed.bindStorage();
  subs.bindStorage();
  await Promise.all([feed.loadFromCache(), subs.load()]);
  await feed.loadActiveTab(subs.enabledSources);
  const REFRESH_TTL_MS = 30 * 60 * 1000;
  const last = feed.lastRefreshedAt ?? 0;
  if (Date.now() - last >= REFRESH_TTL_MS) {
    void feed.refresh();
  }
  await nextTick();
  if (PERF_ENABLED) {
    mark('feed.firstPaint.end');
    const ms = measure('feed.firstPaint', 'feed.firstPaint.start', 'feed.firstPaint.end');
    if (ms != null) console.debug(`[perf] feed.firstPaint: ${ms.toFixed(2)}ms`);
  }
});
</script>

<template>
  <section class="flex h-full flex-col">
    <!-- Section masthead. -->
    <header class="mb-5 flex items-baseline justify-between">
      <div class="flex items-baseline gap-3">
        <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">II.</span>
        <h2 class="font-display text-[28px] font-light leading-none tracking-tightest text-ink">
          Dispatch
        </h2>
      </div>
      <span
        v-if="lastRefreshed"
        class="font-mono text-2xs uppercase tracking-wider2 text-muted tabular-nums"
      >
        synced · {{ lastRefreshed }}
      </span>
    </header>

    <!-- a11y: announce status changes (empty / partial / all-failed / loaded). -->
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>

    <div
      v-if="feed.error?.kind === 'partial' && feed.error.failedSources.length"
      class="mb-4 border-l-2 border-warn pl-3 py-1.5"
    >
      <button
        class="flex w-full items-center justify-between font-mono text-2xs uppercase tracking-wider2 text-warn"
        @click="detailsOpen = !detailsOpen"
      >
        <span>{{ feed.error.failedSources.length }} sources failed</span>
        <span aria-hidden="true">{{ detailsOpen ? '−' : '+' }}</span>
      </button>
      <ul v-if="detailsOpen" class="mt-2 space-y-1 font-mono text-2xs text-muted">
        <li v-for="f in feed.error.failedSources" :key="f.id">
          → {{ f.label }} — {{ f.reason }}
        </li>
      </ul>
    </div>

    <FeedSkeleton v-if="feed.loadingState === 'cold-loading' && !feed.items.length" />

    <div
      v-else-if="feed.error?.kind === 'no-sources'"
      class="border-t border-b hairline py-12 text-center"
    >
      <p class="font-display text-[22px] italic font-light text-ink">
        no subscriptions yet.
      </p>
      <p class="mt-2 font-mono text-2xs uppercase tracking-wider2 text-muted">
        add a feed to begin the day's dispatch
      </p>
      <button
        class="mt-4 border-b hairline pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink hover:border-ink"
        @click="openOptions"
      >
        open settings →
      </button>
    </div>

    <div
      v-else-if="feed.error?.kind === 'all-failed'"
      class="border-l-2 border-danger pl-3 py-2"
    >
      <p class="font-mono text-2xs uppercase tracking-wider2 text-danger">all sources failed</p>
      <button
        class="mt-2 border-b hairline pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink hover:border-ink"
        @click="retry"
      >
        retry →
      </button>
    </div>

    <div
      v-else-if="feed.error?.kind === 'timeout'"
      class="border-l-2 border-warn pl-3 py-2"
    >
      <p class="font-mono text-2xs uppercase tracking-wider2 text-warn">timeout</p>
      <button
        class="mt-2 border-b hairline pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink hover:border-ink"
        @click="retry"
      >
        retry →
      </button>
    </div>

    <template v-else>
      <FeedTabs
        v-if="tabs.length > 1"
        :tabs="tabs"
        :model-value="activeTabId"
        @update:model-value="onTabChange"
      />

      <div
        v-if="visibleItems.length"
        ref="listEl"
        role="feed"
        :aria-busy="feed.loadingState === 'cold-loading' || feed.loadingState === 'warm-loading'"
        class="divide-y divide-hair"
      >
        <FeedCard
          v-for="(item, i) in visibleItems"
          :key="item.id"
          :item="item"
          :focused="i === focusedIndex"
          @read="(id) => feed.markRead(id)"
          @click="setFocus(i)"
        />
      </div>

      <p
        v-else
        class="font-mono text-2xs uppercase tracking-wider2 text-muted"
      >
        — empty —
      </p>
    </template>

    <!-- Keybinding help overlay (toggled via ?). -->
    <div
      v-if="helpOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      @click="helpOpen = false"
    >
      <div
        class="bg-paper border hairline p-6 max-w-sm w-full"
        @click.stop
      >
        <h3 class="font-display text-lg mb-3">Keyboard shortcuts</h3>
        <dl class="font-mono text-2xs space-y-1.5 text-ink">
          <div class="flex justify-between"><dt>j / ↓</dt><dd>next item</dd></div>
          <div class="flex justify-between"><dt>k / ↑</dt><dd>previous item</dd></div>
          <div class="flex justify-between"><dt>o / Enter</dt><dd>open in new tab</dd></div>
          <div class="flex justify-between"><dt>m</dt><dd>mark read</dd></div>
          <div class="flex justify-between"><dt>g g</dt><dd>jump to first</dd></div>
          <div class="flex justify-between"><dt>G</dt><dd>jump to last</dd></div>
          <div class="flex justify-between"><dt>?</dt><dd>toggle this help</dd></div>
        </dl>
        <button
          class="mt-4 border-b hairline pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink hover:border-ink"
          @click="helpOpen = false"
        >
          close
        </button>
      </div>
    </div>
  </section>
</template>
