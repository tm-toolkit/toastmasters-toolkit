import { useState } from 'react';

export default function ReportModal({ title, text, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-top"><span className="modal-title">{title}</span><button className="btn-close" onClick={onClose}>×</button></div>
        <div className="modal-body"><div className="report-text">{text}</div></div>
        <div className="modal-footer">
          <button className="btn-copy-m" onClick={copy}>Copy</button>
          <button className="btn-cancel-m" onClick={onClose}>Close</button>
          {copied && <span className="copied-msg" style={{ display: 'inline' }}>✓ Copied!</span>}
        </div>
      </div>
    </div>
  );
}
