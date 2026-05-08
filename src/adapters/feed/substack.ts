/**
 * Substack handle → RSS URL builder.
 *
 * Accepts:
 *   - "myname"
 *   - "myname.substack.com"
 *   - "https://myname.substack.com/"
 *   - "https://myname.substack.com/feed"
 * Output: https://<handle>.substack.com/feed
 */

const HANDLE_RE = /^[a-z0-9][a-z0-9-]*$/i;

function extractHandle(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('substack: empty input');

  // URL form?
  let s = trimmed;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const u = new URL(s);
      s = u.host;
    } catch {
      throw new Error(`substack: invalid url ${trimmed}`);
    }
  }
  // Strip trailing slashes / paths
  s = s.replace(/\/.*$/, '').toLowerCase();

  // host like myname.substack.com → "myname"
  const hostMatch = /^([a-z0-9][a-z0-9-]*)\.substack\.com$/.exec(s);
  if (hostMatch && hostMatch[1]) return hostMatch[1];

  // Bare handle
  if (HANDLE_RE.test(s)) return s;

  throw new Error(`substack: cannot extract handle from "${trimmed}"`);
}

export function substackUrl(input: string): string {
  const handle = extractHandle(input);
  return `https://${handle}.substack.com/feed`;
}

export function substackLabel(input: string): string {
  const handle = extractHandle(input);
  return `Substack · ${handle}`;
}
