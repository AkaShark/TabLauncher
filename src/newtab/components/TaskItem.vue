<script setup lang="ts">
import { ref } from 'vue';
import type { NormalizedTask } from '@/adapters/ticktick/types';
import { useTasksStore } from '@/stores/tasks';

const props = defineProps<{ task: NormalizedTask }>();
const emit = defineEmits<{ (e: 'open', task: NormalizedTask): void }>();

const tasks = useTasksStore();
const failed = ref(false);
const busy = ref(false);

function priorityMark(p: number): string {
  if (p >= 5) return 'H';
  if (p >= 3) return 'M';
  if (p >= 1) return 'L';
  return '';
}

function priorityClass(p: number): string {
  if (p >= 5) return 'text-danger';
  if (p >= 3) return 'text-warn';
  if (p >= 1) return 'text-muted';
  return 'text-muted';
}

function fmtDue(due: string | null): string {
  if (!due) return '';
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(/\s/g, '');
}

async function onToggle(): Promise<void> {
  if (props.task.completed || busy.value) return;
  busy.value = true;
  failed.value = false;
  try {
    await tasks.toggle(props.task.id);
  } catch {
    failed.value = true;
  } finally {
    busy.value = false;
  }
}

function openDetail(): void {
  emit('open', props.task);
}
</script>

<template>
  <li class="group relative flex items-baseline gap-3 py-2.5 transition-colors">
    <input
      type="checkbox"
      class="airss-check mt-1 shrink-0"
      :checked="task.completed"
      :disabled="task.completed || busy"
      :aria-label="`标记完成：${task.title}`"
      @change="onToggle"
    />
    <button
      type="button"
      class="min-w-0 flex-1 cursor-pointer text-left transition-colors"
      :aria-label="`查看任务详情：${task.title}`"
      @click="openDetail"
    >
      <p
        class="truncate text-[14px] leading-snug transition-colors"
        :class="
          task.completed
            ? 'text-muted line-through decoration-muted'
            : 'text-ink group-hover:text-accent'
        "
      >
        <span
          v-if="priorityMark(task.priority)"
          class="mr-1.5 align-baseline font-mono text-2xs uppercase tracking-wider2"
          :class="priorityClass(task.priority)"
          :title="`priority: ${task.priority}`"
        >
          {{ priorityMark(task.priority) }}
        </span>
        {{ task.title }}
      </p>
      <p
        v-if="task.projectName || task.dueDate"
        class="mt-0.5 truncate font-mono text-2xs uppercase tracking-wider2 text-muted"
      >
        <span v-if="task.projectName">{{ task.projectName }}</span>
        <span v-if="task.projectName && task.dueDate" class="px-1.5 text-hair">/</span>
        <span v-if="task.dueDate" class="tabular-nums">{{ fmtDue(task.dueDate) }}</span>
        <span v-if="task.content" class="px-1.5 text-hair">/</span>
        <span v-if="task.content" class="text-muted">notes</span>
      </p>
      <p
        v-if="failed"
        class="mt-1 font-mono text-2xs uppercase tracking-wider2 text-danger"
      >
        sync failed — click to retry
      </p>
    </button>
  </li>
</template>
