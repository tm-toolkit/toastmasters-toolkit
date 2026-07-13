import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import HistoryTab from './HistoryTab';
import * as googleSheets from '../lib/googleSheets';

vi.mock('../lib/googleSheets', () => ({
  exportAllToSheets: vi.fn(),
}));

const ahRecord = { rowId: 'r1', type: 'ah', date: '2026-07-13', speaker: 'Erika Fernandez', cat: 'Speech', counts: { Ah: 2, Um: 1, Er: 0, Well: 0, So: 0, Like: 0, But: 0, Repeats: 0, Other: 0 }, total: 3 };
const timerRecord = { rowId: 'r2', type: 'timer', date: '2026-07-13', speaker: 'Carlos Millones', cat: 'Table Topics', green: 60, yellow: 90, red: 120, elapsed: 75, within: true };

function setup(overrides = {}) {
  const props = {
    history: [],
    setHistory: vi.fn(),
    gsEndpoint: '',
    setGsEndpoint: vi.fn(),
    ...overrides,
  };
  render(<HistoryTab {...props} />);
  return props;
}

beforeEach(() => {
  vi.restoreAllMocks();
  googleSheets.exportAllToSheets.mockReset();
});

describe('HistoryTab', () => {
  it('shows the empty state with no records', () => {
    setup();
    expect(screen.getByText('No records found.')).toBeInTheDocument();
  });

  it('renders both Ah Counter and Timer sections when both types are present', () => {
    setup({ history: [ahRecord, timerRecord] });
    expect(screen.getAllByText('Ah Counter').length).toBeGreaterThan(0); // filter button + section header
    expect(screen.getAllByText('Timer').length).toBeGreaterThan(0);
    expect(screen.getByText('Erika Fernandez')).toBeInTheDocument();
    expect(screen.getByText('Carlos Millones')).toBeInTheDocument();
  });

  it('filters to only Ah Counter records', () => {
    setup({ history: [ahRecord, timerRecord] });
    fireEvent.click(screen.getByRole('button', { name: 'Ah Counter' }));
    expect(screen.getByText('Erika Fernandez')).toBeInTheDocument();
    expect(screen.queryByText('Carlos Millones')).not.toBeInTheDocument();
  });

  it('deletes a record and shows an undo toast, which restores it on click', () => {
    // Wraps HistoryTab in a real stateful parent so setHistory actually
    // feeds back into props, the same way Layout.jsx does - a plain prop
    // spy can't observe the re-render this behavior depends on.
    function StatefulWrapper() {
      const [history, setHistory] = useState([ahRecord]);
      return <HistoryTab history={history} setHistory={setHistory} gsEndpoint="" setGsEndpoint={() => {}} />;
    }
    render(<StatefulWrapper />);

    fireEvent.click(screen.getByText('✕'));
    expect(screen.getByText('No records found.')).toBeInTheDocument();
    expect(screen.getByText('Record deleted.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('UNDO'));
    expect(screen.getByText('Erika Fernandez')).toBeInTheDocument();
    // Not asserting the toast itself is gone: Framer Motion's exit animation
    // doesn't resolve on its own in jsdom (no real animation-frame clock),
    // so the underlying "undo" state being cleared is what actually matters.
  });

  it('shows an error status instead of the export modal when no endpoint is set', () => {
    setup({ history: [ahRecord], gsEndpoint: '' });
    fireEvent.click(screen.getByText('📤 Export to Sheets'));
    expect(screen.getByText('Paste the Apps Script URL first.')).toBeInTheDocument();
    expect(screen.queryByText('Confirm Export to Google Sheets')).not.toBeInTheDocument();
  });

  it('opens the confirm modal when an endpoint is set, and cancel closes it without exporting', () => {
    setup({ history: [ahRecord], gsEndpoint: 'https://script.google.com/fake' });
    fireEvent.click(screen.getByText('📤 Export to Sheets'));
    expect(screen.getByText('Confirm Export to Google Sheets')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Confirm Export to Google Sheets')).not.toBeInTheDocument();
    expect(googleSheets.exportAllToSheets).not.toHaveBeenCalled();
  });

  it('calls exportAllToSheets and reports the result on confirm', async () => {
    googleSheets.exportAllToSheets.mockResolvedValue({ result: 'success', inserted: 1, updated: 0, skipped: 0 });
    setup({ history: [ahRecord], gsEndpoint: 'https://script.google.com/fake' });
    fireEvent.click(screen.getByText('📤 Export to Sheets'));
    fireEvent.click(screen.getByText('✅ Yes — Export now'));

    await waitFor(() => expect(googleSheets.exportAllToSheets).toHaveBeenCalledWith([ahRecord], 'https://script.google.com/fake'));
    await waitFor(() => expect(screen.getByText(/1 inserted/)).toBeInTheDocument());
  });

  it('asks for confirmation before "Clear All", and skips if declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { setHistory } = setup({ history: [ahRecord] });
    fireEvent.click(screen.getByText('🗑 Clear All'));
    expect(setHistory).not.toHaveBeenCalled();
  });
});
