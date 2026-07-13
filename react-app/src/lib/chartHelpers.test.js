import { describe, it, expect } from 'vitest';
import { boxStats, fmtDate } from './chartHelpers';

describe('boxStats', () => {
  it('returns null for an empty array', () => {
    expect(boxStats([])).toBeNull();
  });

  it('computes median/quartiles for an odd-length array', () => {
    const s = boxStats([10, 20, 30, 40, 50]);
    expect(s.med).toBe(30);
    expect(s.min).toBeLessThanOrEqual(s.q1);
    expect(s.q1).toBeLessThanOrEqual(s.med);
    expect(s.med).toBeLessThanOrEqual(s.q3);
    expect(s.q3).toBeLessThanOrEqual(s.max);
  });

  it('clamps whiskers to the 1.5*IQR fence, not the raw min/max, when there are outliers', () => {
    const s = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 1000]);
    expect(s.max).toBeLessThan(1000); // the outlier gets fenced off
  });

  it('keeps every original value in .all', () => {
    const arr = [5, 3, 8, 1];
    expect(boxStats(arr).all).toEqual(arr);
  });
});

describe('fmtDate', () => {
  it('passes through an already-ISO date string unchanged', () => {
    expect(fmtDate('2026-07-13')).toBe('2026-07-13');
  });

  it('normalizes other date formats to YYYY-MM-DD', () => {
    expect(fmtDate('07/13/2026')).toBe('2026-07-13');
  });

  it('returns an empty string for falsy input', () => {
    expect(fmtDate('')).toBe('');
    expect(fmtDate(null)).toBe('');
  });

  it('falls back to stringifying unparseable input rather than throwing', () => {
    expect(fmtDate('not-a-date')).toBe('not-a-date');
  });
});
