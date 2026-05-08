<script setup lang="ts">
import type { GithubPeriod } from '@/adapters/github/types';

defineProps<{ modelValue: GithubPeriod }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: GithubPeriod): void }>();

const options: { value: GithubPeriod; label: string }[] = [
  { value: 'day', label: 'day' },
  { value: 'week', label: 'week' },
  { value: 'month', label: 'mo' },
];

function pick(v: GithubPeriod): void {
  emit('update:modelValue', v);
}
</script>

<template>
  <div
    class="inline-flex items-baseline gap-3 font-mono text-2xs uppercase tracking-wider2"
    role="tablist"
  >
    <template v-for="(opt, idx) in options" :key="opt.value">
      <span v-if="idx > 0" class="text-hair">·</span>
      <button
        type="button"
        role="tab"
        :aria-selected="modelValue === opt.value"
        class="border-b transition-colors"
        :class="
          modelValue === opt.value
            ? 'border-ink text-ink'
            : 'border-transparent text-muted hover:text-ink'
        "
        @click="pick(opt.value)"
      >
        {{ opt.label }}
      </button>
    </template>
  </div>
</template>
