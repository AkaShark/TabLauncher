/**
 * Simple Chinese relative-time formatter for feed cards.
 *
 *   < 60s            → "刚刚"
 *   < 60m            → "N 分钟前"
 *   < 24h            → "N 小时前"
 *   < 7d             → "N 天前"
 *   else             → "yyyy-mm-dd"
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function relativeTime(ms: number, now: number = Date.now()): string {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const diff = now - ms;
  if (diff < 0) {
    // Future timestamp — fall through to absolute date.
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '刚刚';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
