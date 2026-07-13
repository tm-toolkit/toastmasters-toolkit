import { fmtDate } from './chartHelpers';

// Merges local tmHistory records with Google-Sheets-loaded rows (deduped by rowId).
export function getChartDataByRole(history, sheetsData, role) {
  const local = history
    .filter((r) => r.type === role)
    .map((r) => ({
      rowId: r.rowId, date: r.date, speaker: r.speaker, category: r.cat || r.category,
      counts: r.counts || {}, total: r.total || 0,
      elapsed: r.elapsed || 0, within: r.within,
      green: r.green || 0, yellow: r.yellow || 0, red: r.red || 0,
    }));
  const merged = [...local];
  sheetsData.forEach((sr) => {
    const isTimer = Object.prototype.hasOwnProperty.call(sr, 'elapsed') && !Object.prototype.hasOwnProperty.call(sr, 'ah');
    const srRole = isTimer ? 'timer' : 'ah';
    if (srRole !== role) return;
    if (!merged.find((lr) => lr.rowId === sr.rowId)) {
      merged.push({
        rowId: sr.rowId, date: fmtDate(sr.date), speaker: sr.speaker,
        category: sr.category || sr.type,
        counts: {
          Ah: +sr.ah || 0, Um: +sr.um || 0, Er: +sr.er || 0, Well: +sr.well || 0,
          So: +sr.so || 0, Like: +sr.like || 0, But: +sr.but || 0, Repeats: +sr.repeats || 0, Other: +sr.other || 0,
        },
        total: +sr.total || 0, elapsed: +sr.elapsed || 0,
        within: sr.within == 1 || sr.within === true,
        green: +sr.green || 0, yellow: +sr.yellow || 0, red: +sr.red || 0,
      });
    }
  });
  return merged;
}

export function applyFilters(data, { speakers, cats, dateFrom, dateTo }) {
  return data.filter((r) => {
    if (speakers.length && !speakers.includes(r.speaker)) return false;
    if (cats.length && !cats.includes(r.category)) return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  });
}
