import { describe, it, expect } from 'vitest';
import { getPreset, isWithinTime, TIMER_PRESETS } from './timerPresets';

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

describe('isWithinTime', () => {
  const [green, , red] = TIMER_PRESETS.speech57; // 300, 420

  it('qualifies a speech right at the minimum', () => {
    expect(isWithinTime(green, green, red)).toBe(true);
  });

  it('qualifies a speech right at the maximum', () => {
    expect(isWithinTime(red, green, red)).toBe(true);
  });

  it('still qualifies up to 30 seconds past the maximum (grace period)', () => {
    expect(isWithinTime(red + 15, green, red)).toBe(true); // the reported 7:15 on a 5-7 min speech
    expect(isWithinTime(red + 30, green, red)).toBe(true);
  });

  it('disqualifies more than 30 seconds past the maximum', () => {
    expect(isWithinTime(red + 31, green, red)).toBe(false);
  });

  it('disqualifies under the minimum with no grace period', () => {
    expect(isWithinTime(green - 1, green, red)).toBe(false);
  });
});
