import type { NormalizedTask, TickTickProject, TickTickTask } from './types';

/**
 * Build a deep-link URL into the TickTick web app for a task.
 * Format derived from production URL pattern: ticktick.com/webapp/#p/{projectId}/tasks/{taskId}
 */
function buildTaskUrl(task: TickTickTask): string {
  return `https://ticktick.com/webapp/#p/${task.projectId}/tasks/${task.id}`;
}

export function normalizeTask(
  task: TickTickTask,
  project: Pick<TickTickProject, 'id' | 'name'>,
): NormalizedTask {
  return {
    id: task.id,
    projectId: task.projectId,
    projectName: project.name,
    title: task.title ?? '',
    content: task.content ?? '',
    desc: task.desc ?? '',
    startDate: task.startDate ?? null,
    dueDate: task.dueDate ?? null,
    modifiedTime: task.modifiedTime ?? null,
    createdTime: task.createdTime ?? null,
    isAllDay: task.isAllDay ?? false,
    tags: Array.isArray(task.tags) ? task.tags : [],
    priority: typeof task.priority === 'number' ? task.priority : 0,
    completed: task.status === 1,
    url: buildTaskUrl(task),
  };
}
