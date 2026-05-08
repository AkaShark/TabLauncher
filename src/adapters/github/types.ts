/**
 * GitHub Trending raw types and normalized item shape.
 *
 * Data is sourced from juejin's relay endpoint:
 *   POST https://e.juejin.cn/resources/github
 *   Body: { category: 'trending', period, lang, offset, limit, cursor }
 *
 * The relay returns repos enriched with starCount/forkCount/owner avatar — no
 * GitHub auth required. See task brief for endpoint contract.
 */

export interface GithubRepoOwnerRaw {
  username: string;
  avatar: string;
  url: string;
}

export interface GithubRepoRaw {
  id: string;
  url: string;
  username: string;
  reponame: string;
  description: string;
  lang: string;
  langColor: string;
  detailPageUrl: string;
  starCount: number;
  forkCount: number;
  owner: GithubRepoOwnerRaw;
}

export interface GithubResp {
  code: number;
  data: GithubRepoRaw[];
}

export interface GithubItem {
  /** Stable djb2 hash of url. */
  id: string;
  url: string;
  /** owner/repo. */
  fullName: string;
  owner: string;
  repo: string;
  description: string;
  language: string;
  languageColor: string;
  stars: number;
  forks: number;
  ownerAvatar: string | null;
}

export type GithubPeriod = 'day' | 'week' | 'month';

export interface GithubConfig {
  enabled: boolean;
  period: GithubPeriod;
  /** Empty string '' = all languages. */
  lang: string;
  limit: number;
}

export const DEFAULT_GITHUB_CONFIG: GithubConfig = {
  enabled: true,
  period: 'day',
  lang: '',
  limit: 25,
};
