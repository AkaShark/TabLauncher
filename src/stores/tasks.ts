import { defineStore } from 'pinia';
import { getCached, setCached } from '@/core/cache';
import * as defaultConnector from '@/adapters/ticktick/connector';
import type { NormalizedTask } from '@/adapters/ticktick/types';
import {
  countRecordedDays,
  getAllRecorded,
  getRange,
  recordToday,
  type LedgerPoint,
} from '@/core/ledger';

const CACHE_KEY = 'ticktick.today';
const COLD_TIMEOUT_MS = 5_000;

export type TaskLoadingState =
  | 'idle'
  | 'cold-loading'
  | 'warm-loading'
  | 'loaded'
  | 'error';

export interface TaskError {
  kind: 'offline' | 'token-expired' | 'fetch-failed' | 'timeout';
  message: string;
}

export type TrendRange = 7 | 30;

export interface TrendState {
  range: TrendRange;
  data: LedgerPoint[];
  /** Number of distinct days with non-zero ledger entries. */
  recorded: number;
}

interface TasksState {
  today: NormalizedTask[];
  loadingState: TaskLoadingState;
  error: TaskError | null;
  lastFetchedAt: number | null;
  trend: TrendState;
}

/** Connector seam — tests can replace this. */
export interface TaskConnector {
  getTodayTasks(now?: Date): Promise<NormalizedTask[]>;
  getTodaySnapshot?(
    now?: Date,
  ): Promise<{
    pending: NormalizedTask[];
    completed?: NormalizedTask[];
    completedCount: number;
  }>;
  countTodayCompleted?(now?: Date): Promise<number>;
  completeTask(projectId: string, taskId: string): Promise<void>;
  createTask?(input: { title: string }): Promise<NormalizedTask>;
  updateTask?(input: {
    id: string;
    projectId: string;
    title?: string;
    content?: string;
    desc?: string;
    dueDate?: string | null;
    priority?: number;
    isAllDay?: boolean;
  }): Promise<unknown>;
}

let connector: TaskConnector = defaultConnector;
export function _setConnectorForTests(c: TaskConnector): void {
  connector = c;
}
export function _resetConnectorForTests(): void {
  connector = defaultConnector;
}

