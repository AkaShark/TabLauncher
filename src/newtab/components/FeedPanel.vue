<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import FeedCard from './FeedCard.vue';
import FeedSkeleton from './FeedSkeleton.vue';
import FeedTabs from './FeedTabs.vue';
import { useFeedStore } from '@/stores/feed';
import { useSubscriptionsStore } from '@/stores/subscriptions';
import { relativeTime } from '@/utils/relativeTime';

const feed = useFeedStore();
const subs = useSubscriptionsStore();
const detailsOpen = ref(false);

const lastRefreshed = computed(() =>
  feed.lastRefreshedAt ? relativeTime(feed.lastRefreshedAt) : '',
);

const tabs = computed(() => feed.tabs(subs.enabledSources));

const activeTabId = computed(() => feed.activeTabId ?? tabs.value[0]?.id ?? '');

const visibleItems = computed(() => {
  const id = activeTabId.value;
  if (!id) return [];
  return feed.itemsForTab(id, subs.enabledSources).slice(0, 30);
});

function onTabChange(id: string): void {
  void feed.setActiveTab(id);
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
  void feed.refresh();
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

      <ul
        v-if="visibleItems.length"
        class="divide-y divide-hair"
      >
        <FeedCard
          v-for="item in visibleItems"
          :key="item.id"
          :item="item"
          @read="(id) => feed.markRead(id)"
        />
      </ul>

      <p
        v-else
        class="font-mono text-2xs uppercase tracking-wider2 text-muted"
      >
        — empty —
      </p>
    </template>
  </section>
</template>
