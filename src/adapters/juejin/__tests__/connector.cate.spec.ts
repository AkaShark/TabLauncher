import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchCateFeed } from '../connector';
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

function makeItem(articleId: string, itemType = 2) {
  return {
    item_type: itemType,
    item_info: {
      article_id: articleId,
      article_info: {
        title: `Article ${articleId}`,
        brief_content: `Brief ${articleId}`,
        cover_image: '',
        ctime: '1714000000',
        mtime: '1714000000',
      },
    },
  };
}

const IOS_CATE_ID = '6809635626661445640';

describe('fetchCateFeed', () => {
  let lastUrl: string | undefined;
  let lastInit: MockedFetchInit | undefined;

  beforeEach(() => {
    lastUrl = undefined;
    lastInit = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('case 1: filters out item_type=14 (ad) entries', async () => {
    vi.stubGlobal('fetch', async (url: string, init: MockedFetchInit) => {
      lastUrl = url;
      lastInit = init;
      return jsonResponse({
        err_no: 0,
        err_msg: 'success',
        cursor: '0',
        has_more: true,
        data: [
          makeItem('a1', 2),
          makeItem('ad1', 14),
          makeItem('a2', 2),
          makeItem('ad2', 14),
          makeItem('a3', 2),
        ],
      });
    });
    const items = await fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 200 });
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.title)).toEqual(['Article a1', 'Article a2', 'Article a3']);
  });

  it('case 2: sort_type=200 and sort_type=300 both succeed', async () => {
    const makeOk = () =>
      vi.fn(async (_url: string, init: MockedFetchInit) => {
        lastInit = init;
        return jsonResponse({ err_no: 0, err_msg: 'success', cursor: '0', has_more: false, data: [makeItem('x')] });
      });

    const stub200 = makeOk();
    vi.stubGlobal('fetch', stub200);
    const items200 = await fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 200 });
    expect(items200).toHaveLength(1);
    const body200 = JSON.parse(lastInit!.body ?? '{}') as Record<string, unknown>;
    expect(body200.sort_type).toBe(200);

    const stub300 = makeOk();
    vi.stubGlobal('fetch', stub300);
    lastInit = undefined;
    const items300 = await fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 300 });
    expect(items300).toHaveLength(1);
    const body300 = JSON.parse(lastInit!.body ?? '{}') as Record<string, unknown>;
    expect(body300.sort_type).toBe(300);
  });

  it('case 3: cateId is injected into request body and correct endpoint is used', async () => {
    vi.stubGlobal('fetch', async (url: string, init: MockedFetchInit) => {
      lastUrl = url;
      lastInit = init;
      return jsonResponse({ err_no: 0, err_msg: 'ok', data: [], cursor: '0', has_more: false });
    });
    await fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 200 });
    expect(lastUrl).toContain('/recommend_cate_feed');
    expect(lastUrl).toContain('aid=6587');
    const body = JSON.parse(lastInit!.body ?? '{}') as Record<string, unknown>;
    expect(body.cate_id).toBe(IOS_CATE_ID);
    expect(body.client_type).toBe(6587);
    expect(body.id_type).toBe(2);
    expect(body.cursor).toBe('0');
  });

  it('case 4: err_no !== 0 throws FeedFetchError code=parse', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({ err_no: 403, err_msg: 'unauthorized', data: [], cursor: '0', has_more: false }),
    );
    await expect(fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 200 })).rejects.toMatchObject({
      name: 'FeedFetchError',
      code: 'parse',
    });
  });

  it('case 5: HTTP 503 throws FeedFetchError code=network', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response('Service Unavailable', { status: 503 }),
    );
    await expect(fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 200 })).rejects.toMatchObject({
      name: 'FeedFetchError',
      code: 'network',
    });
  });

  it('case 6: network error throws FeedFetchError code=network', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 200 })).rejects.toBeInstanceOf(FeedFetchError);
  });

  it('case 7: invalid JSON throws FeedFetchError code=parse', async () => {
    vi.stubGlobal('fetch', async () =>
      new Response('<html>not json</html>', { status: 200 }),
    );
    await expect(fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 200 })).rejects.toBeInstanceOf(FeedFetchError);
  });

  it('case 8: defaultSourceLabel overrides item sourceLabel', async () => {
    vi.stubGlobal('fetch', async () =>
      jsonResponse({
        err_no: 0,
        err_msg: 'success',
        cursor: '0',
        has_more: false,
        data: [
          {
            item_type: 2,
            item_info: {
              article_id: 'ios1',
              article_info: {
                title: 'iOS Article',
                brief_content: 'brief',
                cover_image: '',
                ctime: '1714000000',
                mtime: '1714000000',
              },
              author_user_info: { user_name: '李四', user_id: 'u2' },
            },
          },
        ],
      }),
    );
    const items = await fetchCateFeed({
      cateId: IOS_CATE_ID,
      sortType: 200,
      defaultSourceLabel: '掘金 iOS · 推荐',
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.sourceLabel).toBe('掘金 iOS · 推荐');
  });

  it('case 9: withCookie=true sets credentials:include', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: MockedFetchInit) => {
      lastInit = init;
      return jsonResponse({ err_no: 0, err_msg: 'ok', data: [], cursor: '0', has_more: false });
    });
    await fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 300, withCookie: true });
    expect(lastInit?.credentials).toBe('include');
  });

  it('case 10: custom limit forwarded to body', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: MockedFetchInit) => {
      lastInit = init;
      return jsonResponse({ err_no: 0, err_msg: 'ok', data: [], cursor: '0', has_more: false });
    });
    await fetchCateFeed({ cateId: IOS_CATE_ID, sortType: 200, limit: 10 });
    const body = JSON.parse(lastInit!.body ?? '{}') as Record<string, unknown>;
    expect(body.limit).toBe(10);
  });
});
