<script setup lang="ts">
export interface FeedTab {
  id: string;
  label: string;
  unreadCount: number;
}

const props = defineProps<{
  tabs: FeedTab[];
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function select(id: string): void {
  emit('update:modelValue', id);
}

function badge(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}
</script>

<template>
  <div
    class="mb-5 flex items-baseline gap-6 overflow-x-auto border-b hairline pb-3"
    role="tablist"
  >
    <button
      v-for="tab in props.tabs"
      :key="tab.id"
      role="tab"
      :aria-selected="tab.id === props.modelValue"
      class="group relative shrink-0 font-mono text-2xs uppercase tracking-wider2 transition-colors"
      :class="
        tab.id === props.modelValue
          ? 'text-ink'
          : 'text-muted hover:text-ink'
      "
      @click="select(tab.id)"
    >
      <span>{{ tab.label }}</span>
      <span
        v-if="badge(tab.unreadCount)"
        class="ml-1.5 tabular-nums"
        :class="tab.id === props.modelValue ? 'text-accent' : 'text-muted'"
      >
        ({{ badge(tab.unreadCount) }})
      </span>
      <!-- Underline indicator: thicker on active, hover-extending otherwise. -->
      <span
        class="absolute -bottom-3 left-0 h-px transition-all"
        :class="
          tab.id === props.modelValue
            ? 'w-full bg-ink'
            : 'w-0 bg-ink group-hover:w-full'
        "
      ></span>
    </button>
  </div>
</template>
