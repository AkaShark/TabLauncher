<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ShortcutsWidget from './components/ShortcutsWidget.vue';
import TaskPanel from './components/TaskPanel.vue';
import FeedPanel from './components/FeedPanel.vue';
import GithubPanel from './components/GithubPanel.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const now = ref(new Date());

const dateLine = computed(() => {
  const d = now.value;
  const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
  const mon = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ][d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  return `${dow} · ${day} ${mon} · ${d.getFullYear()}`;
});

function openOptions(): void {
  try {
    chrome.runtime.openOptionsPage();
  } catch {
    /* noop */
  }
}

onMounted(async () => {
  await auth.hydrate();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['airss.tokens']) {
      void auth.hydrate();
    }
  });
  // Tick the date every minute — cheap, no animation.
  setInterval(() => (now.value = new Date()), 60_000);
});
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-[1480px] flex-col px-10 pt-7 pb-10">
    <!-- Top bar: editorial strip, no big header. -->
    <header
      class="flex items-baseline justify-between border-b hairline pb-4"
    >
      <div class="flex items-baseline gap-6">
        <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">
          {{ dateLine }}
        </span>
        <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">
          № 001
        </span>
      </div>

      <div class="flex flex-col items-center leading-none">
        <span
          class="serif-italic text-[26px] font-light leading-none text-ink"
          aria-label="AIRSS Dashboard"
        >
          AIRSS
        </span>
        <span class="mt-1 font-mono text-[9px] uppercase tracking-wider2 text-muted">
          a quiet desk
        </span>
      </div>

      <div class="flex items-baseline gap-4">
        <span class="font-mono text-2xs uppercase tracking-wider2">
          <span class="text-muted">TickTick</span>
          <span class="ml-2" :class="auth.connected ? 'text-accent' : 'text-muted'">
            {{ auth.connected ? '● online' : '○ offline' }}
          </span>
        </span>
        <button
          class="group relative font-mono text-2xs uppercase tracking-wider2 text-muted transition-colors hover:text-ink"
          @click="openOptions"
        >
          settings
          <span
            class="absolute -bottom-0.5 left-0 h-px w-0 bg-ink transition-all group-hover:w-full"
          ></span>
        </button>
      </div>
    </header>

    <!-- Sectional rule with edition number — wink at editorial papers. -->
    <div class="flex items-center justify-between pt-3 pb-6">
      <p class="serif-italic text-[15px] font-light text-muted">
        a daily ledger of work, words &amp; signal.
      </p>
      <p class="font-mono text-2xs uppercase tracking-wider2 text-muted">
        vol. {{ now.getFullYear() }} — wk
        {{ Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7).toString().padStart(2, '0') }}
      </p>
    </div>

    <!-- Three-column ledger. Hairline dividers, no card shells. -->
    <section
      class="grid flex-1 gap-0 grid-cols-1 lg:grid-cols-[260px_1fr_360px] lg:divide-x divide-hair stagger-in"
    >
      <aside aria-label="Tasks" class="lg:pr-8">
        <ShortcutsWidget />
        <TaskPanel />
      </aside>
      <section aria-label="Feeds" class="lg:px-8">
        <FeedPanel />
      </section>
      <section aria-label="GitHub Trending" class="lg:pl-8">
        <GithubPanel />
      </section>
    </section>
  </main>
</template>
