/**
 * GitHub Trending connector — relays via juejin's public endpoint.
 *
 * Endpoint: POST https://e.juejin.cn/resources/github
 * Body: { category: 'trending', period, lang, offset, limit, cursor }
 *
 * No auth required. We never send the user's juejin cookie here (different
 * subdomain — `e.juejin.cn` vs the api.* / *.juejin.cn cookies).
 */

import { normalizeGithubFeed } from './normalizer';
import type { GithubItem, GithubPeriod, GithubResp } from './types';

const ENDPOINT = 'https://e.juejin.cn/resources/github';
const FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_LIMIT = 25;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const EXTENSION_VERSION_HEADER = '1.0.3';

export type GithubFetchErrorCode = 'network' | 'parse' | 'timeout' | 'api';

export class GithubFetchError extends Error {
  readonly code: GithubFetchErrorCode;
  constructor(message: string, code: GithubFetchErrorCode) {
    super(message);
    this.name = 'GithubFetchError';
    this.code = code;
  }
}

export interface FetchTrendingOptions {
  period: GithubPeriod;
  lang?: string;
  limit?: number;
}

export async function fetchTrending(opts: FetchTrendingOptions): Promise<GithubItem[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'x-extension-version': EXTENSION_VERSION_HEADER,
      },
      body: JSON.stringify({
        category: 'trending',
        period: opts.period,
        lang: opts.lang ?? '',
        offset: 0,
        limit,
        cursor: '0',
      }),
      credentials: 'omit',
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new GithubFetchError('github: timeout', 'timeout');
    }
    throw new GithubFetchError(
      `github: network error: ${(e as Error).message ?? String(e)}`,
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new GithubFetchError(`github: http ${res.status}`, 'network');
  }

  let body: GithubResp;
  try {
    body = (await res.json()) as GithubResp;
  } catch (e) {
    throw new GithubFetchError(
      `github: invalid json: ${(e as Error).message ?? String(e)}`,
      'parse',
    );
  }

  if (!body || typeof body.code !== 'number') {
    throw new GithubFetchError('github: schema mismatch (missing code)', 'parse');
  }
  if (body.code !== 200) {
    throw new GithubFetchError(`github: api error code=${body.code}`, 'api');
  }
  if (!Array.isArray(body.data)) {
    throw new GithubFetchError('github: schema mismatch (data not array)', 'parse');
  }

  return normalizeGithubFeed(body.data);
}
