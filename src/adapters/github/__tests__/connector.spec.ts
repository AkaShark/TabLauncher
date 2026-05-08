import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchTrending, GithubFetchError } from '../connector';

interface MockedFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeRepo(i: number) {
  return {
    id: `/owner/repo${i}`,
    url: `https://github.com/owner/repo${i}`,
    username: 'owner',
    reponame: `repo${i}`,
    description: `desc ${i}`,
    lang: 'Go',
    langColor: '#00ADD8',
    detailPageUrl: `https://github.com/owner/repo${i}`,
    starCount: 100 + i,
    forkCount: 10 + i,
    owner: { username: 'owner', avatar: 'a', url: 'u' },
  };
}

describe('fetchTrending', () => {
  let lastInit: MockedFetchInit | undefined;
  let lastUrl: string | undefined;

  beforeEach(() => {
    lastInit = undefined;
    lastUrl = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('case 1: maps multiple repos and forwards period/lang/limit in body', async () => {
    vi.stubGlobal('fetch', async (url: string, init: MockedFetchInit) => {
      lastUrl = url;
      lastInit = init;
      return jsonResponse({
        code: 200,
        data: [makeRepo(1), makeRepo(2), makeRepo(3)],
      });
    });
    const items = await fetchTrending({ period: 'week', lang: 'go', limit: 25 });
    expect(items).toHaveLength(3);
    expect(items[0]!.fullName).toBe('owner/repo1');
    expect(lastUrl).toBe('https://e.juejin.cn/resources/github');
    const body = JSON.parse(lastInit!.body ?? '{}') as Record<string, unknown>;
    expect(body.category).toBe('trending');
    expect(body.period).toBe('week');
    expect(body.lang).toBe('go');
    expect(body.limit).toBe(25);
    expect(body.cursor).toBe('0');
    expect(lastInit?.credentials).toBe('omit');
  });

  it('case 2: code !== 200 throws GithubFetchError code=api', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ code: 500, data: [] }),
    );
    await expect(fetchTrending({ period: 'day' })).rejects.toMatchObject({
      name: 'GithubFetchError',
      code: 'api',
    });
  });

  it('case 3: HTTP 500 throws GithubFetchError code=network', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response('boom', { status: 500 }),
    );
    await expect(fetchTrending({ period: 'day' })).rejects.toBeInstanceOf(
      GithubFetchError,
    );
    await expect(fetchTrending({ period: 'day' })).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('case 4: empty data array returns []', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ code: 200, data: [] }),
    );
    const items = await fetchTrending({ period: 'day' });
    expect(items).toEqual([]);
  });

  it('case 5: empty lang defaults to "" in body', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: MockedFetchInit) => {
      lastInit = init;
      return jsonResponse({ code: 200, data: [] });
    });
    await fetchTrending({ period: 'day' });
    const body = JSON.parse(lastInit!.body ?? '{}') as Record<string, unknown>;
    expect(body.lang).toBe('');
  });
});
