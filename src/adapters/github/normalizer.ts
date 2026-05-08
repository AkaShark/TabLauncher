/**
 * Github raw repo → GithubItem normalizer.
 *
 * Stable id is a djb2 hash of the canonical url so the same repo dedupes
 * across refreshes regardless of period/lang shuffling.
 */

import type { GithubItem, GithubRepoRaw } from './types';

function stableId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function normalizeGithubItem(raw: GithubRepoRaw): GithubItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const url = typeof raw.url === 'string' && raw.url.length > 0 ? raw.url : '';
  const owner = typeof raw.username === 'string' ? raw.username : '';
  const repo = typeof raw.reponame === 'string' ? raw.reponame : '';
  if (!url || !owner || !repo) return null;

  const fullName = `${owner}/${repo}`;
  const description = typeof raw.description === 'string' ? raw.description : '';
  const language = typeof raw.lang === 'string' ? raw.lang : '';
  const languageColor = typeof raw.langColor === 'string' ? raw.langColor : '';
  const stars = Number.isFinite(raw.starCount) ? Number(raw.starCount) : 0;
  const forks = Number.isFinite(raw.forkCount) ? Number(raw.forkCount) : 0;
  const ownerAvatar =
    raw.owner && typeof raw.owner.avatar === 'string' && raw.owner.avatar.length > 0
      ? raw.owner.avatar
      : null;

  return {
    id: stableId(`github:${url}`),
    url,
    fullName,
    owner,
    repo,
    description,
    language,
    languageColor,
    stars,
    forks,
    ownerAvatar,
  };
}

export function normalizeGithubFeed(raw: GithubRepoRaw[]): GithubItem[] {
  if (!Array.isArray(raw)) return [];
  const out: GithubItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const item = normalizeGithubItem(r);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}
