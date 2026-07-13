import { describe, it, expect } from 'vitest';
import { getPreset, parseMmSs, TIMER_PRESETS } from './timerPresets';

describe('parseMmSs', () => {
  it('parses mm:ss into total seconds', () => {
    expect(parseMmSs('2:30')).toBe(150);
  });
  it('parses a bare number of seconds', () => {
    expect(parseMmSs('90')).toBe(90);
  });
  it('returns 0 for garbage input', () => {
    expect(parseMmSs('')).toBe(0);
    expect(parseMmSs('abc')).toBe(0);
  });
});

describe('getPreset', () => {
  it('returns the known preset for a standard type', () => {
    expect(getPreset('topics')).toEqual(TIMER_PRESETS.topics);
  });

  it('falls back to speech57 for an unknown type', () => {
    expect(getPreset('made-up-type')).toEqual(TIMER_PRESETS.speech57);
  });

  it('auto-distributes green/yellow/red as 75%/87.5%/100% of a custom total', () => {
    const [g, y, r] = getPreset('custom', '10:00'); // 600s total
    expect(r).toBe(600);
    expect(g).toBe(450); // 75%
    expect(y).toBe(525); // 87.5%
  });

  it('defaults the custom total to 15:00 when no text is given', () => {
    const [, , r] = getPreset('custom', '');
    expect(r).toBe(900);
  });
});
