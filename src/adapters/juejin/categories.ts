/**
 * Built-in Juejin category definitions for the category feed adapter.
 *
 * v1 ships iOS only. Future categories (android, frontend, backend, etc.)
 * can be added to JUEJIN_CATEGORIES without changing any other code.
 */

export interface JuejinCategory {
  /** cate_id passed to recommend_cate_feed body. */
  id: string;
  /** Human-readable display name (e.g. "iOS"). */
  label: string;
}

export const JUEJIN_CATEGORIES: Record<string, JuejinCategory> = {
  ios: { id: '6809635626661445640', label: 'iOS' },
  // v1.1 hook: add android, frontend, backend, etc.
};
