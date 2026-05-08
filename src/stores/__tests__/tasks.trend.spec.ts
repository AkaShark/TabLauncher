import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { installStorageMock } from '../../../tests/helpers/chromeMock';
import {
  useTasksStore,
  _setConnectorForTests,
  _resetConnectorForTests,
  type TaskConnector,
} from '../tasks';
import type { NormalizedTask } from '@/adapters/ticktick/types';
import { recordToday } from '@/core/ledger';

function makeTask(overrides: Partial<NormalizedTask> = {}): NormalizedTask {
  return {
    id: 't1',
    projectId: 'p1',
    projectName: 'P',
    title: 'do',
    content: '',
    desc: '',
    startDate: null,
    dueDate: '2026-05-07T08:00:00Z',
    modifiedTime: null,
    createdTime: null,
    isAllDay: false,
    tags: [],
    priority: 0,
    completed: false,
    url: 'https://ticktick.com/webapp/#p/p1/tasks/t1',
    ...overrides,
  };
}

describe('tasks store — trend', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installStorageMock();
    _resetConnectorForTests();
  });

  it('refresh writes ledger via connector.getTodaySnapshot and loads trend', async () => {
    const conn: TaskConnector = {
      getTodayTasks: async () => [makeTask({ id: 't1' })],
      getTodaySnapshot: async () => ({
        pending: [makeTask({ id: 't1' })],
        completedCount: 4,
      }),
      completeTask: async () => undefined,
    };
    _setConnectorForTests(conn);

    const store = useTasksStore();
    await store.refresh();

    expect(store.trend.range).toBe(7);
    expect(store.trend.data).toHaveLength(7);
    // Today bucket = 4
    const last = store.trend.data[store.trend.data.length - 1];
    expect(last?.count).toBe(4);
    expect(store.trend.recorded).toBe(1);
  });

  it('falls back to countTodayCompleted when getTodaySnapshot is missing', async () => {
    let counted = 0;
    const conn: TaskConnector = {
      getTodayTasks: async () => [makeTask({ id: 't1' })],
      countTodayCompleted: async () => {
        counted++;
        return 7;
      },
      completeTask: async () => undefined,
    };
    _setConnectorForTests(conn);

    const store = useTasksStore();
    await store.refresh();
    expect(counted).toBe(1);
    const last = store.trend.data[store.trend.data.length - 1];
    expect(last?.count).toBe(7);
  });

  it('setTrendRange switches between 7 and 30', async () => {
    const conn: TaskConnector = {
      getTodayTasks: async () => [],
      getTodaySnapshot: async () => ({ pending: [], completedCount: 1 }),
      completeTask: async () => undefined,
    };
    _setConnectorForTests(conn);

    const store = useTasksStore();
    await store.refresh();
    expect(store.trend.data).toHaveLength(7);

    await store.setTrendRange(30);
    expect(store.trend.range).toBe(30);
    expect(store.trend.data).toHaveLength(30);

    await store.setTrendRange(7);
    expect(store.trend.data).toHaveLength(7);
  });

  it('empty ledger renders all-zero range and recorded=0', async () => {
    const store = useTasksStore();
    await store.loadTrend();
    expect(store.trend.recorded).toBe(0);
    expect(store.trend.data).toHaveLength(7);
    expect(store.trend.data.every((p) => p.count === 0)).toBe(true);
  });

  it('toggle bumps today ledger bucket and reloads trend', async () => {
    const initial = [makeTask({ id: 't1' })];
    const conn: TaskConnector = {
      getTodayTasks: async () => initial,
      getTodaySnapshot: async () => ({ pending: initial, completedCount: 0 }),
      completeTask: async () => undefined,
    };
    _setConnectorForTests(conn);

    const store = useTasksStore();
    await store.refresh();
    const before = store.trend.data[store.trend.data.length - 1]?.count ?? -1;
    expect(before).toBe(0);

    await store.toggle('t1');
    const after = store.trend.data[store.trend.data.length - 1]?.count ?? -1;
    expect(after).toBe(1);
    expect(store.trend.recorded).toBe(1);
  });

  it('loadFromCache loads trend from ledger even when no task cache', async () => {
    // Pre-seed ledger
    await recordToday(3);
    const store = useTasksStore();
    const ok = await store.loadFromCache();
    expect(ok).toBe(false); // no task cache
    expect(store.trend.recorded).toBe(1);
    const last = store.trend.data[store.trend.data.length - 1];
    expect(last?.count).toBe(3);
  });
});
