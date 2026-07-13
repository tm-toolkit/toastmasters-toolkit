import { useState } from 'react';

export default function DupModal({ speakerName, speakerCat, date, existing, onReplace, onNew, onClose }) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-top"><span className="modal-title">Record Already Exists</span><button className="btn-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
            "{speakerName}" ({speakerCat}) already has {existing.length} record(s) for {date}.
          </p>
          <div>
            {existing.map((r, j) => (
              <div
                key={r.rowId}
                className="dup-item"
                onClick={() => setSelectedIdx(j)}
                style={j === selectedIdx ? { background: '#fff5f6', borderColor: 'var(--maroon)' } : undefined}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.speaker} — {r.cat}</div>
                  <div className="dup-rowid">{r.rowId} · total: {r.total}</div>
                </div>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--maroon)', flexShrink: 0, background: j === selectedIdx ? 'var(--maroon)' : '' }}></div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <button className="btn-p" style={{ width: '100%' }} onClick={() => onReplace(existing[selectedIdx].rowId)}>🔄 Replace selected</button>
          <button className="btn-b" style={{ width: '100%' }} onClick={onNew}>➕ Save as new row</button>
          <button className="btn-cancel-m" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
