<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useTasksStore } from '@/stores/tasks';
import type { NormalizedTask } from '@/adapters/ticktick/types';
import TaskItem from './TaskItem.vue';
import TaskDetailModal from './TaskDetailModal.vue';
import Skeleton from './Skeleton.vue';

const tasks = useTasksStore();

const showSkeleton = computed(
  () => tasks.loadingState === 'cold-loading' && tasks.today.length === 0,
);
const showError = computed(
  () => tasks.loadingState === 'error' && tasks.today.length === 0 && !!tasks.error,
);

const totalCount = computed(() => tasks.today.length);
const pendingCount = computed(() => tasks.today.filter((t) => !t.completed).length);

const selectedId = ref<string | null>(null);
const selectedTask = computed<NormalizedTask | null>(() =>
  selectedId.value ? tasks.today.find((t) => t.id === selectedId.value) ?? null : null,
);

function openTask(task: NormalizedTask): void {
  selectedId.value = task.id;
}
function closeTask(): void {
  selectedId.value = null;
}

const draft = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
const submitting = ref(false);
const createError = ref<string | null>(null);

async function reconnect(): Promise<void> {
  await chrome.runtime.sendMessage({ type: 'auth/connect' });
  await refresh();
}

async function refresh(): Promise<void> {
  await tasks.refresh();
}

async function submitDraft(): Promise<void> {
  const title = draft.value.trim();
  if (!title || submitting.value) return;
  submitting.value = true;
  createError.value = null;
  try {
    await tasks.create(title);
    draft.value = '';
    await nextTick();
    inputRef.value?.focus();
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e);
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await tasks.loadFromCache();
  await tasks.refresh();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Section masthead. -->
    <div class="mb-5 flex items-baseline gap-3">
      <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">I.</span>
      <h2 class="font-display text-[28px] font-light leading-none tracking-tightest text-ink">
        Today
      </h2>
    </div>

    <!-- Total count headline. No ratio, no progress bar. -->
    <div class="flex items-end gap-3">
      <span class="num-display text-[88px] font-light leading-[0.85] text-ink tabular-nums">
        {{ totalCount }}
      </span>
      <div class="flex flex-col items-start pb-2">
        <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">
          {{ totalCount === 1 ? 'task' : 'tasks' }}
        </span>
        <span
          v-if="pendingCount !== totalCount"
          class="mt-1 font-mono text-2xs uppercase tracking-wider2 text-muted tabular-nums"
        >
          {{ pendingCount }} pending
        </span>
      </div>
    </div>

    <!-- Quick add. -->
    <form
      class="mt-6 flex items-center gap-2 border-b hairline pb-2 transition-colors focus-within:border-ink"
      @submit.prevent="submitDraft"
    >
      <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">+</span>
      <input
        ref="inputRef"
        v-model="draft"
        type="text"
        :disabled="submitting"
        placeholder="add a task — press enter"
        class="flex-1 bg-transparent py-1 text-[14px] text-ink outline-none placeholder:text-muted/70"
        :aria-label="'添加新任务'"
        autocomplete="off"
      />
      <button
        v-if="draft.trim()"
        type="submit"
        :disabled="submitting"
        class="font-mono text-2xs uppercase tracking-wider2 text-ink disabled:text-muted"
      >
        {{ submitting ? '…' : '↵' }}
      </button>
    </form>
    <p
      v-if="createError"
      class="mt-1 font-mono text-2xs uppercase tracking-wider2 text-danger"
    >
      {{ createError }}
    </p>

    <!-- Tasks list. -->
    <section class="mt-5 flex-1 min-h-0">
      <Skeleton v-if="showSkeleton" />

      <div
        v-else-if="showError && tasks.error?.kind === 'token-expired'"
        class="border-l-2 border-warn pl-3 py-2"
      >
        <p class="font-mono text-2xs uppercase tracking-wider2 text-warn">
          Auth expired
        </p>
        <p class="mt-1 text-sm text-ink">TickTick 授权已过期。</p>
        <button
          class="mt-2 border-b hairline pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink hover:border-ink"
          @click="reconnect"
        >
          重新连接 →
        </button>
      </div>

      <div
        v-else-if="showError && tasks.error?.kind === 'timeout'"
        class="border-l-2 border-muted pl-3 py-2"
      >
        <p class="font-mono text-2xs uppercase tracking-wider2 text-muted">timeout</p>
        <button
          class="mt-2 border-b hairline pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink hover:border-ink"
          @click="refresh"
        >
          retry →
        </button>
      </div>

      <div
        v-else-if="showError"
        class="border-l-2 border-danger pl-3 py-2"
      >
        <p class="font-mono text-2xs uppercase tracking-wider2 text-danger">error</p>
        <p class="mt-1 text-sm text-ink">{{ tasks.error?.message }}</p>
        <button
          class="mt-2 border-b hairline pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink hover:border-ink"
          @click="refresh"
        >
          retry →
        </button>
      </div>

      <ul
        v-else-if="tasks.today.length > 0"
        class="divide-y divide-hair overflow-y-auto"
      >
        <TaskItem
          v-for="t in tasks.today"
          :key="t.id"
          :task="t"
          @open="openTask"
        />
      </ul>

      <p
        v-else
        class="font-mono text-2xs uppercase tracking-wider2 text-muted"
      >
        — inbox zero —
      </p>
    </section>

    <TaskDetailModal :task="selectedTask" @close="closeTask" />
  </div>
</template>
