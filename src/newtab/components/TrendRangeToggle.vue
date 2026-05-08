<script setup lang="ts">
const props = defineProps<{
  modelValue: 7 | 30;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: 7 | 30];
}>();

function pick(r: 7 | 30): void {
  if (props.modelValue !== r) emit('update:modelValue', r);
}
</script>

<template>
  <div
    class="inline-flex items-baseline gap-3 font-mono text-2xs uppercase tracking-wider2"
    role="tablist"
    aria-label="趋势范围"
  >
    <button
      type="button"
      role="tab"
      :aria-selected="modelValue === 7"
      class="border-b transition-colors"
      :class="
        modelValue === 7
          ? 'border-ink text-ink'
          : 'border-transparent text-muted hover:text-ink'
      "
      @click="pick(7)"
    >
      7d
    </button>
    <span class="text-hair">·</span>
    <button
      type="button"
      role="tab"
      :aria-selected="modelValue === 30"
      class="border-b transition-colors"
      :class="
        modelValue === 30
          ? 'border-ink text-ink'
          : 'border-transparent text-muted hover:text-ink'
      "
      @click="pick(30)"
    >
      30d
    </button>
  </div>
</template>
