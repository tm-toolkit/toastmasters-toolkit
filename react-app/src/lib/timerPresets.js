import { parseMmSs } from './format';

// [green_sec, yellow_sec, red_sec] per speech type.
export const TIMER_PRESETS = {
  topics: [60, 90, 120],
  speech57: [300, 360, 420],
  speech46: [240, 300, 360],
  eval: [120, 150, 180],
};

export const TYPE_LABELS = {
  speech57: 'Speech', eval: 'Evaluator', topics: 'Table Topics', speech46: 'Speech', custom: 'Custom',
};

// For 'custom', pass the raw mm:ss text (from the Total time input); green/yellow
// auto-distribute at 75%/87.5% of the total, same as the vanilla toolkit.
export function getPreset(type, customText) {
  if (type === 'custom') {
    const totalSec = parseMmSs(customText || '15:00');
    return [Math.round(totalSec * 0.75), Math.round(totalSec * 0.875), totalSec];
  }
  return TIMER_PRESETS[type] || TIMER_PRESETS.speech57;
}

// Official Toastmasters rule: a speaker must reach the minimum (green) time —
// no grace there — but may run up to 30 seconds past the maximum (red) time
// and still qualify. Going over by more than that is what actually counts as
// over time. (This 30-second grace is the same one printed in the Timer's
// own opening script: "Red: Time is up! You have 30 seconds to finish.")
export const OVERTIME_GRACE_SEC = 30;

export function isWithinTime(elapsed, green, red) {
  return (elapsed || 0) >= (green || 0) && (elapsed || 0) <= (red || 0) + OVERTIME_GRACE_SEC;
}
