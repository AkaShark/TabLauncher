<script setup lang="ts">
defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

interface LangOption {
  value: string;
  label: string;
}

const options: LangOption[] = [
  { value: '', label: 'all' },
  { value: 'swift', label: 'swift' },
  { value: 'javascript', label: 'js' },
  { value: 'typescript', label: 'ts' },
  { value: 'python', label: 'python' },
  { value: 'go', label: 'go' },
  { value: 'rust', label: 'rust' },
  { value: 'kotlin', label: 'kotlin' },
  { value: 'java', label: 'java' },
  { value: 'cpp', label: 'c++' },
  { value: 'c', label: 'c' },
  { value: 'ruby', label: 'ruby' },
  { value: 'php', label: 'php' },
  { value: 'dart', label: 'dart' },
  { value: 'objective-c', label: 'obj-c' },
];

function onChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value;
  emit('update:modelValue', v);
}
</script>

<template>
  <select
    class="airss-select border-b hairline bg-transparent py-0.5 pl-1 font-mono text-2xs uppercase tracking-wider2 text-ink outline-none transition-colors hover:border-ink focus:border-ink"
    :value="modelValue"
    @change="onChange"
  >
    <option v-for="opt in options" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </option>
  </select>
</template>
