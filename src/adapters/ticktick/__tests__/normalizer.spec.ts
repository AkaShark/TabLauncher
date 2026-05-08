import { describe, it, expect } from 'vitest';
import { normalizeTask } from '../normalizer';
import type { TickTickTask, TickTickProject } from '../types';

const project: TickTickProject = { id: 'pid1', name: 'Inbox' };

function rawTask(overrides: Partial<TickTickTask> = {}): TickTickTask {
  return {
    id: 'tid1',
    projectId: 'pid1',
    title: 'do thing',
    status: 0,
    priority: 1,
    dueDate: '2026-05-07T10:00:00.000+0000',
    ...overrides,
  };
}

describe('normalizeTask', () => {
  it('maps fields and builds web-app URL', () => {
    const n = normalizeTask(rawTask(), project);
    expect(n).toMatchObject({
      id: 'tid1',
      projectId: 'pid1',
      projectName: 'Inbox',
      title: 'do thing',
      dueDate: '2026-05-07T10:00:00.000+0000',
      priority: 1,
      completed: false,
      url: 'https://ticktick.com/webapp/#p/pid1/tasks/tid1',
    });
    // Defaults for newly-added detail fields.
    expect(n.content).toBe('');
    expect(n.desc).toBe('');
    expect(n.tags).toEqual([]);
    expect(n.isAllDay).toBe(false);
  });

  it('marks completed when status === 1', () => {
    expect(normalizeTask(rawTask({ status: 1 }), project).completed).toBe(true);
  });

  it('treats status 2 (archived) as not-completed for our completed flag', () => {
    expect(normalizeTask(rawTask({ status: 2 }), project).completed).toBe(false);
  });

  it('defaults priority to 0 when missing', () => {
    expect(
      normalizeTask(rawTask({ priority: undefined }), project).priority,
    ).toBe(0);
  });

  it('handles missing dueDate as null', () => {
    expect(normalizeTask(rawTask({ dueDate: undefined }), project).dueDate).toBeNull();
  });
});
