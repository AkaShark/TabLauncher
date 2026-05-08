<script setup lang="ts">
const rows = [0, 1, 2, 3];
</script>

<template>
  <ul class="divide-y divide-hair" aria-busy="true">
    <li
      v-for="r in rows"
      :key="r"
      class="flex gap-4 py-4 skeleton-pulse"
    >
      <div class="h-[72px] w-[72px] flex-shrink-0 border hairline" />
      <div class="min-w-0 flex-1 space-y-2 pt-1">
        <div class="h-2 w-1/3 bg-hair" />
        <div class="h-3.5 w-5/6 bg-hair" />
        <div class="h-2.5 w-2/3 bg-hair" />
      </div>
    </li>
  </ul>
</template>
