/**
 * Chrome extension API mocks for vitest (happy-dom env).
 *
 * Each install* helper mutates `globalThis.chrome` and returns a small handle
 * that lets tests inspect or seed state. `jest-webextension-mock` is loaded by
 * tests/setup.ts but its surface is incomplete for our needs; we layer our own
 * implementations on top.
 */

type StorageChange = { oldValue?: unknown; newValue?: unknown };
type StorageChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

interface ChromeLike {
  storage?: unknown;
  identity?: unknown;
  runtime?: unknown;
  permissions?: unknown;
}

function getChrome(): ChromeLike {
  const g = globalThis as unknown as { chrome?: ChromeLike };
  if (!g.chrome) g.chrome = {};
  return g.chrome;
}

export interface StorageMockHandle {
  store: Map<string, unknown>;
  reset(): void;
}

export function installStorageMock(): StorageMockHandle {
  const store = new Map<string, unknown>();
  const listeners: StorageChangeListener[] = [];

  const local = {
    async get(
      keys?: string | string[] | Record<string, unknown> | null,
    ): Promise<Record<string, unknown>> {
      if (keys == null) {
        return Object.fromEntries(store.entries());
      }
      const keyList = Array.isArray(keys)
        ? keys
        : typeof keys === 'string'
          ? [keys]
          : Object.keys(keys);
      const out: Record<string, unknown> = {};
      for (const k of keyList) {
        if (store.has(k)) out[k] = store.get(k);
      }
      return out;
    },
    async set(items: Record<string, unknown>): Promise<void> {
      const changes: Record<string, StorageChange> = {};
      for (const [k, v] of Object.entries(items)) {
        const oldValue = store.get(k);
        store.set(k, v);
        changes[k] = { oldValue, newValue: v };
      }
      for (const l of listeners) l(changes, 'local');
    },
    async remove(keys: string | string[]): Promise<void> {
      const arr = Array.isArray(keys) ? keys : [keys];
      const changes: Record<string, StorageChange> = {};
      for (const k of arr) {
        if (store.has(k)) {
          changes[k] = { oldValue: store.get(k), newValue: undefined };
          store.delete(k);
        }
      }
      for (const l of listeners) l(changes, 'local');
    },
    async clear(): Promise<void> {
      const changes: Record<string, StorageChange> = {};
      for (const [k, v] of store.entries()) changes[k] = { oldValue: v, newValue: undefined };
      store.clear();
      for (const l of listeners) l(changes, 'local');
    },
  };

  const onChanged = {
    addListener(l: StorageChangeListener): void {
      listeners.push(l);
    },
    removeListener(l: StorageChangeListener): void {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    },
  };

  const c = getChrome();
  c.storage = { local, onChanged };

  return {
    store,
    reset(): void {
      store.clear();
      listeners.length = 0;
    },
  };
}

export interface IdentityMockHandle {
  setRedirectUrl(url: string): void;
  setNextRedirect(url: string): void;
  setNextError(message: string): void;
}

export function installIdentityMock(): IdentityMockHandle {
  let redirectUrl = 'https://abc.chromiumapp.org/';
  let nextRedirect: string | null = null;
  let nextError: string | null = null;

  const identity = {
    getRedirectURL(): string {
      return redirectUrl;
    },
    launchWebAuthFlow(
      _details: { url: string; interactive?: boolean },
      cb: (responseUrl?: string) => void,
    ): void {
      if (nextError) {
        const runtimeRef = getChrome().runtime as { lastError?: { message: string } } | undefined;
        if (runtimeRef) runtimeRef.lastError = { message: nextError };
        nextError = null;
        cb(undefined);
        return;
      }
      const r = nextRedirect;
      nextRedirect = null;
      cb(r ?? undefined);
    },
  };
  const c = getChrome();
  c.identity = identity;

  return {
    setRedirectUrl(u): void {
      redirectUrl = u;
    },
    setNextRedirect(u): void {
      nextRedirect = u;
    },
    setNextError(m): void {
      nextError = m;
    },
  };
}

export interface RuntimeMockHandle {
  setHandler(fn: (msg: unknown) => Promise<unknown> | unknown): void;
}

export function installRuntimeMock(): RuntimeMockHandle {
  let handler: ((msg: unknown) => Promise<unknown> | unknown) | null = null;
  const runtime = {
    lastError: undefined as { message: string } | undefined,
    onInstalled: { addListener(): void {} },
    onMessage: { addListener(): void {} },
    async sendMessage(msg: unknown): Promise<unknown> {
      if (!handler) return undefined;
      return handler(msg);
    },
  };
  const c = getChrome();
  c.runtime = runtime;
  return {
    setHandler(fn): void {
      handler = fn;
    },
  };
}

export function installAllChromeMocks(): {
  storage: StorageMockHandle;
  identity: IdentityMockHandle;
  runtime: RuntimeMockHandle;
} {
  return {
    storage: installStorageMock(),
    identity: installIdentityMock(),
    runtime: installRuntimeMock(),
  };
}

// Legacy aliases — kept so M1 imports keep compiling.
export const mockStorage = installStorageMock;
export const mockIdentity = installIdentityMock;
export const mockRuntime = installRuntimeMock;
export function mockAlarms(): never {
  throw new Error('alarms mock — implement in M6');
}
export function mockCookies(): never {
  throw new Error('cookies mock — implement in M3');
}
export function mockPermissions(): never {
  throw new Error('permissions mock — implement when needed');
}

type TabsUpdatedListener = (
  tabId: number,
  info: { status?: string },
  tab: { id?: number; status?: string; url?: string },
) => void;

