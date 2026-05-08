/**
 * TickTick connector — thin wrapper around 3 endpoints + a "today" aggregator.
 * Endpoints (research §3): /open/v1/project, /open/v1/project/{pid}/data,
 * /open/v1/project/{pid}/task/{tid}/complete.
 */

import { authedFetch } from '@/core/http';
import { normalizeTask } from './normalizer';
import type { NormalizedTask, TickTickProject, TickTickProjectData, TickTickTask } from './types';
import { isDueByEndOfToday } from '@/utils/today';

// dida365 (CN) and ticktick (intl) share API surface; host is configurable.
const API_HOST = (import.meta.env.VITE_TICKTICK_API_HOST ?? 'api.dida365.com').replace(/\/$/, '');
const BASE = `https://${API_HOST}/open/v1`;

export async function listProjects(): Promise<TickTickProject[]> {
  const data = await authedFetch<TickTickProject[]>({ url: `${BASE}/project` });
  return Array.isArray(data) ? data : [];
}

export async function listTasksByProject(projectId: string): Promise<TickTickProjectData> {
  const data = await authedFetch<TickTickProjectData>({
    url: `${BASE}/project/${encodeURIComponent(projectId)}/data`,
  });
  return {
    project: data.project,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
  };
}

/**
 * Update a task (title / content / desc / dueDate / priority).
 * TickTick open API: POST /open/v1/task/{taskId} with the full task object.
 * We send id + projectId (required) and merge in the patch.
 */
export async function updateTask(input: {
  id: string;
  projectId: string;
  title?: string;
  content?: string;
  desc?: string;
  dueDate?: string | null;
  priority?: number;
  isAllDay?: boolean;
}): Promise<TickTickTask> {
  const { id, projectId, ...rest } = input;
  const body: Record<string, unknown> = { id, projectId };
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) body[k] = v;
  }
  return await authedFetch<TickTickTask>({
    url: `${BASE}/task/${encodeURIComponent(id)}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function completeTask(projectId: string, taskId: string): Promise<void> {
  await authedFetch<void>({
    url: `${BASE}/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}/complete`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

/** Today's end-of-day in ISO with timezone offset (TickTick expects offset form). */
function endOfTodayIso(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const pad = (n: number): string => String(n).padStart(2, '0');
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.000`;
  return `${local}${sign}${hh}${mm}`;
}

/**
 * Pick a sensible default project for ad-hoc task creation.
 * Heuristic: name matches Inbox/收件箱; else first non-closed project; else first.
 */
function pickDefaultProject(projects: TickTickProject[]): TickTickProject | null {
  if (projects.length === 0) return null;
  const inbox = projects.find((p) => /^(Inbox|收件箱|收集箱)$/i.test(p.name ?? ''));
  if (inbox) return inbox;
  const open = projects.find((p) => !p.closed);
  return open ?? projects[0]!;
}

export async function createTask(input: { title: string }): Promise<NormalizedTask> {
  const title = input.title.trim();
  if (!title) throw new Error('empty-title');
  const projects = await listProjects();
  const project = pickDefaultProject(projects);
  if (!project) throw new Error('no-project');

  const body = {
    title,
    projectId: project.id,
    dueDate: endOfTodayIso(),
    isAllDay: false,
  };

  const created = await authedFetch<TickTickTask>({
    url: `${BASE}/task`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return normalizeTask(created, project);
}

/**
 * Aggregate today's tasks across all projects.
 * Filters: status === 0 (not completed/archived) && dueDate <= EOD today.
 * Dedupes by task id.
 */
export async function getTodayTasks(now: Date = new Date()): Promise<NormalizedTask[]> {
  const { pending } = await getTodaySnapshot(now);
  return pending;
}

/**
 * Plan §M3 / OP-4 — single fetch returns today's pending list AND today's
 * completed-task count, so the service worker doesn't pay for two round trips.
 *
 * "Completed today" = TickTick task with `status === 1` (completed) AND
 * dueDate is on the same local-day as `now`. We deliberately do not count
 * historical completions whose dueDate falls earlier — the open API only
 * returns currently-open project data, so an "older" completed task showing
 * up here means it was just marked done; still, ledger semantics stay simple
 * by anchoring to "completed tasks scheduled for today".
 */
export async function getTodaySnapshot(now: Date = new Date()): Promise<{
  pending: NormalizedTask[];
  completed: NormalizedTask[];
  completedCount: number;
}> {
  const projects = await listProjects();
  const dataResults = await Promise.all(
    projects.map((p) => listTasksByProject(p.id).catch(() => null)),
  );

  const pending: NormalizedTask[] = [];
  const completed: NormalizedTask[] = [];
  const seenPending = new Set<string>();
  const seenCompleted = new Set<string>();

  for (const data of dataResults) {
    if (!data) continue;
    for (const t of data.tasks as TickTickTask[]) {
      if (!t || typeof t.id !== 'string') continue;
      const dueToday = isDueByEndOfToday(t.dueDate, now);
      if (t.status === 0 && dueToday) {
        if (seenPending.has(t.id)) continue;
        seenPending.add(t.id);
        pending.push(normalizeTask(t, data.project));
      } else if (t.status === 1 && dueToday) {
        if (seenCompleted.has(t.id)) continue;
        seenCompleted.add(t.id);
        completed.push(normalizeTask(t, data.project));
      }
    }
  }

  // Sort: priority desc (high → low) → due asc → title asc.
  // TickTick priority: 5 high, 3 medium, 1 low, 0 none.
  const sortByPriorityThenDue = (a: NormalizedTask, b: NormalizedTask): number => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const ad = a.dueDate ? Date.parse(a.dueDate) : 0;
    const bd = b.dueDate ? Date.parse(b.dueDate) : 0;
    if (ad !== bd) return ad - bd;
    return a.title.localeCompare(b.title);
  };

  pending.sort(sortByPriorityThenDue);
  completed.sort(sortByPriorityThenDue);

  return { pending, completed, completedCount: completed.length };
}

/**
 * Convenience wrapper used by service worker / ledger writer.
 * Re-uses listProjects + listTasksByProject internally; callers that already
 * grabbed pending tasks should prefer `getTodaySnapshot` to avoid duplicates.
 */
export async function countTodayCompleted(now: Date = new Date()): Promise<number> {
  const { completedCount } = await getTodaySnapshot(now);
  return completedCount;
}
