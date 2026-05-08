/**
 * Per-source RSS fetcher.
 *
 * MV3 service workers do NOT have DOMParser available, so this module is split:
 *   - `fetchFeedXml(source)` — used by the service worker; returns raw XML.
 *   - `fetchAndParseFeed(source)` — used in the foreground (newtab/options) where
 *     DOMParser is available; combines fetch + parse + filter.
 *
 * Both honor 8s AbortController timeout + a single 5xx retry (plan §M4).
 */

import { parseRssXml } from './rss';
import type { FeedItem, FeedSourceConfig } from './types';

const FETCH_TIMEOUT_MS = 8_000;
const MAX_5XX_RETRIES = 1;

export type FeedFetchErrorCode =
  | 'network'
  | 'parse'
  | 'permission'
  | 'http'
  | 'timeout'
  | 'no-creds';

export class FeedFetchError extends Error {
  constructor(
    message: string,
    public readonly code: FeedFetchErrorCode,
  ) {
    super(message);
    this.name = 'FeedFetchError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOnce(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Accept:
          'application/atom+xml, application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
      },
      signal: ctrl.signal,
      credentials: 'omit',
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch raw XML for one source. Implements 8s timeout + a single 5xx retry.
 * Throws FeedFetchError.
 */
export async function fetchFeedXml(source: FeedSourceConfig): Promise<string> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let res: Response;
    try {
      res = await fetchOnce(source.url, FETCH_TIMEOUT_MS);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new FeedFetchError(`timeout fetching ${source.url}`, 'timeout');
      }
      throw new FeedFetchError(
        `network error: ${(e as Error).message ?? String(e)}`,
        'network',
      );
    }

    if (res.status >= 500 && attempt < MAX_5XX_RETRIES) {
      attempt++;
      await sleep(300);
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      throw new FeedFetchError(`permission denied (${res.status})`, 'permission');
    }
    if (!res.ok) {
      throw new FeedFetchError(`http ${res.status} fetching ${source.url}`, 'http');
    }
    return await res.text();
  }
}

/**
 * Foreground-only convenience: fetch + parse + filter. DOMParser must be available.
 */
export async function fetchAndParseFeed(source: FeedSourceConfig): Promise<FeedItem[]> {
  const xml = await fetchFeedXml(source);
  let items: FeedItem[];
  try {
    items = parseRssXml(xml, source.id, source.label);
  } catch (e) {
    throw new FeedFetchError(
      `parse error: ${(e as Error).message ?? String(e)}`,
      'parse',
    );
  }
  // Drop entries missing a title or url (already filtered in parseRssXml, but be defensive).
  return items.filter((it) => it.title && it.url);
}
