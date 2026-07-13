import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FILLERS } from '../../lib/constants';
import { total, findFirstDuplicate, buildAhSaveHistory } from '../../lib/ahHistory';
import ReportModal from '../../components/ReportModal';
import DupModal from '../../components/DupModal';

function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

const OPENING_SCRIPT = `"Greetings Mr./Madam Toastmaster, fellow Toastmasters, and guests. The purpose of the Ah-Counter is to note
words and sounds that are used as a "crutch" or "pause filler" by anyone who speaks. During the meeting, I will
listen for overused words, including and, well, but, so, and you know. I will also listen for filler
sounds, including ah, um, and er. I will also note when a speaker repeats a word or phrase,
such as "I, I" or "This means, this means."

At the end of the meeting, I will report the number of times that each speaker used these expressions.

Thank you, Mr./Madam Toastmaster."`;

export default function AhCounterPanel({ roster, history, setHistory, onCountChange }) {
  const [speakers, setSpeakers] = useState([]);
  const [selectValue, setSelectValue] = useState('');
  const [guestName, setGuestName] = useState('');
  const [category, setCategory] = useState('Speech');
  const [saveMsg, setSaveMsg] = useState('');
  const [report, setReport] = useState(null);
  const [dup, setDup] = useState(null); // {speakerIdx, date, baseId, existing}

  useEffect(() => { onCountChange?.(speakers.length); }, [speakers, onCountChange]);

  const addSpeaker = () => {
    const name = selectValue === '__guest__' ? guestName.trim() : selectValue;
    if (!name) return;
    const counts = {}; FILLERS.forEach((f) => { counts[f] = 0; });
    setSpeakers([{ name, cat: category, counts, tapHistory: [] }, ...speakers]);
    setGuestName('');
    setSelectValue('');
  };

  const removeSpeaker = (i) => setSpeakers(speakers.filter((_, idx) => idx !== i));

  const tap = (i, f) => {
    setSpeakers(speakers.map((sp, idx) => idx === i
      ? { ...sp, counts: { ...sp.counts, [f]: sp.counts[f] + 1 }, tapHistory: [...sp.tapHistory, f] }
      : sp));
  };

  const undoTap = (i) => {
    setSpeakers(speakers.map((sp, idx) => {
      if (idx !== i || !sp.tapHistory.length) return sp;
      const h = [...sp.tapHistory];
      const last = h.pop();
      return { ...sp, tapHistory: h, counts: { ...sp.counts, [last]: Math.max(0, sp.counts[last] - 1) } };
    }));
  };

  const summaryCols = useMemo(() => {
    const active = FILLERS.filter((f) => speakers.some((s) => s.counts[f] > 0));
    return active.length ? active : ['Ah', 'Um', 'Er', 'So'];
  }, [speakers]);

  const copyScript = () => navigator.clipboard.writeText(OPENING_SCRIPT);

  const openReport = () => {
    const lines = ['Mr./Madam Toastmaster, here is the Ah Counter report.\n'];
    speakers.forEach((sp) => {
      const t = total(sp.counts);
      if (!t) lines.push(`${sp.name} (${sp.cat}): No filler words. Excellent!`);
      else lines.push(`${sp.name} (${sp.cat}): ${t} filler word${t !== 1 ? 's' : ''} — ` + FILLERS.filter((f) => sp.counts[f] > 0).map((f) => `"${f.toLowerCase()}" ×${sp.counts[f]}`).join(', ') + '.');
    });
    lines.push('\nThank you, Mr./Madam Toastmaster.');
    setReport({ title: 'Ah Counter Report', text: lines.join('\n') });
  };

  const flashSaved = (msg) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 2500); };

  const doSave = (mode, targetIdx, replaceRowId, date) => {
    setHistory(buildAhSaveHistory(history, speakers, date, mode, targetIdx, replaceRowId));
    flashSaved(mode === 'replace' ? '🔄 Replaced!' : '✓ Saved!');
  };

  const saveToHistory = () => {
    if (!speakers.length) return;
    const date = new Date().toLocaleDateString('en-CA');
    const conflict = findFirstDuplicate(speakers, date, history);
    if (conflict) { setDup(conflict); return; }
    doSave('new', null, null, date);
  };

  return (
    <div>
      <div className="section-head">
        <h2>Ah Counter</h2>
        <p>Tap filler words as each speaker talks</p>
        <div className="maroon-line"></div>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: 14, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-head)', fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opening Script</span>
          <button className="btn-b" onClick={copyScript} style={{ fontSize: 10, height: 28, padding: '0 10px' }}>Copy</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{OPENING_SCRIPT}</div>
      </div>

      <div className="toolbar">
        <div className="fg">
          <span className="fl">Speaker</span>
          <select className="fs" style={{ minWidth: 170 }} value={selectValue} onChange={(e) => setSelectValue(e.target.value)}>
            <option value="">— Select from roster —</option>
            {roster.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            <option value="__guest__">✚ Add guest…</option>
          </select>
        </div>
        {selectValue === '__guest__' && (
          <div className="fg">
            <span className="fl">Guest name</span>
            <input className="fi" type="text" placeholder="Type name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </div>
        )}
        <div className="fg" style={{ maxWidth: 150 }}>
          <span className="fl">Category</span>
          <select className="fs" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="Speech">Speech</option>
            <option value="Evaluator">Evaluator</option>
            <option value="Table Topics">Table Topics</option>
          </select>
        </div>
        <button className="btn-p" onClick={addSpeaker}>+ Add Speaker</button>
      </div>

      {!speakers.length ? (
        <div className="empty-state"><div className="icon">🎙</div><p>No speakers added.</p></div>
      ) : (
        <AnimatePresence>
          {speakers.map((sp, i) => (
            <motion.div key={sp.name + i} className="card" layout
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <div className="card-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(242,223,116,0.2)', border: '1.5px solid var(--yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-head)', fontSize: 10, fontWeight: 700, color: 'var(--yellow)' }}>{initials(sp.name)}</div>
                  <div><div className="card-head-title">{sp.name}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{sp.cat}</div></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="card-head-badge">{total(sp.counts) || '0'}</span>
                  <button className="btn-d" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)' }} onClick={() => removeSpeaker(i)}>×</button>
                </div>
              </div>
              <div className="card-body">
                <div className="fillers-grid">
                  {FILLERS.map((f) => (
                    <motion.button key={f} className="filler-btn" whileTap={{ scale: 0.9 }} onClick={() => tap(i, f)}>
                      <span className={'fnum' + (sp.counts[f] > 0 ? ' nz' : '')}>{sp.counts[f]}</span>
                      <span className="fword">{f}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="card-footer">
                <button className="btn-undo" onClick={() => undoTap(i)}>↩ Undo</button>
                <span className="last-action-lbl">{sp.tapHistory.length ? 'last: ' + sp.tapHistory[sp.tapHistory.length - 1] : ''}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {speakers.length > 0 && (
        <div className="sum-card">
          <div className="sum-head">
            <span className="sum-head-title">Session Summary</span>
            <button className="btn-ht" onClick={openReport} style={{ fontSize: 10 }}>📋 Report</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Speaker</th><th>Cat</th>{summaryCols.map((f) => <th key={f}>{f}</th>)}<th>Total</th></tr></thead>
              <tbody>
                {speakers.map((sp) => {
                  const t = total(sp.counts);
                  return (
                    <tr key={sp.name}>
                      <td>{sp.name}</td><td>{sp.cat}</td>
                      {summaryCols.map((f) => <td key={f} className={sp.counts[f] > 0 ? 'hit' : 'zero'}>{sp.counts[f] > 0 ? sp.counts[f] : '–'}</td>)}
                      <td className="tot">{t}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="action-bar">
            <button className="btn-p" onClick={saveToHistory}>💾 Save to History</button>
            {saveMsg && <span style={{ fontSize: 12, color: '#2e7d32', fontFamily: 'var(--font-head)', fontWeight: 700, display: 'inline' }}>{saveMsg}</span>}
          </div>
        </div>
      )}

      {report && <ReportModal title={report.title} text={report.text} onClose={() => setReport(null)} />}

      {dup && (
        <DupModal
          speakerName={speakers[dup.speakerIdx].name}
          speakerCat={speakers[dup.speakerIdx].cat}
          date={dup.date}
          existing={dup.existing}
          onClose={() => setDup(null)}
          onReplace={(rowId) => { doSave('replace', dup.speakerIdx, rowId, dup.date); setDup(null); }}
          onNew={() => { doSave('new', dup.speakerIdx, null, dup.date); setDup(null); }}
        />
      )}
    </div>
  );
}
