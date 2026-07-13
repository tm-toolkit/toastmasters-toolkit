import { describe, it, expect } from 'vitest';
import { total, generateAhRowId, findFirstDuplicate, buildAhSaveHistory } from './ahHistory';

describe('total', () => {
  it('sums all filler counts', () => {
    expect(total({ Ah: 2, Um: 1, Er: 0 })).toBe(3);
  });
  it('returns 0 for empty counts', () => {
    expect(total({})).toBe(0);
  });
});

describe('generateAhRowId', () => {
  it('builds a deterministic id from date/cat/name', () => {
    expect(generateAhRowId('Erika Fernandez', 'Speech', '2026-07-13'))
      .toBe('2026-07-13|ah|speech|erika_fernandez');
  });
  it('strips punctuation from the name', () => {
    expect(generateAhRowId("O'Brien", 'Speech', '2026-07-13')).toMatch(/^2026-07-13\|ah\|speech\|o_brien/);
  });
});

describe('findFirstDuplicate', () => {
  const history = [
    { rowId: '2026-07-13|ah|speech|erika_fernandez', type: 'ah', date: '2026-07-13', speaker: 'Erika Fernandez', cat: 'Speech', total: 5 },
  ];

  it('finds a duplicate for the first matching speaker', () => {
    const speakers = [{ name: 'Erika Fernandez', cat: 'Speech', counts: {} }];
    const dup = findFirstDuplicate(speakers, '2026-07-13', history);
    expect(dup).not.toBeNull();
    expect(dup.speakerIdx).toBe(0);
    expect(dup.existing).toHaveLength(1);
  });

  it('returns null when there is no existing record for that date/cat/name', () => {
    const speakers = [{ name: 'Carlos Millones', cat: 'Speech', counts: {} }];
    expect(findFirstDuplicate(speakers, '2026-07-13', history)).toBeNull();
  });

  it('also matches previously-versioned rows (_v2, _v3, ...)', () => {
    const withVersion = [...history, { rowId: '2026-07-13|ah|speech|erika_fernandez_v2', type: 'ah', date: '2026-07-13', speaker: 'Erika Fernandez', cat: 'Speech', total: 3 }];
    const speakers = [{ name: 'Erika Fernandez', cat: 'Speech', counts: {} }];
    const dup = findFirstDuplicate(speakers, '2026-07-13', withVersion);
    expect(dup.existing).toHaveLength(2);
  });
});

describe('buildAhSaveHistory', () => {
  it('appends a brand-new row when there is no existing record', () => {
    const speakers = [{ name: 'Carlos Millones', cat: 'Speech', counts: { Ah: 3, Um: 0 } }];
    const next = buildAhSaveHistory([], speakers, '2026-07-13', 'new', null, null);
    expect(next).toHaveLength(1);
    expect(next[0].rowId).toBe('2026-07-13|ah|speech|carlos_millones');
    expect(next[0].total).toBe(3);
    expect(next[0].needsUpdate).toBe(false);
  });

  it('creates a versioned row (_v2) when saving "new" over an existing duplicate', () => {
    const history = [{ rowId: '2026-07-13|ah|speech|erika_fernandez', type: 'ah', date: '2026-07-13', speaker: 'Erika Fernandez', cat: 'Speech', total: 5 }];
    const speakers = [{ name: 'Erika Fernandez', cat: 'Speech', counts: { Ah: 1, Um: 1 } }];
    const next = buildAhSaveHistory(history, speakers, '2026-07-13', 'new', 0, null);
    expect(next).toHaveLength(2);
    expect(next[1].rowId).toBe('2026-07-13|ah|speech|erika_fernandez_v2');
  });

  it('overwrites the targeted row in place when mode is "replace"', () => {
    const history = [{ rowId: '2026-07-13|ah|speech|erika_fernandez', type: 'ah', date: '2026-07-13', speaker: 'Erika Fernandez', cat: 'Speech', total: 5, counts: { Ah: 5 } }];
    const speakers = [{ name: 'Erika Fernandez', cat: 'Speech', counts: { Ah: 9 } }];
    const next = buildAhSaveHistory(history, speakers, '2026-07-13', 'replace', 0, '2026-07-13|ah|speech|erika_fernandez');
    expect(next).toHaveLength(1); // replaced in place, not appended
    expect(next[0].total).toBe(9);
    expect(next[0].needsUpdate).toBe(true);
  });

  it('does not mutate the history array passed in', () => {
    const history = [];
    const speakers = [{ name: 'Carlos Millones', cat: 'Speech', counts: { Ah: 1 } }];
    buildAhSaveHistory(history, speakers, '2026-07-13', 'new', null, null);
    expect(history).toHaveLength(0);
  });
});
