import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TickTickProject, TickTickProjectData, TickTickTask } from '../types';

// Mock the auth/HTTP layer so we don't depend on tokens or fetch.
const { authedFetchMock } = vi.hoisted(() => ({ authedFetchMock: vi.fn() }));
vi.mock('@/core/http', () => ({
  authedFetch: authedFetchMock,
}));

import {
  countTodayCompleted,
  getTodaySnapshot,
  getTodayTasks,
} from '../connector';

function project(id: string, name = id): TickTickProject {
  return { id, name };
}

function task(overrides: Partial<TickTickTask> & { id: string }): TickTickTask {
  return {
    id: overrides.id,
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 't',
    status: overrides.status ?? 0,
    priority: overrides.priority ?? 0,
    dueDate: overrides.dueDate,
  };
}

function setupApi(projects: TickTickProject[], byProject: Record<string, TickTickTask[]>): void {
  authedFetchMock.mockReset();
  authedFetchMock.mockImplementation(async ({ url }: { url: string }) => {
    if (url.endsWith('/project')) return projects;
    const m = /\/project\/([^/]+)\/data$/.exec(url);
    if (m) {
      const pid = decodeURIComponent(m[1]!);
      const proj = projects.find((p) => p.id === pid);
      const data: TickTickProjectData = {
        project: proj ?? project(pid),
        tasks: byProject[pid] ?? [],
      };
      return data;
    }
    throw new Error(`unmocked url: ${url}`);
  });
}

describe('connector — countTodayCompleted / getTodaySnapshot', () => {
  const NOW = new Date(2026, 4, 7, 12, 0, 0); // local 2026-05-07 noon
  const todayIso = '2026-05-07T08:00:00.000Z';
  const yesterdayIso = '2026-05-06T08:00:00.000Z';
  const tomorrowIso = '2026-05-08T08:00:00.000Z';

  beforeEach(() => {
    authedFetchMock.mockReset();
  });

  it('counts only status=1 tasks dueDate today', async () => {
    setupApi(
      [project('p1')],
      {
        p1: [
          task({ id: 'a', status: 1, dueDate: todayIso }), // counted
          task({ id: 'b', status: 1, dueDate: yesterdayIso }), // dueDate < today: counted (≤ today)
          task({ id: 'c', status: 0, dueDate: todayIso }), // pending — not counted
          task({ id: 'd', status: 1, dueDate: tomorrowIso }), // future — not counted
          task({ id: 'e', status: 2, dueDate: todayIso }), // archived — not counted
        ],
      },
    );

    const n = await countTodayCompleted(NOW);
    // Spec note: completion ledger semantics = status===1 && dueDate <= today.
    // a + b = 2; c (status 0) excluded; d (future) excluded; e (status 2) excluded.
    expect(n).toBe(2);
  });

  it('does not count tasks without dueDate', async () => {
    setupApi(
      [project('p1')],
      {
        p1: [
          task({ id: 'x', status: 1, dueDate: undefined }),
          task({ id: 'y', status: 1, dueDate: null }),
          task({ id: 'z', status: 1, dueDate: todayIso }),
        ],
      },
    );
    const n = await countTodayCompleted(NOW);
    expect(n).toBe(1);
  });

  it('aggregates across multiple projects and dedupes by task id', async () => {
    setupApi(
      [project('p1'), project('p2')],
      {
        p1: [task({ id: 'shared', status: 1, dueDate: todayIso })],
        p2: [
          task({ id: 'shared', status: 1, dueDate: todayIso }),
          task({ id: 'extra', status: 1, dueDate: todayIso }),
        ],
      },
    );
    const n = await countTodayCompleted(NOW);
    expect(n).toBe(2);
  });

  it('getTodaySnapshot returns pending list and completedCount in one pass', async () => {
    setupApi(
      [project('p1')],
      {
        p1: [
          task({ id: 'p-1', status: 0, dueDate: todayIso, title: 'pending one' }),
          task({ id: 'p-2', status: 0, dueDate: yesterdayIso, title: 'overdue' }),
          task({ id: 'c-1', status: 1, dueDate: todayIso }),
          task({ id: 'c-2', status: 1, dueDate: todayIso }),
          task({ id: 'future', status: 0, dueDate: tomorrowIso }),
        ],
      },
    );
    const snap = await getTodaySnapshot(NOW);
    expect(snap.pending.map((t) => t.id).sort()).toEqual(['p-1', 'p-2']);
    expect(snap.completedCount).toBe(2);
  });

  it('getTodayTasks (legacy) still returns only pending', async () => {
    setupApi(
      [project('p1')],
      {
        p1: [
          task({ id: 'a', status: 0, dueDate: todayIso }),
          task({ id: 'b', status: 1, dueDate: todayIso }),
        ],
      },
    );
    const out = await getTodayTasks(NOW);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('a');
  });

  it('handles project fetch failure gracefully', async () => {
    authedFetchMock.mockReset();
    authedFetchMock.mockImplementation(async ({ url }: { url: string }) => {
      if (url.endsWith('/project')) return [project('p1'), project('p2')];
      if (url.includes('/project/p1/data')) {
        return {
          project: project('p1'),
          tasks: [task({ id: 'a', status: 1, dueDate: todayIso })],
        };
      }
      throw new Error('p2 down');
    });
    const n = await countTodayCompleted(NOW);
    expect(n).toBe(1);
  });
});
