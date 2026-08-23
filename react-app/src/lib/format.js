export function secToMmSs(s) {
  return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}

// Accepts "mm:ss" or a plain number of seconds; anything else (or negative) → 0.
export function parseMmSs(str) {
  const parts = str.trim().split(':');
  const sec = parts.length === 2
    ? (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0)
    : parseInt(str, 10) || 0;
  return Math.max(0, sec);
}
