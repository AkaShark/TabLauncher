<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useShortcutsStore } from '@/stores/shortcuts';

const shortcuts = useShortcutsStore();
const items = computed(() => shortcuts.items);

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function faviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host(url))}&sz=64`;
}

function initial(label: string, url: string): string {
  const ch = label?.trim()?.[0] ?? '';
  if (ch) return ch.toUpperCase();
  return (host(url)[0] ?? '·').toUpperCase();
}

// Track which items failed to load favicons; fall back to letter.
const failed = ref<Record<string, boolean>>({});
function onError(id: string): void {
  failed.value = { ...failed.value, [id]: true };
}

function openOptions(): void {
  try {
    chrome.runtime.openOptionsPage();
  } catch {
    /* noop */
  }
}

onMounted(async () => {
  shortcuts.bindStorage();
  await shortcuts.load();
});
</script>

<template>
  <section class="mb-7" aria-label="Shortcuts">
    <header class="mb-3 flex items-baseline justify-between">
      <div class="flex items-baseline gap-3">
        <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">§</span>
        <h2 class="font-mono text-2xs uppercase tracking-wider2 text-ink">
          quick links
        </h2>
      </div>
      <button
        type="button"
        class="font-mono text-2xs uppercase tracking-wider2 text-muted transition-colors hover:text-ink"
        @click="openOptions"
      >
        manage →
      </button>
    </header>

    <ul
      v-if="items.length"
      class="grid grid-cols-5 gap-px border hairline bg-hair"
    >
      <li v-for="s in items" :key="s.id" class="bg-paper">
        <a
          :href="s.url"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex aspect-square items-center justify-center transition-colors hover:bg-hair/40"
          :title="`${s.label} — ${host(s.url)}`"
          :aria-label="s.label || host(s.url)"
        >
          <img
            v-if="!failed[s.id]"
            :src="faviconUrl(s.url)"
            :alt="s.label"
            loading="lazy"
            referrerpolicy="no-referrer"
            class="h-5 w-5 transition-transform duration-200 ease-out group-hover:scale-110"
            @error="onError(s.id)"
          />
          <span
            v-else
            class="num-display text-[20px] font-light leading-none text-muted transition-colors group-hover:text-accent"
          >
            {{ initial(s.label, s.url) }}
          </span>
        </a>
      </li>
    </ul>

    <button
      v-else
      type="button"
      class="block w-full border-y hairline py-4 text-center font-mono text-2xs uppercase tracking-wider2 text-muted transition-colors hover:text-ink"
      @click="openOptions"
    >
      + add shortcuts in settings
    </button>
  </section>
</template>
