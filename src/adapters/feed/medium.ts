/**
 * Medium input → RSS URL builder.
 *
 * Accepts:
 *   - "@yegor256"            → https://medium.com/feed/@yegor256
 *   - "yegor256"             → https://medium.com/feed/@yegor256 (assume user)
 *   - "publication-name"     → https://medium.com/feed/publication-name
 *   - "tag/foo"              → https://medium.com/feed/tag/foo
 *   - URLs of any of the above
 *
 * Resolution rule:
 *   - "@x" → user feed
 *   - "tag/x" → tag feed
 *   - bare slug → publication feed (Medium serves both user/publication on same path,
 *     but @-prefixed user URLs are canonical; we treat bare slugs as publications).
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;
const USER_RE = /^@[a-z0-9][a-z0-9._-]*$/i;
const TAG_RE = /^tag\/[a-z0-9][a-z0-9-]*$/i;

function normalize(input: string): string {
  let s = input.trim();
  if (!s) throw new Error('medium: empty input');

  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const u = new URL(s);
      // /feed/@user, /feed/pub, /feed/tag/x → strip /feed
      let path = u.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      if (path.startsWith('feed/')) path = path.slice(5);
      s = path;
    } catch {
      throw new Error(`medium: invalid url ${input}`);
    }
  }

  // Strip leading slashes.
  s = s.replace(/^\/+/, '').replace(/\/+$/, '');

  return s;
}

interface MediumPath {
  /** Final path segment after medium.com/feed/. */
  path: string;
  /** Display label. */
  label: string;
}

function resolve(input: string): MediumPath {
  const s = normalize(input);
  if (USER_RE.test(s)) return { path: s, label: `Medium · ${s}` };
  if (TAG_RE.test(s)) return { path: s, label: `Medium · #${s.slice(4)}` };
  if (SLUG_RE.test(s)) {
    // Bare slug — treat as publication.
    return { path: s, label: `Medium · ${s}` };
  }
  // "@x" without leading at? handled by USER_RE; if user supplied bare username intending @,
  // they should use @user. Assume publication for safety.
  throw new Error(`medium: cannot interpret "${input}"`);
}

export function mediumUrl(input: string): string {
  const { path } = resolve(input);
  return `https://medium.com/feed/${path}`;
}

export function mediumLabel(input: string): string {
  return resolve(input).label;
}
