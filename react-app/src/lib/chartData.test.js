import { describe, it, expect } from 'vitest';
import { getChartDataByRole, applyFilters } from './chartData';

describe('getChartDataByRole', () => {
  const history = [
    { rowId: 'r1', type: 'ah', date: '2026-07-13', speaker: 'Erika', cat: 'Speech', counts: { Ah: 2 }, total: 2 },
    { rowId: 'r2', type: 'timer', date: '2026-07-13', speaker: 'Carlos', cat: 'Table Topics', elapsed: 75, within: true },
  ];

  it('filters local history by role', () => {
    expect(getChartDataByRole(history, [], 'ah')).toHaveLength(1);
    expect(getChartDataByRole(history, [], 'timer')).toHaveLength(1);
  });

  it('merges in Sheets rows not already present locally (by rowId)', () => {
    const sheetsData = [{ rowId: 'r3', speaker: 'Sara', date: '2026-07-13', category: 'Speech', ah: 4, um: 1 }];
    const merged = getChartDataByRole(history, sheetsData, 'ah');
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.rowId === 'r3').counts.Ah).toBe(4);
  });

  it('does not duplicate a Sheets row whose rowId already exists locally', () => {
    const sheetsData = [{ rowId: 'r1', speaker: 'Erika', date: '2026-07-13', ah: 99 }];
    const merged = getChartDataByRole(history, sheetsData, 'ah');
    expect(merged).toHaveLength(1);
    expect(merged[0].counts.Ah).toBe(2); // local version wins, not overwritten by the Sheets duplicate
  });

  it('classifies a Sheets row as timer when it has elapsed but no ah field', () => {
    const sheetsData = [{ rowId: 'r4', speaker: 'Yvette', date: '2026-07-13', elapsed: 200, within: true }];
    expect(getChartDataByRole(history, sheetsData, 'timer')).toHaveLength(2);
    expect(getChartDataByRole(history, sheetsData, 'ah')).toHaveLength(1);
  });
});

describe('applyFilters', () => {
  const data = [
    { speaker: 'Erika', category: 'Speech', date: '2026-07-01' },
    { speaker: 'Carlos', category: 'Table Topics', date: '2026-07-08' },
    { speaker: 'Erika', category: 'Evaluator', date: '2026-07-15' },
  ];

  it('returns everything when no filters are set', () => {
    expect(applyFilters(data, { speakers: [], cats: [], dateFrom: '', dateTo: '' })).toHaveLength(3);
  });

  it('filters by speaker', () => {
    const result = applyFilters(data, { speakers: ['Erika'], cats: [], dateFrom: '', dateTo: '' });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.speaker === 'Erika')).toBe(true);
  });

  it('filters by category', () => {
    const result = applyFilters(data, { speakers: [], cats: ['Table Topics'], dateFrom: '', dateTo: '' });
    expect(result).toHaveLength(1);
  });

  it('filters by date range (inclusive)', () => {
    const result = applyFilters(data, { speakers: [], cats: [], dateFrom: '2026-07-08', dateTo: '2026-07-08' });
    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBe('Carlos');
  });

  it('combines multiple filters (AND, not OR)', () => {
    const result = applyFilters(data, { speakers: ['Erika'], cats: ['Evaluator'], dateFrom: '', dateTo: '' });
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Evaluator');
  });
});
