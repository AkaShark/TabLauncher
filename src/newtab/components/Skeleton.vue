<script setup lang="ts">
const rows = [0, 1, 2, 3];
</script>

<template>
  <ul class="divide-y divide-hair" aria-busy="true" aria-label="Loading tasks">
    <li
      v-for="r in rows"
      :key="r"
      class="flex items-baseline gap-3 py-3 skeleton-pulse"
    >
      <div class="h-3.5 w-3.5 shrink-0 border hairline" />
      <div class="flex-1 space-y-1.5">
        <div class="h-3 w-3/4 bg-hair" />
        <div class="h-2 w-1/3 bg-hair" />
      </div>
    </li>
  </ul>
</template>
