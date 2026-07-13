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

export function parseMmSs(str) {
  const parts = String(str).trim().split(':');
  if (parts.length === 2) return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  return parseInt(str, 10) || 0;
}

// For 'custom', pass the raw mm:ss text (from the Total time input); green/yellow
// auto-distribute at 75%/87.5% of the total, same as the vanilla toolkit.
export function getPreset(type, customText) {
  if (type === 'custom') {
    const totalSec = parseMmSs(customText || '15:00');
    return [Math.round(totalSec * 0.75), Math.round(totalSec * 0.875), totalSec];
  }
  return TIMER_PRESETS[type] || TIMER_PRESETS.speech57;
}
