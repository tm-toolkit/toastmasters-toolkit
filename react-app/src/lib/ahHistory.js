export function total(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export function generateAhRowId(name, cat, date) {
  return `${date}|ah|${cat.toLowerCase().slice(0, 10)}|${name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}`;
}

// Finds the first speaker (in order) whose base rowId already has a matching
// record in history — same logic saveAhToHistory used to decide whether to
// pop the "Record Already Exists" modal at all.
export function findFirstDuplicate(speakers, date, history) {
  for (let i = 0; i < speakers.length; i++) {
    const sp = speakers[i];
    const baseId = generateAhRowId(sp.name, sp.cat, date);
    const existing = history.filter((r) => r.rowId === baseId || r.rowId.startsWith(baseId + '_v'));
    if (existing.length > 0) return { speakerIdx: i, date, baseId, existing };
  }
  return null;
}

// Only the targeted speaker (when mode==='replace') gets the explicit resolution;
// every other speaker with a pre-existing duplicate in this same save silently
// gets a new versioned row (_v2, _v3, ...) — matches the original's doSaveAhAll.
export function buildAhSaveHistory(history, speakers, date, mode, targetIdx, replaceRowId) {
  const next = [...history];
  speakers.forEach((sp, i) => {
    const baseId = generateAhRowId(sp.name, sp.cat, date);
    if (mode === 'replace' && i === targetIdx && replaceRowId) {
      const pos = next.findIndex((r) => r.rowId === replaceRowId);
      const rec = { rowId: replaceRowId, type: 'ah', date, speaker: sp.name, cat: sp.cat, counts: { ...sp.counts }, total: total(sp.counts), saved: Date.now(), needsUpdate: true };
      if (pos >= 0) next[pos] = rec; else next.push(rec);
    } else {
      const existing = next.filter((r) => r.rowId === baseId || r.rowId.startsWith(baseId + '_v'));
      const rowId = existing.length === 0 ? baseId : `${baseId}_v${existing.length + 1}`;
      next.push({ rowId, type: 'ah', date, speaker: sp.name, cat: sp.cat, counts: { ...sp.counts }, total: total(sp.counts), saved: Date.now(), needsUpdate: false });
    }
  });
  return next;
}
