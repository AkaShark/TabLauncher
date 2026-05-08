<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useGithubStore } from '@/stores/github';
import { relativeTime } from '@/utils/relativeTime';
import GithubPeriodToggle from './GithubPeriodToggle.vue';
import GithubLanguagePicker from './GithubLanguagePicker.vue';
import FeedSkeleton from './FeedSkeleton.vue';

const github = useGithubStore();

const lastRefreshed = computed(() =>
  github.lastRefreshedAt ? relativeTime(github.lastRefreshedAt) : '',
);

const period = computed({
  get: () => github.config.period,
  set: (v) => {
    void github.updateConfig({ period: v });
  },
});

const lang = computed({
  get: () => github.config.lang,
  set: (v) => {
    void github.updateConfig({ lang: v });
  },
});

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function rank(i: number): string {
  return String(i + 1).padStart(2, '0');
}

function onRepoClick(itemId: string): void {
  void github.markRead(itemId);
}

async function retry(): Promise<void> {
  await github.refresh();
}

onMounted(async () => {
  await github.loadFromCache();
  void github.refresh();
});
</script>

<template>
  <section class="flex h-full flex-col">
    <header class="mb-5 flex items-baseline justify-between">
      <div class="flex items-baseline gap-3">
        <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">III.</span>
        <h2 class="font-display text-[28px] font-light leading-none tracking-tightest text-ink">
          Trending
        </h2>
      </div>
      <span
        v-if="lastRefreshed"
        class="font-mono text-2xs uppercase tracking-wider2 text-muted tabular-nums"
      >
        {{ lastRefreshed }}
      </span>
    </header>

    <!-- Filter rule. -->
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b hairline pb-3">
      <GithubPeriodToggle v-model="period" />
      <GithubLanguagePicker v-model="lang" />
    </div>

    <FeedSkeleton
      v-if="github.loadingState === 'cold-loading' && !github.items.length"
    />

    <div
      v-else-if="github.loadingState === 'error' && github.error"
      class="border-l-2 border-danger pl-3 py-2"
    >
      <p class="font-mono text-2xs uppercase tracking-wider2 text-danger">
        trending unavailable
      </p>
      <p class="mt-1 font-mono text-2xs text-muted">{{ github.error.message }}</p>
      <button
        class="mt-2 border-b hairline pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink hover:border-ink"
        @click="retry"
      >
        retry →
      </button>
    </div>

    <ul
      v-else-if="github.items.length"
      class="flex-1 divide-y divide-hair overflow-y-auto"
    >
      <li
        v-for="(item, idx) in github.items"
        :key="item.id"
        class="group transition-opacity"
        :class="github.readMap[item.id] ? 'opacity-50' : ''"
      >
        <a
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-baseline gap-3 py-3"
          @click="onRepoClick(item.id)"
        >
          <!-- Numeric rank — quiet typographic anchor. -->
          <span
            class="num-display shrink-0 text-[22px] font-light leading-none text-muted tabular-nums"
          >
            {{ rank(idx) }}
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-3">
              <h3
                class="truncate text-[14px] leading-snug text-ink transition-colors group-hover:text-accent"
              >
                <span class="text-muted">{{ item.owner }}</span>
                <span class="text-hair">/</span>
                <span class="font-medium">{{ item.repo }}</span>
              </h3>
              <span
                class="shrink-0 font-mono text-2xs uppercase tracking-wider2 tabular-nums text-muted"
              >
                ★ {{ formatStars(item.stars) }}
              </span>
            </div>
            <p
              v-if="item.description"
              class="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted"
            >
              {{ item.description }}
            </p>
            <div
              v-if="item.language"
              class="mt-1 flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider2 text-muted"
            >
              <span
                class="inline-block h-1.5 w-1.5 rounded-full"
                :style="{ backgroundColor: item.languageColor || 'currentColor' }"
                aria-hidden="true"
              ></span>
              <span>{{ item.language }}</span>
              <span class="text-hair">·</span>
              <span class="tabular-nums">⑂ {{ formatStars(item.forks) }}</span>
            </div>
          </div>
        </a>
      </li>
    </ul>

    <p
      v-else
      class="font-mono text-2xs uppercase tracking-wider2 text-muted"
    >
      — no repos —
    </p>
  </section>
</template>
