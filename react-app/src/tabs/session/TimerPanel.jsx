import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { secToMmSs, parseMmSs } from '../../lib/format';
import { getPreset, TYPE_LABELS, isWithinTime } from '../../lib/timerPresets';
import { buildTimerSaveHistory } from '../../lib/timerHistory';
import ReportModal from '../../components/ReportModal';
import TimerVideoTool from '../tools/TimerVideoTool';

function buildTimerScript() {
  return [
    'Greetings Mr./Madam Toastmaster, fellow Toastmasters, and guests. As Timer, I will time the Table Topics® speakers,',
    'formal speeches, and the evaluations. I will also alert each speaker of the time they have left, using the green,',
    'yellow, and red cards, which denote specific times remaining.\n',
    '🟢 Green: You have reached the minimum time.',
    '🟡 Yellow: It\'s time to start wrapping up.',
    '🔴 Red: Time is up! You have 30 seconds to finish.\n',
    'Table Topics (max 2 min): 🟢 1:00 · 🟡 1:30 · 🔴 2:00',
    'Ice Breaker (4–6 min): 🟢 4:00 · 🟡 5:00 · 🔴 6:00',
    'Speech (5–7 min): 🟢 5:00 · 🟡 6:00 · 🔴 7:00',
    'Evaluation (2–3 min): 🟢 2:00 · 🟡 2:30 · 🔴 3:00\n',
    'I will give a full report at the end of the meeting.',
    'Thank you Mr./Madam Toastmaster.',
  ].join('\n');
}
const TIMER_SCRIPT = buildTimerScript();

function timerColorClass(elapsed, green, yellow, red) {
  if (elapsed >= red) return 'red';
  if (elapsed >= yellow) return 'yellow';
  if (elapsed >= green) return 'green';
  return '';
}

