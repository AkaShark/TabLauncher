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

describe('tasks store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installStorageMock();
    _resetConnectorForTests();
  });

  it('refresh populates today and writes cache', async () => {
    const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2', completed: true })];
    const conn: TaskConnector = {
      getTodayTasks: async () => tasks,
      completeTask: async () => undefined,
    };
    _setConnectorForTests(conn);

    const store = useTasksStore();
    await store.refresh();

    expect(store.loadingState).toBe('loaded');
    expect(store.today).toHaveLength(2);
    expect(store.completionRatio.text).toBe('1/2');
    expect(store.error).toBeNull();
  });

  it('toggle marks completed optimistically and persists', async () => {
    const initial = [makeTask({ id: 't1' })];
    let calledWith: { p: string; t: string } | null = null;
    const conn: TaskConnector = {
      getTodayTasks: async () => initial,
      completeTask: async (p, t) => {
        calledWith = { p, t };
      },
    };
    _setConnectorForTests(conn);

    const store = useTasksStore();
    await store.refresh();
    expect(store.completionRatio.text).toBe('0/1');

    await store.toggle('t1');
    expect(store.today[0]?.completed).toBe(true);
    expect(store.completionRatio.text).toBe('1/1');
    expect(calledWith).toEqual({ p: 'p1', t: 't1' });
  });

  it('toggle rolls back on API failure and surfaces error', async () => {
    const initial = [makeTask({ id: 't1' })];
    const conn: TaskConnector = {
      getTodayTasks: async () => initial,
      completeTask: async () => {
        throw new Error('boom');
      },
    };
    _setConnectorForTests(conn);

    const store = useTasksStore();
    await store.refresh();

    await expect(store.toggle('t1')).rejects.toThrow('boom');
    expect(store.today[0]?.completed).toBe(false);
    expect(store.error?.kind).toBe('fetch-failed');
  });

  it('loadFromCache returns false when empty', async () => {
    const store = useTasksStore();
    const ok = await store.loadFromCache();
    expect(ok).toBe(false);
    expect(store.loadingState).toBe('idle');
  });
});
