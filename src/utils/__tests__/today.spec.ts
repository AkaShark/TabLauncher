import { describe, it, expect } from 'vitest';
import { isDueByEndOfToday, endOfTodayMs } from '../today';

describe('isDueByEndOfToday', () => {
  const now = new Date('2026-05-07T10:00:00');

  it('returns false for null/undefined/empty', () => {
    expect(isDueByEndOfToday(null, now)).toBe(false);
    expect(isDueByEndOfToday(undefined, now)).toBe(false);
    expect(isDueByEndOfToday('', now)).toBe(false);
  });

  it('returns false for invalid date string', () => {
    expect(isDueByEndOfToday('not-a-date', now)).toBe(false);
  });

  it('returns true for past dates', () => {
    expect(isDueByEndOfToday('2024-01-01T00:00:00Z', now)).toBe(true);
  });

  it('returns true for earlier today', () => {
    const earlier = new Date(now);
    earlier.setHours(2, 0, 0, 0);
    expect(isDueByEndOfToday(earlier.toISOString(), now)).toBe(true);
  });

  it('returns true for end-of-today exactly', () => {
    const eod = new Date(endOfTodayMs(now));
    expect(isDueByEndOfToday(eod.toISOString(), now)).toBe(true);
  });

  it('returns false for tomorrow', () => {
    const tomorrow = new Date(endOfTodayMs(now) + 1);
    expect(isDueByEndOfToday(tomorrow.toISOString(), now)).toBe(false);
  });

  it('handles ISO with timezone offset', () => {
    // Same wall-clock-equivalent time as now should still be <= EOD today.
    expect(isDueByEndOfToday('2026-05-07T10:00:00Z', now)).toBe(true);
  });
});
