export function generateTimerRowId(name, type, date) {
  return `${date}|timer|${type.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 12)}|${name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}`;
}

// Unlike Ah Counter saves, timer log entries just upsert by rowId — no
// duplicate-resolution modal, matching the original saveTimerToHistory.
export function buildTimerSaveHistory(history, timerLog, date) {
  const next = [...history];
  timerLog.forEach((r) => {
    const rowId = generateTimerRowId(r.name, r.type, date);
    const existing = next.findIndex((h) => h.rowId === rowId);
    const record = {
      rowId, type: 'timer', date, speaker: r.name, cat: r.type,
      green: r.green, yellow: r.yellow, red: r.red, elapsed: r.elapsed, within: r.within,
      saved: Date.now(), needsUpdate: false,
    };
    if (existing >= 0) next[existing] = { ...record, needsUpdate: true };
    else next.push(record);
  });
  return next;
}
