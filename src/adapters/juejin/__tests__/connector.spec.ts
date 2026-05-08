import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchRecommendFeed } from '../connector';
import { FeedFetchError } from '@/adapters/feed/fetcher';

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

describe('fetchRecommendFeed', () => {
  let lastInit: MockedFetchInit | undefined;

  beforeEach(() => {
    lastInit = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('case 1: filters out item_type=14 (ad) entries', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: MockedFetchInit) => {
      lastInit = init;
      return jsonResponse({
        err_no: 0,
        err_msg: 'success',
        cursor: '0',
        has_more: true,
        data: [
          {
            item_type: 2,
            item_info: {
              article_id: '1',
              article_info: {
                title: 'A1', brief_content: 'b1', cover_image: '',
                ctime: '1714000000', mtime: '1714000000',
              },
            },
          },
          {
            item_type: 14,
            item_info: {
              article_id: 'ad',
              article_info: {
                title: 'AD', brief_content: '', cover_image: '',
                ctime: '1714000000', mtime: '1714000000',
              },
            },
          },
          {
            item_type: 2,
            item_info: {
              article_id: '2',
              article_info: {
                title: 'A2', brief_content: 'b2', cover_image: '',
                ctime: '1714000000', mtime: '1714000000',
              },
            },
          },
        ],
      });
    });
    const items = await fetchRecommendFeed();
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.title)).toEqual(['A1', 'A2']);
  });

  it('case 2: err_no !== 0 throws FeedFetchError code=parse', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ err_no: 200, err_msg: 'rejected', data: [], cursor: '0', has_more: false }),
    );
    await expect(fetchRecommendFeed()).rejects.toMatchObject({
      name: 'FeedFetchError',
      code: 'parse',
    });
  });

  it('case 3: HTTP 503 throws FeedFetchError code=network', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response('Service Unavailable', { status: 503 }),
    );
    await expect(fetchRecommendFeed()).rejects.toMatchObject({
      name: 'FeedFetchError',
      code: 'network',
    });
  });

  it('case 4: default limit is 30 in body', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: MockedFetchInit) => {
      lastInit = init;
      return jsonResponse({ err_no: 0, err_msg: 'ok', data: [], cursor: '0', has_more: false });
    });
    await fetchRecommendFeed();
    expect(lastInit).toBeDefined();
    const body = JSON.parse(lastInit!.body ?? '{}') as Record<string, unknown>;
    expect(body.limit).toBe(30);
    expect(body.id_type).toBe(2);
    expect(body.client_type).toBe(2608);
    expect(body.sort_type).toBe(200);
    expect(body.cursor).toBe('0');
  });

  it('case 5: withCookie=true sets credentials:include', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: MockedFetchInit) => {
      lastInit = init;
      return jsonResponse({ err_no: 0, err_msg: 'ok', data: [], cursor: '0', has_more: false });
    });
    await fetchRecommendFeed({ withCookie: true });
    expect(lastInit?.credentials).toBe('include');
  });

  it('case 6: withCookie omitted/false sets credentials:omit', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: MockedFetchInit) => {
      lastInit = init;
      return jsonResponse({ err_no: 0, err_msg: 'ok', data: [], cursor: '0', has_more: false });
    });
    await fetchRecommendFeed();
    expect(lastInit?.credentials).toBe('omit');
  });

  it('case 7: invalid JSON throws FeedFetchError code=parse', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response('<html>not json</html>', { status: 200 }),
    );
    await expect(fetchRecommendFeed()).rejects.toBeInstanceOf(FeedFetchError);
  });

  it('case 8: custom limit forwarded to body', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: MockedFetchInit) => {
      lastInit = init;
      return jsonResponse({ err_no: 0, err_msg: 'ok', data: [], cursor: '0', has_more: false });
    });
    await fetchRecommendFeed({ limit: 5 });
    const body = JSON.parse(lastInit!.body ?? '{}') as Record<string, unknown>;
    expect(body.limit).toBe(5);
  });
});
