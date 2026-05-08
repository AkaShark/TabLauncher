<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  recorded: number;
  range: 7 | 30;
}>();

const denominator = computed(() => props.range);
</script>

<template>
  <div
    class="relative flex h-[120px] flex-col items-start justify-between border-y hairline px-1 py-3"
    role="status"
  >
    <p class="serif-italic text-[15px] font-light text-ink">
      gathering signal —
    </p>
    <div class="flex w-full items-baseline justify-between">
      <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">
        day {{ recorded }} / {{ denominator }}
      </span>
      <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">
        full chart unlocks tomorrow
      </span>
    </div>
    <!-- Tally dashes — one per recorded day. -->
    <div class="absolute inset-x-0 bottom-0 flex h-[3px] items-end">
      <span
        v-for="i in denominator"
        :key="i"
        class="mr-px h-px flex-1"
        :class="i <= recorded ? 'bg-accent' : 'bg-hair'"
      ></span>
    </div>
  </div>
</template>
