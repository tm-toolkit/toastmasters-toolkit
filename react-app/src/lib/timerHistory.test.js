import { describe, it, expect } from 'vitest';
import { generateTimerRowId, buildTimerSaveHistory } from './timerHistory';

describe('generateTimerRowId', () => {
  it('builds a deterministic id from date/type/name', () => {
    expect(generateTimerRowId('Carlos Millones', 'Table Topics', '2026-07-13'))
      .toBe('2026-07-13|timer|table_topics|carlos_millones');
  });
});

describe('buildTimerSaveHistory', () => {
  const log = [{ name: 'Carlos Millones', type: 'Table Topics', green: 60, yellow: 90, red: 120, elapsed: 75, within: true }];

  it('appends a new row when none exists yet', () => {
    const next = buildTimerSaveHistory([], log, '2026-07-13');
    expect(next).toHaveLength(1);
    expect(next[0].rowId).toBe('2026-07-13|timer|table_topics|carlos_millones');
    expect(next[0].elapsed).toBe(75);
    expect(next[0].needsUpdate).toBe(false);
  });

  it('upserts (overwrites) an existing row with the same rowId, flagging needsUpdate', () => {
    const history = [{ rowId: '2026-07-13|timer|table_topics|carlos_millones', type: 'timer', date: '2026-07-13', speaker: 'Carlos Millones', cat: 'Table Topics', elapsed: 50, within: false }];
    const next = buildTimerSaveHistory(history, log, '2026-07-13');
    expect(next).toHaveLength(1); // upserted in place, not duplicated
    expect(next[0].elapsed).toBe(75);
    expect(next[0].needsUpdate).toBe(true);
  });

  it('does not mutate the history array passed in', () => {
    const history = [];
    buildTimerSaveHistory(history, log, '2026-07-13');
    expect(history).toHaveLength(0);
  });
});
