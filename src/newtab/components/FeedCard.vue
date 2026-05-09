<script setup lang="ts">
import { computed } from 'vue';
import type { FeedItem } from '@/adapters/feed/types';
import { relativeTime } from '@/utils/relativeTime';

const props = defineProps<{ item: FeedItem; focused?: boolean }>();
const emit = defineEmits<{
  (e: 'read', id: string): void;
  (e: 'click'): void;
}>();

const time = computed(() =>
  props.item.publishedAt ? relativeTime(props.item.publishedAt) : '—',
);

const initial = computed(() => {
  const ch = props.item.sourceLabel?.[0] ?? props.item.title?.[0] ?? '·';
  return ch.toUpperCase();
});

function onClick(): void {
  emit('read', props.item.id);
  emit('click');
}
</script>

<template>
  <article
    class="group transition-opacity duration-200 ease-out"
    :class="[
      item.isRead ? 'opacity-50' : '',
      focused ? 'ring-2 ring-amber-500 ring-inset' : '',
    ]"
    :aria-label="item.title"
    :aria-current="focused ? 'true' : undefined"
  >
    <a
      :href="item.url"
      target="_blank"
      rel="noopener noreferrer"
      class="flex gap-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset"
      @click="onClick"
    >
      <!-- Thumbnail or typographic placeholder. No gradients, no purple. -->
      <div
        class="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden border hairline"
      >
        <img
          v-if="item.thumbnail"
          :src="item.thumbnail"
          :alt="item.title"
          loading="lazy"
          referrerpolicy="no-referrer"
          class="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center bg-paper"
          aria-hidden="true"
        >
          <span class="num-display text-3xl font-light leading-none text-muted">
            {{ initial }}
          </span>
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <!-- Source · time strip on top, editorial-style. -->
        <p
          class="mb-1 flex items-baseline gap-2 font-mono text-2xs uppercase tracking-wider2 text-muted"
        >
          <span class="truncate">{{ item.sourceLabel }}</span>
          <span class="text-hair" aria-hidden="true">/</span>
          <span class="tabular-nums whitespace-nowrap">{{ time }}</span>
        </p>
        <h3
          class="line-clamp-2 font-display text-[16px] leading-snug text-ink"
          :class="item.isRead ? 'font-light' : 'font-normal'"
        >
          {{ item.title }}
        </h3>
        <p
          v-if="item.summary"
          class="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted"
        >
          {{ item.summary }}
        </p>
      </div>
    </a>
  </article>
</template>
