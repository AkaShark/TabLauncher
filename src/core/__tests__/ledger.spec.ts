import { describe, it, expect, beforeEach } from 'vitest';
import { installStorageMock } from '../../../tests/helpers/chromeMock';
import {
  countRecordedDays,
  formatLocalDate,
  getAllRecorded,
  getRange,
  recordToday,
} from '../ledger';

describe('ledger', () => {
  beforeEach(() => {
    installStorageMock();
  });

  it('formatLocalDate produces yyyy-mm-dd in local tz', () => {
    const d = new Date(2026, 4, 7, 23, 30, 0); // local 2026-05-07
    expect(formatLocalDate(d)).toBe('2026-05-07');
  });

  it('recordToday writes today entry; getAllRecorded reads it back', async () => {
    const now = new Date(2026, 4, 7, 12, 0, 0);
    await recordToday(3, now);
    const map = await getAllRecorded();
    expect(map['2026-05-07']).toBe(3);
  });

  it('recordToday overwrites same-day entry on subsequent calls', async () => {
    const now = new Date(2026, 4, 7, 9, 0, 0);
    await recordToday(2, now);
    await recordToday(5, now);
    const map = await getAllRecorded();
    expect(map['2026-05-07']).toBe(5);
  });

  it('getRange(7) returns 7 ascending days, missing fills 0', async () => {
    const today = new Date(2026, 4, 7, 12, 0, 0);
    const yest = new Date(2026, 4, 6, 12, 0, 0);
    await recordToday(4, today);
    await recordToday(2, yest);

    const range = await getRange(7, today);
    expect(range).toHaveLength(7);
    expect(range[range.length - 1]).toEqual({ date: '2026-05-07', count: 4 });
    expect(range[range.length - 2]).toEqual({ date: '2026-05-06', count: 2 });
    // first 5 entries are zero
    for (let i = 0; i < 5; i++) {
      expect(range[i]?.count).toBe(0);
    }
    // dates strictly ascending
    for (let i = 1; i < range.length; i++) {
      expect(range[i]!.date > range[i - 1]!.date).toBe(true);
    }
  });

  it('getRange(30) returns 30 days, all zero on empty ledger', async () => {
    const today = new Date(2026, 4, 7, 12, 0, 0);
    const range = await getRange(30, today);
    expect(range).toHaveLength(30);
    expect(range.every((p) => p.count === 0)).toBe(true);
    expect(range[29]?.date).toBe('2026-05-07');
  });

  it('countRecordedDays counts distinct non-zero days', () => {
    expect(
      countRecordedDays({ '2026-05-01': 0, '2026-05-02': 3, '2026-05-03': 1 }),
    ).toBe(2);
    expect(countRecordedDays({})).toBe(0);
  });

  it('crossing local midnight creates a new key', async () => {
    const yest = new Date(2026, 4, 6, 23, 50, 0);
    const today = new Date(2026, 4, 7, 0, 5, 0);
    await recordToday(1, yest);
    await recordToday(2, today);
    const map = await getAllRecorded();
    expect(map['2026-05-06']).toBe(1);
    expect(map['2026-05-07']).toBe(2);
  });

  it('recordToday clamps negative / NaN to 0', async () => {
    const now = new Date(2026, 4, 7, 12, 0, 0);
    await recordToday(-3, now);
    await recordToday(Number.NaN, now);
    const map = await getAllRecorded();
    expect(map['2026-05-07']).toBe(0);
  });
});
