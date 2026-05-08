<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { NormalizedTask } from '@/adapters/ticktick/types';
import { useTasksStore } from '@/stores/tasks';
import { renderMarkdown } from '@/utils/markdown';

const props = defineProps<{ task: NormalizedTask | null }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const tasks = useTasksStore();

const open = computed(() => props.task !== null);
const renderedContent = computed(() =>
  props.task?.content ? renderMarkdown(props.task.content) : '',
);

const editing = ref(false);
const draftTitle = ref('');
const draftContent = ref('');
const draftDesc = ref('');
const saving = ref(false);
const saveError = ref<string | null>(null);

function fmtDateTime(iso: string | null, allDay = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (allDay) {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PRIORITY_LABELS: Record<number, string> = {
  0: 'none',
  1: 'low',
  3: 'medium',
  5: 'high',
};

function priorityLabel(p: number): string {
  return PRIORITY_LABELS[p] ?? `lvl ${p}`;
}

function close(): void {
  if (editing.value && (isDirty.value || saving.value)) {
    if (saving.value) return;
    if (!window.confirm('放弃未保存的修改？')) return;
  }
  editing.value = false;
  saveError.value = null;
  emit('close');
}

function startEdit(): void {
  if (!props.task) return;
  draftTitle.value = props.task.title;
  draftContent.value = props.task.content;
  draftDesc.value = props.task.desc;
  saveError.value = null;
  editing.value = true;
}

function cancelEdit(): void {
  if (saving.value) return;
  if (isDirty.value && !window.confirm('放弃未保存的修改？')) return;
  editing.value = false;
  saveError.value = null;
}

const isDirty = computed(() => {
  if (!props.task) return false;
  return (
    draftTitle.value !== props.task.title ||
    draftContent.value !== props.task.content ||
    draftDesc.value !== props.task.desc
  );
});

async function saveEdit(): Promise<void> {
  if (!props.task || saving.value) return;
  const title = draftTitle.value.trim();
  if (!title) {
    saveError.value = 'title cannot be empty';
    return;
  }
  saving.value = true;
  saveError.value = null;
  try {
    await tasks.update(props.task.id, {
      title,
      content: draftContent.value,
      desc: draftDesc.value,
    });
    editing.value = false;
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (editing.value) cancelEdit();
    else close();
  }
  // Cmd/Ctrl + Enter to save
  if (editing.value && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    void saveEdit();
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));

watch(open, (v) => {
  document.body.style.overflow = v ? 'hidden' : '';
  if (!v) {
    editing.value = false;
    saveError.value = null;
  }
});

// If the underlying task swaps (different id), reset edit state.
watch(
  () => props.task?.id,
  () => {
    editing.value = false;
    saveError.value = null;
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && task"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-6 py-16"
      role="dialog"
      aria-modal="true"
      :aria-label="task.title"
      @click.self="close"
    >
      <div
        class="absolute inset-0 bg-paper/80"
        aria-hidden="true"
        @click="close"
      ></div>

      <article
        class="relative w-full max-w-[640px] border hairline bg-paper px-9 py-8 shadow-[0_1px_0_rgb(0_0_0/0.04)]"
      >
        <header class="mb-6 flex items-baseline justify-between border-b hairline pb-4">
          <div class="flex items-baseline gap-3 truncate">
            <span class="font-mono text-2xs uppercase tracking-wider2 text-muted">
              entry №
            </span>
            <span class="truncate font-mono text-2xs uppercase tracking-wider2 text-ink tabular-nums">
              {{ task.id.slice(-6) }}
            </span>
            <span class="text-hair">·</span>
            <span class="truncate font-mono text-2xs uppercase tracking-wider2 text-muted">
              {{ task.projectName || 'inbox' }}
            </span>
          </div>
          <div class="flex items-baseline gap-4">
            <button
              v-if="!editing"
              type="button"
              class="font-mono text-2xs uppercase tracking-wider2 text-muted transition-colors hover:text-ink"
              @click="startEdit"
            >
              edit ✎
            </button>
            <button
              type="button"
              class="font-mono text-2xs uppercase tracking-wider2 text-muted transition-colors hover:text-ink"
              :disabled="saving"
              aria-label="close"
              @click="close"
            >
              close ✕
            </button>
          </div>
        </header>

        <!-- READ MODE -->
        <template v-if="!editing">
          <h2
            class="font-display text-[34px] font-light leading-[1.1] tracking-tightest text-ink"
            :class="task.completed ? 'line-through decoration-muted' : ''"
          >
            {{ task.title || '(untitled)' }}
          </h2>
          <p
            v-if="task.desc"
            class="mt-3 serif-italic text-[16px] font-light leading-relaxed text-muted"
          >
            {{ task.desc }}
          </p>

          <div class="mt-6">
            <div
              v-if="task.content"
              class="md-body text-[14px] leading-relaxed text-ink"
              v-html="renderedContent"
            ></div>
            <p
              v-else
              class="font-mono text-2xs uppercase tracking-wider2 text-muted"
            >
              — no notes —
            </p>
          </div>

          <div v-if="task.tags.length" class="mt-5 flex flex-wrap gap-2">
            <span
              v-for="tag in task.tags"
              :key="tag"
              class="border hairline px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink"
            >
              #{{ tag }}
            </span>
          </div>
        </template>

        <!-- EDIT MODE -->
        <template v-else>
          <label class="mb-1 block font-mono text-2xs uppercase tracking-wider2 text-muted">
            title
          </label>
          <input
            v-model="draftTitle"
            type="text"
            :disabled="saving"
            class="w-full border-b hairline bg-transparent pb-1 font-display text-[28px] font-light leading-tight tracking-tightest text-ink outline-none transition-colors focus:border-ink"
            placeholder="(untitled)"
          />

          <label class="mb-1 mt-5 block font-mono text-2xs uppercase tracking-wider2 text-muted">
            subtitle
          </label>
          <input
            v-model="draftDesc"
            type="text"
            :disabled="saving"
            class="w-full border-b hairline bg-transparent pb-1 serif-italic text-[15px] font-light text-ink outline-none transition-colors focus:border-ink placeholder:text-muted/70"
            placeholder="optional one-line note"
          />

          <label class="mb-1 mt-5 block font-mono text-2xs uppercase tracking-wider2 text-muted">
            notes
          </label>
          <textarea
            v-model="draftContent"
            :disabled="saving"
            rows="6"
            class="w-full resize-y border hairline bg-transparent p-3 text-[14px] leading-relaxed text-ink outline-none transition-colors focus:border-ink placeholder:text-muted/70"
            placeholder="write anything — preserved with line breaks"
          ></textarea>

          <p
            v-if="saveError"
            class="mt-2 font-mono text-2xs uppercase tracking-wider2 text-danger"
          >
            {{ saveError }}
          </p>
        </template>

        <!-- METADATA (always shown, mono grid). -->
        <dl
          class="mt-7 grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 border-t hairline pt-5 font-mono text-2xs uppercase tracking-wider2"
        >
          <dt class="text-muted">status</dt>
          <dd
            class="tabular-nums"
            :class="task.completed ? 'text-accent' : 'text-ink'"
          >
            {{ task.completed ? '● completed' : '○ pending' }}
          </dd>

          <dt class="text-muted">priority</dt>
          <dd class="text-ink">{{ priorityLabel(task.priority) }}</dd>

          <dt class="text-muted">due</dt>
          <dd class="tabular-nums text-ink">
            {{ fmtDateTime(task.dueDate, task.isAllDay) }}
          </dd>

          <template v-if="task.startDate">
            <dt class="text-muted">start</dt>
            <dd class="tabular-nums text-ink">
              {{ fmtDateTime(task.startDate, task.isAllDay) }}
            </dd>
          </template>

          <template v-if="task.createdTime">
            <dt class="text-muted">created</dt>
            <dd class="tabular-nums text-ink">{{ fmtDateTime(task.createdTime) }}</dd>
          </template>

          <template v-if="task.modifiedTime">
            <dt class="text-muted">modified</dt>
            <dd class="tabular-nums text-ink">{{ fmtDateTime(task.modifiedTime) }}</dd>
          </template>
        </dl>

        <!-- Footer actions. -->
        <footer class="mt-7 flex items-baseline justify-between border-t hairline pt-4">
          <a
            :href="task.url"
            target="_blank"
            rel="noopener noreferrer"
            class="border-b hairline pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-muted hover:border-ink hover:text-ink"
          >
            open in 嘀嗒 →
          </a>
          <div v-if="editing" class="flex items-baseline gap-4">
            <button
              type="button"
              class="font-mono text-2xs uppercase tracking-wider2 text-muted hover:text-ink"
              :disabled="saving"
              @click="cancelEdit"
            >
              cancel
            </button>
            <button
              type="button"
              class="border-b border-ink pb-0.5 font-mono text-2xs uppercase tracking-wider2 text-ink disabled:text-muted disabled:border-hair"
              :disabled="saving || !isDirty || !draftTitle.trim()"
              @click="saveEdit"
            >
              {{ saving ? 'saving…' : 'save ↵' }}
            </button>
          </div>
        </footer>
      </article>
    </div>
  </Teleport>
</template>
