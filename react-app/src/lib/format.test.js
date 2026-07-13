import { describe, it, expect } from 'vitest';
import { secToMmSs } from './format';

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
