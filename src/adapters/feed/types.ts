/**
 * Feed adapter types — shared across RSS / Substack / Medium pipelines.
 */

export type FeedSourceType = 'rss' | 'substack' | 'medium' | 'juejin';

/**
 * Optional metadata for juejin category feed sources.
 * Present only when type === 'juejin' and url starts with 'juejin://cate/'.
 * Omitted for the legacy all-feed source (backward compatible).
 */
export interface JuejinCateMeta {
  cateId: string;
  sortType: 200 | 300;
  categoryLabel: string;
}

export interface FeedSourceConfig {
  /** uuid v4 (crypto.randomUUID). */
  id: string;
  type: FeedSourceType;
  /** Final RSS URL. Substack/Medium are normalized to RSS endpoints by the builder. */
  url: string;
  /** Human-readable label. */
  label: string;
  /** ms epoch when the source was added. */
  addedAt: number;
  enabled: boolean;
  /**
   * Optional metadata for juejin category feeds.
   * Only present when type === 'juejin' and url is 'juejin://cate/<cateId>?sort=200|300'.
   * Legacy all-feed sources have no meta field (backward compatible).
   */
  meta?: JuejinCateMeta;
}

export interface FeedItem {
  /** Stable hash used for dedupe + read-tracking. */
  id: string;
  sourceId: string;
  sourceLabel: string;
  title: string;
  url: string;
  /** ms epoch; null when missing. */
  publishedAt: number | null;
  /** HTML-stripped, truncated (~280 chars). */
  summary: string;
  thumbnail: string | null;
  isRead: boolean;
}

export interface FeedFetchFailure {
  id: string;
  label: string;
  reason: string;
}

export interface FeedFetchStats {
  ok: number;
  failed: FeedFetchFailure[];
  totalItems: number;
}
