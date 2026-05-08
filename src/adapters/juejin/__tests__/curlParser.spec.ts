import { describe, it, expect } from 'vitest';
import { parseJuejinCurl } from '../curlParser';

const FULL_CURL = `curl 'https://api.juejin.cn/recommend_api/v1/article/recommend_cate_feed?aid=6587&uuid=7300000000000000001&spider=0' \\
  -H 'accept: */*' \\
  -H 'content-type: application/json' \\
  -H 'x-secsdk-csrf-token: 0001000000017a0aabcdef,session-1234' \\
  -b 'sessionid=abc; csrf_session_id=session-1234; non_related=1' \\
  --data-raw '{"id_type":2,"client_type":6587,"sort_type":200,"cursor":"0","limit":30,"cate_id":"6809637767543259144"}'`;

describe('parseJuejinCurl', () => {
  it('parses a complete multi-line curl', () => {
    const r = parseJuejinCurl(FULL_CURL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.uuid).toBe('7300000000000000001');
      expect(r.csrfToken).toBe('0001000000017a0aabcdef,session-1234');
    }
  });

  it('rejects when uuid query param is missing', () => {
    const noUuid = FULL_CURL.replace(/&uuid=[^&]+/, '');
    const r = parseJuejinCurl(noUuid);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('no uuid in url');
  });

  it('rejects when x-secsdk-csrf-token header is missing', () => {
    const noCsrf = FULL_CURL.replace(
      /-H 'x-secsdk-csrf-token:[^']+'\s*\\\n\s*/i,
      '',
    );
    const r = parseJuejinCurl(noCsrf);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('no csrf header');
  });

  it('handles double-quoted args (Windows-style curl copies)', () => {
    const dq = `curl "https://api.juejin.cn/recommend_api/v1/article/recommend_cate_feed?aid=6587&uuid=99999&spider=0" -H "x-secsdk-csrf-token: deadbeef,session-9" -b "csrf_session_id=session-9"`;
    const r = parseJuejinCurl(dq);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.uuid).toBe('99999');
      expect(r.csrfToken).toBe('deadbeef,session-9');
    }
  });

  it('splices csrf cookie when header lacks the second segment', () => {
    const partial = `curl 'https://api.juejin.cn/x?uuid=42' -H 'x-secsdk-csrf-token: only-ts' -b 'csrf_session_id=cookie-half'`;
    const r = parseJuejinCurl(partial);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.csrfToken).toBe('only-ts,cookie-half');
  });

  it('returns invalid csrf format when header lacks comma and no cookie present', () => {
    const noCookie = `curl 'https://api.juejin.cn/x?uuid=1' -H 'x-secsdk-csrf-token: lonely'`;
    const r = parseJuejinCurl(noCookie);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid csrf format');
  });

  it('rejects empty input', () => {
    const r = parseJuejinCurl('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('empty input');
  });
});
