/**
 * Juejin raw API → FeedItem normalizer.
 *
 * Single source id ('juejin'); sourceLabel includes author name when present
 * so cards can show provenance ("掘金 · 张三").
 */

import type { FeedItem } from '@/adapters/feed/types';
import type { JuejinFeedItem } from './types';

const SUMMARY_MAX = 280;

/** Stable id hash (djb2). Mirrors src/adapters/feed/rss.ts so dedupe works cross-source. */
function stableId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function truncate(s: string, max = SUMMARY_MAX): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max).trimEnd()}…`;
}

function ctimeToMs(ctime: string): number | null {
  if (!ctime) return null;
  const n = Number(ctime);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000);
}

export const JUEJIN_SOURCE_ID = 'juejin';
export const JUEJIN_BASE_LABEL = '掘金';

export function normalizeJuejinItem(
  raw: JuejinFeedItem,
  defaultSourceLabel?: string,
): FeedItem | null {
  // Two shapes from juejin:
  //   recommend_all_feed:  { item_info: { article_id, article_info, author_user_info }, item_type }
  //   recommend_cate_feed: { article_id, article_info, author_user_info }   (flat, no item_info / item_type)
  // Normalize by reading item_info if present, otherwise the row itself.
  const flat = raw as unknown as {
    article_id?: string;
    article_info?: JuejinFeedItem['item_info']['article_info'];
    author_user_info?: JuejinFeedItem['item_info']['author_user_info'];
  };
  const articleId = raw.item_info?.article_id ?? flat.article_id;
  const info = raw.item_info?.article_info ?? flat.article_info;
  const author =
    raw.item_info?.author_user_info?.user_name?.trim() ??
    flat.author_user_info?.user_name?.trim();
  if (!articleId || !info || !info.title) return null;

  const url = info.link_url && info.link_url.length > 0
    ? info.link_url
    : `https://juejin.cn/post/${articleId}`;

  let sourceLabel: string;
  if (defaultSourceLabel) {
    sourceLabel = defaultSourceLabel;
  } else {
    sourceLabel = author ? `${JUEJIN_BASE_LABEL} · ${author}` : JUEJIN_BASE_LABEL;
  }

  return {
    id: stableId(`juejin:${articleId}`),
    sourceId: JUEJIN_SOURCE_ID,
    sourceLabel,
    title: info.title,
    url,
    publishedAt: ctimeToMs(info.ctime),
    summary: truncate(info.brief_content ?? ''),
    thumbnail: info.cover_image && info.cover_image.length > 0 ? info.cover_image : null,
    isRead: false,
  };
}

export function normalizeJuejinFeed(
  raw: JuejinFeedItem[],
  defaultSourceLabel?: string,
): FeedItem[] {
  const out: FeedItem[] = [];
  for (const r of raw) {
    const item = normalizeJuejinItem(r, defaultSourceLabel);
    if (item) out.push(item);
  }
  return out;
}
