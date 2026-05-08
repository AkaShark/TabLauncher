/**
 * Juejin recommend feed connector.
 *
 * Endpoint contract (research §3.1, [VERIFIED-2026-05-07]):
 *   POST https://api.juejin.cn/recommend_api/v1/article/recommend_all_feed
 *   Body: { id_type:2, client_type:2608, sort_type:200, cursor:"0", limit:N }
 *   Auth: none required for v1 public feed.
 *
 * Cookie handling: when withCookie=true we set credentials:'include'; chrome
 * auto-attaches juejin.cn cookies via host_permissions + the `cookies` perm.
 * We never set the Cookie header manually (SW fetch can't set forbidden headers).
 */

import { FeedFetchError } from '@/adapters/feed/fetcher';
import type { FeedItem } from '@/adapters/feed/types';
import { normalizeJuejinFeed } from './normalizer';
import type { JuejinFeedResponse } from './types';

const ENDPOINT = 'https://api.juejin.cn/recommend_api/v1/article/recommend_all_feed';
const CATE_ENDPOINT_BASE =
  'https://api.juejin.cn/recommend_api/v1/article/recommend_cate_feed';
const FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_LIMIT = 30;
const ITEM_TYPE_AD = 14;

export interface FetchRecommendOptions {
  withCookie?: boolean;
  limit?: number;
}

export async function fetchRecommendFeed(
  opts: FetchRecommendOptions = {},
): Promise<FeedItem[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_type: 2,
        client_type: 2608,
        sort_type: 200,
        cursor: '0',
        limit,
      }),
      credentials: opts.withCookie ? 'include' : 'omit',
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new FeedFetchError('juejin: timeout', 'timeout');
    }
    throw new FeedFetchError(
      `juejin: network error: ${(e as Error).message ?? String(e)}`,
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new FeedFetchError(`juejin: http ${res.status}`, 'network');
  }

  let body: JuejinFeedResponse;
  try {
    body = (await res.json()) as JuejinFeedResponse;
  } catch (e) {
    throw new FeedFetchError(
      `juejin: invalid json: ${(e as Error).message ?? String(e)}`,
      'parse',
    );
  }

  if (!body || typeof body.err_no !== 'number') {
    throw new FeedFetchError('juejin: schema mismatch (missing err_no)', 'parse');
  }
  if (body.err_no !== 0) {
    throw new FeedFetchError(
      `juejin: api error err_no=${body.err_no} ${body.err_msg ?? ''}`.trim(),
      'parse',
    );
  }
  if (!Array.isArray(body.data)) {
    throw new FeedFetchError('juejin: schema mismatch (data not array)', 'parse');
  }

  const filtered = body.data.filter((it) => it.item_type !== ITEM_TYPE_AD);
  return normalizeJuejinFeed(filtered);
}

export interface FetchCateFeedOptions {
  cateId: string;
  sortType: 200 | 300;
  withCookie?: boolean;
  limit?: number;
  /** Override sourceLabel on every returned FeedItem (e.g. "掘金 iOS · 推荐"). */
  defaultSourceLabel?: string;
  /** Real user_unique_id when known (extracted from `__tea_cookie_tokens_2608` cookie).
   * cate_feed silently returns 0 items when uuid is missing/zero. */
  uuid?: string;
  /** x-secsdk-csrf-token captured from juejin.cn page context. When supplied
   * we set the `x-secsdk-csrf-token` request header — required by cate_feed. */
  csrfToken?: string;
}

/**
 * Fetch a category-specific Juejin feed.
 *
 * Endpoint: POST https://api.juejin.cn/recommend_api/v1/article/recommend_cate_feed?aid=6587[&uuid=...][&spider=0]
 * Body: { id_type:2, client_type:6587, sort_type, cursor:"0", limit, cate_id }
 *
 * sortType 200 = 推荐, 300 = 最新.
 *
 * Auth: cate_feed requires both `uuid` (query param) and `x-secsdk-csrf-token`
 * (request header). Callers must source these from storage (see
 * src/core/juejinCreds.ts) — the user pastes a curl from a logged-in juejin.cn
 * Network panel and we extract the pair.
 */
export async function fetchCateFeed(opts: FetchCateFeedOptions): Promise<FeedItem[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  const params = new URLSearchParams({ aid: '6587', spider: '0' });
  if (opts.uuid) params.set('uuid', opts.uuid);
  const endpoint = `${CATE_ENDPOINT_BASE}?${params.toString()}`;

  let res: Response;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    };
    if (opts.csrfToken) headers['x-secsdk-csrf-token'] = opts.csrfToken;
    const requestBody = JSON.stringify({
      id_type: 2,
      client_type: 6587,
      sort_type: opts.sortType,
      cursor: '0',
      limit,
      cate_id: opts.cateId,
    });
    console.log('[AIRSS juejin cate] POST', endpoint, 'body:', requestBody, 'csrf-prefix:', opts.csrfToken?.slice(0, 16));
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
      credentials: opts.withCookie ? 'include' : 'omit',
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new FeedFetchError('juejin cate: timeout', 'timeout');
    }
    throw new FeedFetchError(
      `juejin cate: network error: ${(e as Error).message ?? String(e)}`,
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new FeedFetchError(`juejin cate: http ${res.status}`, 'network');
  }

  let body: JuejinFeedResponse;
  try {
    const text = await res.text();
    console.log('[AIRSS juejin cate] raw response (truncated):', text.slice(0, 500));
    body = JSON.parse(text) as JuejinFeedResponse;
  } catch (e) {
    throw new FeedFetchError(
      `juejin cate: invalid json: ${(e as Error).message ?? String(e)}`,
      'parse',
    );
  }

  if (!body || typeof body.err_no !== 'number') {
    throw new FeedFetchError('juejin cate: schema mismatch (missing err_no)', 'parse');
  }
  if (body.err_no !== 0) {
    throw new FeedFetchError(
      `juejin cate: api error err_no=${body.err_no} ${body.err_msg ?? ''}`.trim(),
      'parse',
    );
  }
  if (!Array.isArray(body.data)) {
    throw new FeedFetchError('juejin cate: schema mismatch (data not array)', 'parse');
  }

  const filtered = body.data.filter((it) => it.item_type !== ITEM_TYPE_AD);
  return normalizeJuejinFeed(filtered, opts.defaultSourceLabel);
}