export const useTasksStore = defineStore('tasks', {
  state: (): TasksState => ({
    today: [],
    loadingState: 'idle',
    error: null,
    lastFetchedAt: null,
    trend: { range: 7, data: [], recorded: 0 },
  }),
  getters: {
    completionRatio: (s) => {
      const total = s.today.length;
      const done = s.today.filter((t) => t.completed).length;
      return { done, total, text: `${done}/${total}` };
    },
  },
  actions: {
    async loadFromCache(): Promise<boolean> {
      const cached = await getCached<NormalizedTask[]>(CACHE_KEY);
      let hasTasks = false;
      if (cached && Array.isArray(cached.value)) {
        this.today = cached.value;
        this.lastFetchedAt = cached.fetchedAt;
        this.loadingState = 'loaded';
        hasTasks = true;
      }
      // Trend always loads from ledger so cold cache still shows historical bars.
      await this.loadTrend();
      return hasTasks;
    },

    async refresh(): Promise<void> {
      const hasCache = this.today.length > 0;
      this.loadingState = hasCache ? 'warm-loading' : 'cold-loading';
      this.error = null;

      const timeoutPromise = new Promise<NormalizedTask[]>((_, rej) => {
        setTimeout(() => rej(new Error('cold-timeout')), COLD_TIMEOUT_MS);
      });

      try {
        // Prefer snapshot path (one fetch → both pending + completed count).
        if (typeof connector.getTodaySnapshot === 'function') {
          const snapshot = await Promise.race([
            connector.getTodaySnapshot(),
            timeoutPromise as unknown as Promise<{
              pending: NormalizedTask[];
              completed?: NormalizedTask[];
              completedCount: number;
            }>,
          ]);
          // Keep completed-today in the list so total stays stable across refreshes.
          // Pending first, then completed (visually deprioritised but still counted).
          const completed = snapshot.completed ?? [];
          this.today = [...snapshot.pending, ...completed];
          await recordToday(snapshot.completedCount);
        } else {
          const tasks = await Promise.race([connector.getTodayTasks(), timeoutPromise]);
          this.today = tasks;
          if (typeof connector.countTodayCompleted === 'function') {
            const count = await connector.countTodayCompleted();
            await recordToday(count);
          }
        }
        this.lastFetchedAt = Date.now();
        this.loadingState = 'loaded';
        await setCached(CACHE_KEY, this.today);
        await this.loadTrend();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        let kind: TaskError['kind'] = 'fetch-failed';
        if (msg === 'cold-timeout') kind = 'timeout';
        else if (msg.includes('token-expired') || msg.includes('no-token')) kind = 'token-expired';
        else if (msg.includes('network') || msg.includes('timeout')) kind = 'offline';
        this.error = { kind, message: msg };
        this.loadingState = hasCache ? 'loaded' : 'error';
      }
    },

    /** Re-read ledger and refresh trend.data + trend.recorded. */
    async loadTrend(): Promise<void> {
      const [data, all] = await Promise.all([
        getRange(this.trend.range),
        getAllRecorded(),
      ]);
      this.trend.data = data;
      this.trend.recorded = countRecordedDays(all);
    },

    async setTrendRange(range: TrendRange): Promise<void> {
      this.trend.range = range;
      this.trend.data = await getRange(range);
    },

    /**
     * Optimistic toggle: flip UI immediately, hit API, rollback on failure.
     * Currently only supports completing (TickTick complete endpoint is one-way for AC-T2).
     */
    async toggle(taskId: string): Promise<void> {
      const idx = this.today.findIndex((t) => t.id === taskId);
      if (idx < 0) return;
      const task = this.today[idx];
      if (!task || task.completed) return;
      const prev = task.completed;

      this.today[idx] = { ...task, completed: true };

      try {
        await connector.completeTask(task.projectId, task.id);
        await setCached(CACHE_KEY, this.today);
        // Bump today's ledger bucket so trend chart reflects the click ≤200ms.
        await recordToday(this.today.filter((t) => t.completed).length);
        await this.loadTrend();
      } catch (e) {
        // Rollback
        const cur = this.today[idx];
        if (cur && cur.id === task.id) {
          this.today[idx] = { ...cur, completed: prev };
        }
        const msg = e instanceof Error ? e.message : String(e);
        this.error = { kind: 'fetch-failed', message: `complete failed: ${msg}` };
        throw e;
      }
    },

    /**
     * Patch a task (title / content / desc / due / priority).
     * Optimistic: applies UI changes immediately, rolls back on failure.
     */
    async update(
      taskId: string,
      patch: {
        title?: string;
        content?: string;
        desc?: string;
        dueDate?: string | null;
        priority?: number;
        isAllDay?: boolean;
      },
    ): Promise<void> {
      if (typeof connector.updateTask !== 'function') {
        throw new Error('updateTask not supported by connector');
      }
      const idx = this.today.findIndex((t) => t.id === taskId);
      if (idx < 0) return;
      const cur = this.today[idx];
      if (!cur) return;
      const prev = { ...cur };
      const next: NormalizedTask = {
        ...cur,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.desc !== undefined ? { desc: patch.desc } : {}),
        ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.isAllDay !== undefined ? { isAllDay: patch.isAllDay } : {}),
      };
      this.today[idx] = next;
      try {
        await connector.updateTask({
          id: cur.id,
          projectId: cur.projectId,
          ...patch,
        });
        await setCached(CACHE_KEY, this.today);
      } catch (e) {
        // Rollback
        const cur2 = this.today[idx];
        if (cur2 && cur2.id === taskId) this.today[idx] = prev;
        const msg = e instanceof Error ? e.message : String(e);
        this.error = { kind: 'fetch-failed', message: `update failed: ${msg}` };
        throw e;
      }
    },

    /**
     * Create a new task in the user's default project, due today.
     * Optimistic insert at the top so the user sees feedback immediately;
     * server-id replaces the optimistic one once the round trip lands.
     */
    async create(title: string): Promise<void> {
      if (typeof connector.createTask !== 'function') {
        throw new Error('createTask not supported by connector');
      }
      const trimmed = title.trim();
      if (!trimmed) return;
      try {
        const created = await connector.createTask({ title: trimmed });
        // Insert at the top of pending portion (before any completed items).
        const firstCompletedIdx = this.today.findIndex((t) => t.completed);
        if (firstCompletedIdx < 0) {
          this.today = [created, ...this.today];
        } else {
          this.today = [
            ...this.today.slice(0, firstCompletedIdx),
            created,
            ...this.today.slice(firstCompletedIdx),
          ];
        }
        await setCached(CACHE_KEY, this.today);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.error = { kind: 'fetch-failed', message: `create failed: ${msg}` };
        throw e;
      }
    },
  },
});
