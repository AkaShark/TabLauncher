import { describe, it, expect } from 'vitest';
import { relativeTime } from '../relativeTime';

const NOW = new Date('2026-05-07T12:00:00Z').getTime();

describe('relativeTime', () => {
  it('case 1: < 60s → "刚刚"', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('刚刚');
    expect(relativeTime(NOW - 59_000, NOW)).toBe('刚刚');
  });

  it('case 2: < 60min → "X 分钟前"', () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5 分钟前');
    expect(relativeTime(NOW - 59 * 60_000, NOW)).toBe('59 分钟前');
  });

  it('case 3: < 24h → "X 小时前"', () => {
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3 小时前');
    expect(relativeTime(NOW - 23 * 3_600_000, NOW)).toBe('23 小时前');
  });

  it('case 4: < 7d → "X 天前"', () => {
    expect(relativeTime(NOW - 2 * 86_400_000, NOW)).toBe('2 天前');
    expect(relativeTime(NOW - 6 * 86_400_000, NOW)).toBe('6 天前');
  });

  it('case 5: >= 7d → "yyyy-mm-dd" absolute date', () => {
    // 10 days ago from 2026-05-07 → 2026-04-27
    expect(relativeTime(NOW - 10 * 86_400_000, NOW)).toBe('2026-04-27');
  });

  it('returns "" for zero or negative ms', () => {
    expect(relativeTime(0, NOW)).toBe('');
    expect(relativeTime(-1000, NOW)).toBe('');
  });

  it('formats date correctly with zero-padded month and day', () => {
    // 2026-01-01 is well past 7 days from 2026-05-07
    const ts = new Date('2026-01-01T00:00:00Z').getTime();
    expect(relativeTime(ts, NOW)).toBe('2026-01-01');
  });
});
