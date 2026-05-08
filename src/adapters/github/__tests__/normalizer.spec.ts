import { describe, it, expect } from 'vitest';
import { normalizeGithubItem, normalizeGithubFeed } from '../normalizer';
import type { GithubRepoRaw } from '../types';

function makeRaw(overrides: Partial<GithubRepoRaw> = {}): GithubRepoRaw {
  return {
    id: '/owner/repo',
    url: 'https://github.com/owner/repo',
    username: 'owner',
    reponame: 'repo',
    description: 'a cool project',
    lang: 'Swift',
    langColor: '#ffac45',
    detailPageUrl: 'https://github.com/owner/repo',
    starCount: 1234,
    forkCount: 56,
    owner: {
      username: 'owner',
      avatar: 'https://example.com/a.png',
      url: 'https://github.com/owner',
    },
    ...overrides,
  };
}

describe('normalizeGithubItem', () => {
  it('case 1: maps full raw → GithubItem fields correctly', () => {
    const out = normalizeGithubItem(makeRaw());
    expect(out).not.toBeNull();
    expect(out!.fullName).toBe('owner/repo');
    expect(out!.url).toBe('https://github.com/owner/repo');
    expect(out!.description).toBe('a cool project');
    expect(out!.language).toBe('Swift');
    expect(out!.languageColor).toBe('#ffac45');
    expect(out!.stars).toBe(1234);
    expect(out!.forks).toBe(56);
    expect(out!.ownerAvatar).toBe('https://example.com/a.png');
    expect(out!.id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('case 2: missing description defaults to empty string', () => {
    const raw = makeRaw();
    // simulate API omitting description
    (raw as { description: unknown }).description = undefined;
    const out = normalizeGithubItem(raw);
    expect(out!.description).toBe('');
  });

  it('case 3: missing lang/langColor defaults to empty string', () => {
    const raw = makeRaw();
    (raw as { lang: unknown }).lang = undefined;
    (raw as { langColor: unknown }).langColor = undefined;
    const out = normalizeGithubItem(raw);
    expect(out!.language).toBe('');
    expect(out!.languageColor).toBe('');
  });

  it('case 4: same url yields stable id; different url yields different id', () => {
    const a = normalizeGithubItem(makeRaw());
    const b = normalizeGithubItem(makeRaw());
    const c = normalizeGithubItem(
      makeRaw({ url: 'https://github.com/other/proj', reponame: 'proj', username: 'other' }),
    );
    expect(a!.id).toBe(b!.id);
    expect(a!.id).not.toBe(c!.id);
  });

  it('case 5: missing url returns null', () => {
    const raw = makeRaw({ url: '' });
    const out = normalizeGithubItem(raw);
    expect(out).toBeNull();
  });

  it('case 6: normalizeGithubFeed dedupes by id and skips invalid', () => {
    const a = makeRaw();
    const dup = makeRaw();
    const bad = makeRaw({ url: '' });
    const out = normalizeGithubFeed([a, dup, bad]);
    expect(out).toHaveLength(1);
  });
});