export default function TimerPanel({ roster, history, setHistory, onCountChange }) {
  const [queue, setQueue] = useState([]);
  const [log, setLog] = useState([]);
  const [selectValue, setSelectValue] = useState('');
  const [guestName, setGuestName] = useState('');
  const [type, setType] = useState('speech57');
  const [customTotal, setCustomTotal] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [report, setReport] = useState(null);
  const [editingLogIdx, setEditingLogIdx] = useState(-1);
  const [logEditValue, setLogEditValue] = useState('');

  useEffect(() => { onCountChange?.(queue.length); }, [queue, onCountChange]);

  const customPreview = (() => {
    // parseMmSs inline to avoid importing just for a preview string
    const parts = customTotal.trim().split(':');
    const totalSec = parts.length === 2 ? parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) : parseInt(customTotal, 10) || 0;
    if (!totalSec) return '';
    const g = Math.round(totalSec * 0.75), y = Math.round(totalSec * 0.875);
    return `🟢${secToMmSs(g)} 🟡${secToMmSs(y)} 🔴${secToMmSs(totalSec)}`;
  })();

  const speakerName = selectValue === '__guest__' ? guestName.trim() : selectValue;
  const [green, yellow, red] = getPreset(type, customTotal);
  const typeLabel = TYPE_LABELS[type] || type;

  const addToQueue = () => {
    if (!speakerName) return;
    setQueue([{ name: speakerName, type, typeLabel, green, yellow, red, timeText: '', done: false }, ...queue]);
    setGuestName('');
    setSelectValue('');
  };

  const removeFromQueue = (i) => {
    setQueue(queue.filter((_, idx) => idx !== i));
  };

  const updateQueueTime = (i, text) => {
    setQueue(queue.map((item, idx) => (idx === i ? { ...item, timeText: text } : item)));
  };

  // No live ticking clock here on purpose: a setInterval-based countdown
  // freezes as soon as the browser tab loses focus (e.g. while the officer
  // is looking at Zoom, not the toolkit) — the timing itself already happens
  // on-screen for the room via the Zoom background video, so this is just a
  // plain field to type the final time into once the speaker finishes.
  const logSpeaker = (i) => {
    const sp = queue[i];
    const elapsed = parseMmSs(sp.timeText);
    const within = isWithinTime(elapsed, sp.green, sp.red);
    setLog([...log, { name: sp.name, type: sp.typeLabel, green: sp.green, yellow: sp.yellow, red: sp.red, elapsed, within }]);
    setQueue(queue.map((item, idx) => (idx === i ? { ...item, done: true } : item)));
  };

  const startEditLog = (i) => {
    setEditingLogIdx(i);
    setLogEditValue(secToMmSs(log[i].elapsed));
  };

  const cancelEditLog = () => {
    setEditingLogIdx(-1);
    setLogEditValue('');
  };

  const saveEditLog = (i) => {
    const elapsed = parseMmSs(logEditValue);
    const r = log[i];
    const within = isWithinTime(elapsed, r.green, r.red);
    setLog(log.map((item, idx) => (idx === i ? { ...item, elapsed, within } : item)));
    setEditingLogIdx(-1);
    setLogEditValue('');
  };

  const openReport = () => {
    const lines = ['Mr./Madam Toastmaster, here is the Timer report.\n'];
    log.forEach((r) => lines.push(`${r.name} (${r.type}): ${secToMmSs(r.elapsed)} — ${r.within ? 'within time ✓' : 'over time ✗'}`));
    lines.push('\nThank you, Mr./Madam Toastmaster.');
    setReport({ title: 'Timer Report', text: lines.join('\n') });
  };

  const saveToHistory = () => {
    if (!log.length) return;
    const date = new Date().toLocaleDateString('en-CA');
    setHistory(buildTimerSaveHistory(history, log, date));
    setSaveMsg('✓ Saved!');
    setTimeout(() => setSaveMsg(''), 2500);
  };

  return (
    <div>
      <div className="section-head">
        <h2>Timer</h2>
        <p>Select a speaker and type once — download the Zoom background video, add them to the queue, and type in their time once they finish</p>
        <div className="maroon-line"></div>
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
        <div className="fg" style={{ maxWidth: 190 }}>
          <span className="fl">Type</span>
          <select className="fs" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="speech57">Speech (5–7 min)</option>
            <option value="eval">Evaluator (2–3 min)</option>
            <option value="topics">Table Topics (1–2 min)</option>
            <option value="speech46">Ice Breaker (4–6 min)</option>
            <option value="custom">Custom…</option>
          </select>
        </div>
        {type === 'custom' && (
          <div className="fg" style={{ maxWidth: 200 }}>
            <span className="fl">Total time (mm:ss)</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="fi" type="text" placeholder="15:00" style={{ width: 80 }} value={customTotal} onChange={(e) => setCustomTotal(e.target.value)} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{customPreview}</span>
            </div>
          </div>
        )}
        <button className="btn-p" onClick={addToQueue}>+ Add to Queue</button>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: 14, boxShadow: 'var(--shadow)' }}>
        <TimerVideoTool green={green} yellow={yellow} red={red} typeLabel={typeLabel} speakerName={speakerName} />
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: 14, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-head)', fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opening Script</span>
          <button className="btn-b" onClick={() => navigator.clipboard.writeText(TIMER_SCRIPT)} style={{ fontSize: 10, height: 28, padding: '0 10px' }}>Copy</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8, maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-line' }}>{TIMER_SCRIPT}</div>
      </div>

      {!queue.length ? (
        <div className="empty-state"><div className="icon">⏱</div><p>No speakers in queue.<br />Add speakers above.</p></div>
      ) : (
        queue.map((sp, i) => {
          const colorClass = !sp.done && timerColorClass(parseMmSs(sp.timeText), sp.green, sp.yellow, sp.red);
          return (
            <motion.div key={i} className={'timer-live-card' + (colorClass ? ' ' + colorClass : '')} layout style={sp.done ? { opacity: 0.55 } : undefined}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span className="timer-name">{sp.name}</span>
                  <span className="timer-type-badge" style={{ marginLeft: 8 }}>{sp.typeLabel}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>🟢{secToMmSs(sp.green)} 🟡{secToMmSs(sp.yellow)} 🔴{secToMmSs(sp.red)}</span>
                </div>
                <button className="btn-d" onClick={() => removeFromQueue(i)}>×</button>
              </div>
              <div className="timer-btn-row">
                {!sp.done ? (
                  <>
                    <input
                      type="text" placeholder="mm:ss" value={sp.timeText} onChange={(e) => updateQueueTime(i, e.target.value)}
                      style={{ width: 90, fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-head)', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}
                    />
                    <button className="btn-log" onClick={() => logSpeaker(i)}>✓ Log Time</button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-head)', fontWeight: 700 }}>✓ Logged {secToMmSs(parseMmSs(sp.timeText))}</span>
                )}
              </div>
            </motion.div>
          );
        })
      )}

      {log.length > 0 && (
        <div className="sum-card">
          <div className="sum-head">
            <span className="sum-head-title">Timer Log</span>
            <button className="btn-ht" onClick={openReport} style={{ fontSize: 10 }}>📋 Report</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Speaker</th><th>Type</th><th>Green</th><th>Yellow</th><th>Red</th><th>Actual</th><th>Within?</th><th></th></tr></thead>
              <tbody>
                {log.map((r, i) => {
                  const isEditing = editingLogIdx === i;
                  return (
                    <tr key={i}>
                      <td>{r.name}</td><td>{r.type}</td>
                      <td>{secToMmSs(r.green)}</td><td>{secToMmSs(r.yellow)}</td><td>{secToMmSs(r.red)}</td>
                      <td style={{ fontWeight: 700 }}>
                        {isEditing ? (
                          <input
                            type="text" value={logEditValue} onChange={(e) => setLogEditValue(e.target.value)}
                            style={{ width: 56, fontSize: 12, padding: '2px 4px', border: '1.5px solid var(--maroon)', borderRadius: 4, textAlign: 'center' }}
                            autoFocus
                          />
                        ) : secToMmSs(r.elapsed)}
                      </td>
                      <td className={r.within ? 'within' : 'over-time'}>{r.within ? '✓ Yes' : '✗ No'}</td>
                      <td style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {isEditing ? (
                          <>
                            <button className="btn-d" style={{ borderColor: 'var(--green)', color: 'var(--green)' }} onClick={() => saveEditLog(i)}>✓</button>
                            <button className="btn-d" onClick={cancelEditLog}>✕</button>
                          </>
                        ) : (
                          <button className="btn-d" onClick={() => startEditLog(i)}>✎</button>
                        )}
                      </td>
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
    </div>
  );
}
