import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FILLERS } from '../lib/constants';
import { secToMmSs } from '../lib/format';
import { exportAllToSheets } from '../lib/googleSheets';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ah', label: 'Ah Counter' },
  { id: 'timer', label: 'Timer' },
  { id: 'Speech', label: 'Speech' },
  { id: 'Evaluator', label: 'Evaluator' },
  { id: 'Topics', label: 'Topics' },
];

export default function HistoryTab({ history, setHistory, gsEndpoint, setGsEndpoint }) {
  const [filter, setFilter] = useState('all');
  const [gsStatus, setGsStatus] = useState(null); // {msg, type}
  const [showExportModal, setShowExportModal] = useState(false);
  const [undo, setUndo] = useState(null); // {item, idx}
  const undoTimeoutRef = useRef(null);

  const records = useMemo(() => {
    if (filter === 'all') return history;
    if (filter === 'ah') return history.filter((r) => r.type === 'ah');
    if (filter === 'timer') return history.filter((r) => r.type === 'timer');
    if (['Speech', 'Evaluator', 'Table Topics', 'Topics'].includes(filter)) {
      return history.filter((r) => r.cat === filter || (filter === 'Topics' && r.cat === 'Table Topics'));
    }
    return history;
  }, [history, filter]);

  const ahRecs = records.filter((r) => r.type === 'ah');
  const tmRecs = records.filter((r) => r.type === 'timer');
  const ahCols = useMemo(() => {
    const active = FILLERS.filter((f) => ahRecs.some((r) => (r.counts[f] || 0) > 0));
    return active.length ? active : ['Ah', 'Um', 'Er', 'So'];
  }, [ahRecs]);

  const showStatus = (msg, type) => {
    setGsStatus({ msg, type });
    setTimeout(() => setGsStatus(null), 6000);
  };

  const deleteItem = (globalIdx) => {
    const item = history[globalIdx];
    setUndo({ item, idx: globalIdx });
    setHistory(history.filter((_, i) => i !== globalIdx));
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => setUndo(null), 6000);
  };

  const undoDelete = () => {
    if (!undo) return;
    const next = [...history];
    next.splice(undo.idx, 0, undo.item);
    setHistory(next);
    setUndo(null);
  };

  const clearAll = () => {
    if (!history.length || !confirm('Delete all local history?')) return;
    setHistory([]);
  };

  const openExportConfirm = () => {
    if (!history.length) return showStatus('No records to export.', 'info');
    if (!gsEndpoint.trim()) return showStatus('Paste the Apps Script URL first.', 'err');
    setShowExportModal(true);
  };

  const confirmExport = async () => {
    setShowExportModal(false);
    showStatus('Sending to Google Sheets…', 'info');
    const result = await exportAllToSheets(history, gsEndpoint.trim());
    if (result.result === 'success') {
      setHistory(history.map((r) => (r.needsUpdate ? { ...r, needsUpdate: false } : r)));
      showStatus(`✓ ${result.inserted || 0} inserted · ${result.updated || 0} updated · ${result.skipped || 0} skipped`, 'ok');
    } else {
      showStatus('Error: ' + (result.error || JSON.stringify(result)), 'err');
    }
  };

  const exportDates = [...new Set(history.map((r) => r.date))].sort();

  return (
    <div>
      <div className="section-head">
        <h2>History</h2>
        <p>All local records — export to Google Sheets when session is done</p>
        <div className="maroon-line"></div>
      </div>

      <div className="gs-wrap">
        <div className="gs-row">
          <input
            type="text" placeholder="Apps Script Web App URL"
            value={gsEndpoint} onChange={(e) => setGsEndpoint(e.target.value)}
          />
          <button className="btn-p" onClick={openExportConfirm}>📤 Export to Sheets</button>
        </div>
        <div className="note">Confirm session is over before exporting. Idempotent — existing Row IDs skipped.</div>
        {gsStatus && <div className={'gs-status ' + gsStatus.type} style={{ display: 'block' }}>{gsStatus.msg}</div>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={'filter-btn' + (filter === f.id ? ' active' : '')}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button className="btn-d" onClick={clearAll} style={{ marginLeft: 'auto' }}>🗑 Clear All</button>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', overflowX: 'auto' }}>
        {!records.length ? (
          <div className="empty-state">No records found.</div>
        ) : (
          <>
            {ahRecs.length > 0 && (
              <>
                <div style={{ padding: '10px 16px 6px', fontFamily: 'var(--font-head)', fontSize: 10, fontWeight: 700, color: 'var(--maroon)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)' }}>Ah Counter</div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Row ID</th><th>Date</th><th>Speaker</th><th>Cat</th>
                        {ahCols.map((f) => <th key={f}>{f}</th>)}
                        <th>Total</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ahRecs.map((r) => {
                        const gi = history.indexOf(r);
                        return (
                          <tr key={r.rowId}>
                            <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#999', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.rowId}>
                              {r.rowId.slice(0, 20)}…{r.needsUpdate ? ' 🔄' : ''}
                            </td>
                            <td>{r.date}</td>
                            <td style={{ textAlign: 'left', fontWeight: 600 }}>{r.speaker}</td>
                            <td>{r.cat}</td>
                            {ahCols.map((f) => (
                              <td key={f} className={(r.counts[f] || 0) > 0 ? 'hit' : 'zero'}>{(r.counts[f] || 0) || '–'}</td>
                            ))}
                            <td className="tot">{r.total}</td>
                            <td><button className="btn-d" onClick={() => deleteItem(gi)}>✕</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tmRecs.length > 0 && (
              <>
                <div style={{ padding: '10px 16px 6px', fontFamily: 'var(--font-head)', fontSize: 10, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--surface)', borderBottom: '1px solid var(--border-light)', marginTop: ahRecs.length ? 8 : 0 }}>Timer</div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th><th>Speaker</th><th>Category</th><th>Green</th><th>Yellow</th><th>Red</th><th>Actual</th><th>Within?</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tmRecs.map((r) => {
                        const gi = history.indexOf(r);
                        return (
                          <tr key={r.rowId}>
                            <td>{r.date}</td>
                            <td style={{ textAlign: 'left', fontWeight: 600 }}>{r.speaker}</td>
                            <td>{r.cat}</td>
                            <td>{secToMmSs(r.green || 0)}</td>
                            <td>{secToMmSs(r.yellow || 0)}</td>
                            <td>{secToMmSs(r.red || 0)}</td>
                            <td style={{ fontWeight: 700 }}>{secToMmSs(r.elapsed || 0)}</td>
                            <td className={r.within ? 'within' : 'over-time'}>{r.within ? '✓' : '✗'}</td>
                            <td><button className="btn-d" onClick={() => deleteItem(gi)}>✕</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showExportModal && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setShowExportModal(false); }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-top" style={{ background: 'linear-gradient(90deg,#004165,#006094)' }}>
              <span className="modal-title">Confirm Export to Google Sheets</span>
              <button className="btn-close" onClick={() => setShowExportModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#e3f2fd', borderRadius: 'var(--radius)', padding: '11px 13px', marginBottom: 12, fontSize: 13, color: '#1565c0', fontFamily: 'var(--font-head)', fontWeight: 600 }}>
                ✅ Confirm today&apos;s session is over and you want to save data permanently to Google Sheets.
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <strong>{history.length}</strong> record(s) · <strong>{exportDates.length}</strong> date(s): {exportDates.join(', ')}
              </div>
              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '3px 8px', background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '3px 8px', background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>Speaker</th>
                      <th style={{ textAlign: 'left', padding: '3px 8px', background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>Role</th>
                      <th style={{ textAlign: 'left', padding: '3px 8px', background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>Cat/Type</th>
                      <th style={{ textAlign: 'left', padding: '3px 8px', background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>Key metric</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.rowId}>
                        <td style={{ padding: '3px 8px', borderBottom: '1px solid var(--border-light)' }}>{r.date}</td>
                        <td style={{ padding: '3px 8px', borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>{r.speaker}</td>
                        <td style={{ padding: '3px 8px', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>{r.type === 'ah' ? 'Ah' : 'Timer'}</td>
                        <td style={{ padding: '3px 8px', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>{r.cat || '—'}</td>
                        <td style={{ padding: '3px 8px', borderBottom: '1px solid var(--border-light)', textAlign: 'center', fontWeight: 700, color: 'var(--maroon)' }}>
                          {r.type === 'ah' ? r.total + ' fillers' : secToMmSs(r.elapsed || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-p" style={{ flex: 1 }} onClick={confirmExport}>✅ Yes — Export now</button>
              <button className="btn-cancel-m" onClick={() => setShowExportModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {undo && (
          <motion.div
            className="toast" style={{ display: 'flex' }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          >
            <span>Record deleted.</span>
            <button onClick={undoDelete}>UNDO</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
