/**
 * Parse a juejin.cn curl command (copied from Chrome DevTools Network →
 * "Copy as cURL") and extract the credentials needed by `fetchCateFeed`:
 *
 *   - `uuid`        — `?uuid=` query parameter on the request URL
 *   - `csrfToken`   — value of the `x-secsdk-csrf-token` request header.
 *                     Falls back to the `csrf_session_id` cookie value if the
 *                     header carries only the second segment (rare).
 *
 * The parser is intentionally permissive about quoting and line continuations
 * so users can paste the full multi-line `curl ... \` blob unmodified.
 */
export type CurlParseResult =
  | { ok: true; uuid: string; csrfToken: string }
  | { ok: false; error: string };

/** Strip line-continuations (`\\\n`) and collapse trailing whitespace. */
function normalize(input: string): string {
  return input.replace(/\\\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Match a quoted argument after `flag` — supports both `'...'` and `"..."`. */
function matchQuoted(
  input: string,
  flagPattern: RegExp,
): string | null {
  const m = input.match(flagPattern);
  if (!m) return null;
  return m[1] ?? m[2] ?? null;
}

function extractUuid(text: string): string | null {
  // Look for `uuid=` inside any URL-ish substring. URL params end at `&`,
  // whitespace, or quote.
  const m = text.match(/[?&]uuid=([^&\s'"]+)/);
  return m && m[1] ? m[1] : null;
}

function extractCsrfHeader(text: string): string | null {
  // -H 'x-secsdk-csrf-token: <value>'  (case-insensitive on header name)
  const re =
    /-H\s+(?:'([^']*x-secsdk-csrf-token[^']*)'|"([^"]*x-secsdk-csrf-token[^"]*)")/i;
  const raw = matchQuoted(text, re);
  if (!raw) return null;
  const idx = raw.toLowerCase().indexOf('x-secsdk-csrf-token');
  if (idx < 0) return null;
  const after = raw.slice(idx + 'x-secsdk-csrf-token'.length).replace(/^\s*:\s*/, '');
  return after.trim() || null;
}

function extractCookie(text: string, name: string): string | null {
  const re = /-(?:b|-cookie)\s+(?:'([^']+)'|"([^"]+)")/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const cookieJar = match[1] ?? match[2] ?? '';
    for (const pair of cookieJar.split(';')) {
      const [k, ...rest] = pair.trim().split('=');
      if (k === name) return rest.join('=').trim() || null;
    }
  }
  return null;
}

export function parseJuejinCurl(input: string): CurlParseResult {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { ok: false, error: 'empty input' };
  }
  const text = normalize(input);

  const uuid = extractUuid(text);
  if (!uuid) return { ok: false, error: 'no uuid in url' };

  let csrfToken = extractCsrfHeader(text);
  if (!csrfToken) {
    return { ok: false, error: 'no csrf header' };
  }
  // CSRF token format: "<ts>,<random>" — if header carries only the timestamp
  // segment, attempt to splice in `csrf_session_id` cookie.
  if (!csrfToken.includes(',')) {
    const cookieCsrf = extractCookie(text, 'csrf_session_id');
    if (cookieCsrf) {
      csrfToken = `${csrfToken},${cookieCsrf}`;
    } else {
      return { ok: false, error: 'invalid csrf format' };
    }
  }

  return { ok: true, uuid, csrfToken };
}
