// Validated categorical palette (CVD-safe order) + status colors, ported from
// the vanilla toolkit's improved Charts tab. See the dataviz skill's
// references/palette.md for how these were derived/validated.
export const FILLER_COLORS = {
  Ah: '#2a78d6', Um: '#1baf7a', Er: '#eda100', Well: '#008300',
  So: '#4a3aa7', Like: '#e34948', But: '#e87ba4', Repeats: '#eb6834',
  Other: '#898781',
};

export const CATS = ['Table Topics', 'Speech', 'Evaluator'];
export const CAT_COLORS = { 'Table Topics': '#E67E22', Speech: '#772432', Evaluator: '#004165' };
export const CAT_GREEN = { 'Table Topics': 60, Speech: 300, Evaluator: 120 };
export const CAT_RED = { 'Table Topics': 120, Speech: 420, Evaluator: 180 };

export function boxStats(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const med = s.length % 2 ? s[Math.floor(s.length / 2)] : Math.round((s[Math.floor(s.length / 2) - 1] + s[Math.floor(s.length / 2)]) / 2);
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  const min = Math.max(s[0], q1 - 1.5 * iqr);
  const max = Math.min(s[s.length - 1], q3 + 1.5 * iqr);
  return { min, q1, med, q3, max, all: arr };
}

export function fmtDate(val) {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  } catch {
    return String(val);
  }
}
