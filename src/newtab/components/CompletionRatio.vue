<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  done: number;
  total: number;
}>();

const pct = computed(() =>
  props.total === 0 ? 0 : Math.min(1, props.done / props.total),
);
const pctLabel = computed(() => Math.round(pct.value * 100));
</script>

<template>
  <div :aria-label="`已完成 ${done} / ${total}`">
    <div class="flex items-end gap-3">
      <span class="num-display text-[88px] font-light leading-[0.85] text-ink">
        {{ done }}
      </span>
      <div class="flex flex-col items-start pb-2">
        <span class="font-mono text-xs text-muted">/ {{ total }}</span>
        <span class="mt-1 font-mono text-2xs uppercase tracking-wider2 text-muted tabular-nums">
          {{ pctLabel }}%
        </span>
      </div>
    </div>
    <!-- Progress meter as a thin moving rule, not a ring. -->
    <div class="mt-3 h-px w-full bg-hair">
      <div
        class="h-px bg-accent transition-[width] duration-300 ease-out"
        :style="{ width: `${pctLabel}%` }"
      ></div>
    </div>
  </div>
</template>
