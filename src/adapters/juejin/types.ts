/**
 * Juejin (掘金) raw API shapes — `POST https://api.juejin.cn/recommend_api/v1/article/recommend_all_feed`.
 *
 * See `.omc/research/juejin-cookie-schema.md` §3.1 for endpoint contract.
 * v1 uses the public recommendation feed (cookie optional, no signing required).
 */

export interface JuejinArticleAuthor {
  user_name: string;
  user_id: string;
}

export interface JuejinArticleTag {
  tag_name: string;
}

export interface JuejinArticleInfo {
  title: string;
  brief_content: string;
  cover_image: string;
  /** unix seconds (string), see research §3.4 Q6. */
  ctime: string;
  mtime: string;
  /** Some entries embed the canonical link; others must be reconstructed from article_id. */
  link_url?: string;
}

export interface JuejinFeedItem {
  item_info: {
    article_id: string;
    article_info: JuejinArticleInfo;
    author_user_info?: JuejinArticleAuthor;
    tags?: JuejinArticleTag[];
  };
  /** 2 = article, 14 = official ad (filtered out). */
  item_type: number;
}

export interface JuejinFeedResponse {
  err_no: number;
  err_msg: string;
  data: JuejinFeedItem[];
  cursor: string;
  has_more: boolean;
}
