import { describe, it, expect } from 'vitest';
import { secToMmSs, parseMmSs } from './format';

describe('secToMmSs', () => {
  it('formats whole minutes', () => {
    expect(secToMmSs(60)).toBe('1:00');
  });
  it('pads single-digit seconds', () => {
    expect(secToMmSs(65)).toBe('1:05');
  });
  it('handles zero', () => {
    expect(secToMmSs(0)).toBe('0:00');
  });
  it('handles more than an hour without special-casing hours', () => {
    expect(secToMmSs(3661)).toBe('61:01');
  });
});

describe('parseMmSs', () => {
  it('parses mm:ss', () => {
    expect(parseMmSs('1:05')).toBe(65);
  });
  it('parses a plain number of seconds', () => {
    expect(parseMmSs('90')).toBe(90);
  });
  it('treats garbage input as 0', () => {
    expect(parseMmSs('abc')).toBe(0);
  });
  it('clamps negative results to 0', () => {
    expect(parseMmSs('-10')).toBe(0);
  });
  it('round-trips with secToMmSs', () => {
    expect(parseMmSs(secToMmSs(185))).toBe(185);
  });
});