export interface TabsMockHandle {
  /** Pre-seed the result of `tabs.query`. */
  setExisting(tabs: Array<{ id: number; url?: string; status?: string }>): void;
  /** Configure the next `tabs.create` call: returns this tab and (optionally)
   * fires onUpdated `complete` after the given delay (default 0ms). */
  setNextCreated(opts: {
    id: number;
    completeAfterMs?: number;
    failWith?: string;
    /** If true, never fire `complete` so the caller times out. */
    neverComplete?: boolean;
  }): void;
  /** Inspect what was created/removed. */
  readonly created: Array<{ url: string; active: boolean; pinned?: boolean }>;
  readonly removed: number[];
  reset(): void;
}

export function installTabsMock(): TabsMockHandle {
  let existing: Array<{ id: number; url?: string; status?: string }> = [];
  let nextCreated:
    | { id: number; completeAfterMs?: number; failWith?: string; neverComplete?: boolean }
    | null = null;
  const created: Array<{ url: string; active: boolean; pinned?: boolean }> = [];
  const removed: number[] = [];
  const listeners: TabsUpdatedListener[] = [];

  const tabs = {
    async query(q: { url: string[] }): Promise<unknown[]> {
      void q;
      return existing.map((t) => ({ ...t }));
    },
    async create(props: {
      url: string;
      active: boolean;
      pinned?: boolean;
    }): Promise<{ id: number; status: string; url: string }> {
      created.push({ ...props });
      const cfg = nextCreated;
      nextCreated = null;
      if (cfg?.failWith) throw new Error(cfg.failWith);
      const id = cfg?.id ?? 1001;
      const tab = { id, status: 'loading', url: props.url };
      if (!cfg?.neverComplete) {
        const wait = cfg?.completeAfterMs ?? 0;
        setTimeout(() => {
          for (const l of [...listeners]) {
            try {
              l(id, { status: 'complete' }, { ...tab, status: 'complete' });
            } catch {
              /* ignore */
            }
          }
        }, wait);
      }
      return tab;
    },
    async remove(tabId: number): Promise<void> {
      removed.push(tabId);
    },
    async get(tabId: number): Promise<{ id: number; status: string }> {
      const found = existing.find((t) => t.id === tabId);
      if (found) return { id: tabId, status: found.status ?? 'complete' };
      return { id: tabId, status: 'loading' };
    },
    onUpdated: {
      addListener(l: TabsUpdatedListener): void {
        listeners.push(l);
      },
      removeListener(l: TabsUpdatedListener): void {
        const i = listeners.indexOf(l);
        if (i >= 0) listeners.splice(i, 1);
      },
    },
  };
  const c = getChrome() as ChromeLike & { tabs?: unknown };
  c.tabs = tabs;

  return {
    setExisting(t): void {
      existing = t.map((x) => ({ ...x }));
    },
    setNextCreated(opts): void {
      nextCreated = { ...opts };
    },
    created,
    removed,
    reset(): void {
      existing = [];
      nextCreated = null;
      created.length = 0;
      removed.length = 0;
      listeners.length = 0;
    },
  };
}

export interface ScriptingMockHandle {
  /** Configure the next executeScript call: either return a result, throw, or
   * return an error envelope `{ __error }`. */
  setNextResult(value: unknown): void;
  setNextError(message: string): void;
  /** Inspect calls. */
  readonly calls: Array<{ tabId: number; world?: string; args?: unknown[] }>;
  reset(): void;
}

export function installScriptingMock(): ScriptingMockHandle {
  const queue: Array<{ kind: 'result'; value: unknown } | { kind: 'error'; message: string }> = [];
  const calls: Array<{ tabId: number; world?: string; args?: unknown[] }> = [];

  const scripting = {
    async executeScript(args: {
      target: { tabId: number };
      world?: string;
      func: (...a: unknown[]) => unknown;
      args?: unknown[];
    }): Promise<Array<{ result: unknown }>> {
      calls.push({ tabId: args.target.tabId, world: args.world, args: args.args });
      const next = queue.shift();
      if (!next) {
        return [{ result: undefined }];
      }
      if (next.kind === 'error') {
        throw new Error(next.message);
      }
      return [{ result: next.value }];
    },
  };
  const c = getChrome() as ChromeLike & { scripting?: unknown };
  c.scripting = scripting;

  return {
    setNextResult(value): void {
      queue.push({ kind: 'result', value });
    },
    setNextError(message): void {
      queue.push({ kind: 'error', message });
    },
    calls,
    reset(): void {
      queue.length = 0;
      calls.length = 0;
    },
  };
}

export interface PermissionsMockHandle {
  grantedOrigins: Set<string>;
  __setPermissionsRequestResult(granted: boolean): void;
  reset(): void;
}

export function installPermissionsMock(): PermissionsMockHandle {
  const grantedOrigins = new Set<string>();
  let nextRequestResult = true;

  const permissions = {
    async contains(descriptor: { origins?: string[] }): Promise<boolean> {
      const origins = descriptor.origins ?? [];
      return origins.every((o) => grantedOrigins.has(o));
    },
    async request(descriptor: { origins?: string[] }): Promise<boolean> {
      if (nextRequestResult) {
        for (const o of descriptor.origins ?? []) {
          grantedOrigins.add(o);
        }
      }
      return nextRequestResult;
    },
  };

  const c = getChrome() as ChromeLike & { permissions?: unknown };
  c.permissions = permissions;

  return {
    grantedOrigins,
    __setPermissionsRequestResult(granted: boolean): void {
      nextRequestResult = granted;
    },
    reset(): void {
      grantedOrigins.clear();
      nextRequestResult = true;
    },
  };
}
