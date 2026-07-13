import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { secToMmSs } from '../../lib/format';
import { getPreset, TYPE_LABELS } from '../../lib/timerPresets';
import { buildTimerSaveHistory } from '../../lib/timerHistory';
import { useBroadcastChannel } from '../../hooks/useBroadcastChannel';
import ReportModal from '../../components/ReportModal';

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
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selectValue, setSelectValue] = useState('');
  const [guestName, setGuestName] = useState('');
  const [type, setType] = useState('speech57');
  const [customTotal, setCustomTotal] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [report, setReport] = useState(null);
  const intervalRef = useRef(null);
  const post = useBroadcastChannel('tm_display');

  useEffect(() => { onCountChange?.(queue.length); }, [queue, onCountChange]);
  useEffect(() => () => clearInterval(intervalRef.current), []);

  const customPreview = (() => {
    // parseMmSs inline to avoid importing just for a preview string
    const parts = customTotal.trim().split(':');
    const totalSec = parts.length === 2 ? parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) : parseInt(customTotal, 10) || 0;
    if (!totalSec) return '';
    const g = Math.round(totalSec * 0.75), y = Math.round(totalSec * 0.875);
    return `🟢${secToMmSs(g)} 🟡${secToMmSs(y)} 🔴${secToMmSs(totalSec)}`;
  })();

  const addToQueue = () => {
    const name = selectValue === '__guest__' ? guestName.trim() : selectValue;
    if (!name) return;
    const [g, y, r] = getPreset(type, customTotal);
    const typeLabel = TYPE_LABELS[type] || type;
    setQueue([{ name, type, typeLabel, green: g, yellow: y, red: r, elapsed: 0, state: 'pending', done: false }, ...queue]);
    setActiveIdx((idx) => (idx >= 0 ? idx + 1 : idx));
    setGuestName('');
    setSelectValue('');
  };

  const stopLiveTimer = (currentQueue = queue) => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (activeIdx >= 0 && currentQueue[activeIdx]) {
      const idx = activeIdx;
      const sp = currentQueue[idx];
      setQueue((q) => q.map((item, i) => i === idx ? { ...item, state: 'stopped' } : item));
      post({ type: 'timer', speaker: sp.name, typeLabel: sp.typeLabel, elapsed: sp.elapsed, green: sp.green, yellow: sp.yellow, red: sp.red, running: false, done: false });
    }
    setActiveIdx(-1);
  };

  const removeFromQueue = (i) => {
    if (activeIdx === i) stopLiveTimer();
    setQueue(queue.filter((_, idx) => idx !== i));
    setActiveIdx((idx) => (idx >= i ? idx - 1 : idx));
  };

  // sp0's static fields (name/typeLabel/green/yellow/red) don't change while a
  // speaker is running — only elapsed does, tracked here so the interval can
  // post() as a plain side effect, never inside a setState updater (React can
  // invoke updater functions more than once to check purity, which would
  // double-broadcast).
  const runInterval = (i, sp0, startElapsed) => {
    clearInterval(intervalRef.current);
    let elapsed = startElapsed;
    intervalRef.current = setInterval(() => {
      elapsed += 1;
      setQueue((q) => q.map((item, idx) => idx === i ? { ...item, elapsed } : item));
      post({ type: 'timer', speaker: sp0.name, typeLabel: sp0.typeLabel, elapsed, green: sp0.green, yellow: sp0.yellow, red: sp0.red, running: true, done: false });
    }, 1000);
  };

  const startSpeaker = (i) => {
    if (activeIdx === i) return;
    stopLiveTimer();
    const sp0 = queue[i];
    setQueue((q) => q.map((item, idx) => idx === i ? { ...item, elapsed: 0, state: 'running', done: false } : item));
    setActiveIdx(i);
    runInterval(i, sp0, 0);
  };

  const resumeSpeaker = (i) => {
    if (activeIdx === i) return;
    stopLiveTimer();
    const sp0 = queue[i];
    setQueue((q) => q.map((item, idx) => idx === i ? { ...item, state: 'running' } : item));
    setActiveIdx(i);
    runInterval(i, sp0, sp0.elapsed || 0);
  };

  const pause = () => stopLiveTimer();

  const logSpeaker = (i) => {
    const sp = queue[i];
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    const elapsed = sp.elapsed || 0;
    const within = elapsed >= sp.green && elapsed <= sp.red;
    setLog([...log, { name: sp.name, type: sp.typeLabel, green: sp.green, yellow: sp.yellow, red: sp.red, elapsed, within }]);
    setQueue(queue.map((item, idx) => idx === i ? { ...item, done: true, state: 'logged' } : item));
    setActiveIdx(-1);
    post({ type: 'timer', speaker: sp.name, typeLabel: sp.typeLabel, elapsed: sp.elapsed, green: sp.green, yellow: sp.yellow, red: sp.red, running: false, done: true });
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

  const openDisplayWindow = () => {
    const url = window.location.href.split('?')[0] + '?display=1';
    window.open(url, 'tm_display', 'width=1280,height=720,toolbar=0,menubar=0,location=0,status=0');
  };

  return (
    <div>
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>Timer</h2>
          <p>Select a speaker, set the type, start the clock</p>
          <div className="maroon-line"></div>
        </div>
        <button className="btn-b" onClick={openDisplayWindow} style={{ alignSelf: 'center', marginTop: 6 }}>📺 Open Display Window</button>
      </div>

      <details style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: 0, marginBottom: 14, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <summary style={{ padding: '13px 18px', cursor: 'pointer', fontFamily: 'var(--font-head)', fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📺 How to set up OBS as your Zoom background</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>click to expand ▾</span>
        </summary>
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ margin: '14px 0 18px' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>📹 Video guide</div>
            <a href="https://www.youtube.com/watch?v=2JGl902KVok" target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ff0000', color: 'white', padding: '8px 14px', borderRadius: 'var(--radius)', fontFamily: 'var(--font-head)', fontSize: 12, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em' }}>
              ▶ Watch on YouTube
            </a>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 10 }}>How to use OBS as a virtual camera in Zoom</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['1', 'Download & install OBS', <>Go to <a href="https://obsproject.com" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>obsproject.com</a> or search <strong>"OBS Studio"</strong> in the Microsoft Store. Install and open it. No special configuration needed at first launch.</>],
              ['2', 'Open the Display Window', <>Click <strong>📺 Open Display Window</strong> above. A new browser window will open — this is the screen OBS will capture. Before continuing, <strong>enable the OBS Guide checkbox</strong> inside that window (top right corner) so you can see where to place your camera.</>],
              ['3', 'Add a Window Capture in OBS', <>In OBS, under <strong>Sources</strong> → click <strong>+</strong> → select <strong>Window Capture</strong>. In the dropdown, choose the browser window showing the display. Click OK. Right-click the source → <strong>Fit to screen</strong> so it fills the OBS canvas completely.</>],
              ['4', 'Add your camera on top', <>In OBS → Sources → <strong>+</strong> → <strong>Video Capture Device</strong> → select your webcam. Drag and resize it so it sits exactly over the <em>"PLACE OBS CAMERA HERE"</em> guide in the bottom-right corner.</>],
              ['5', 'Set OBS as your Zoom camera', <>In Zoom → <strong>Settings → Video → Camera</strong> → select <strong>OBS Virtual Camera</strong>. The timer display will now appear as your video background.</>],
            ].map(([n, title, body]) => (
              <div key={n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 26, height: 26, borderRadius: '50%', background: 'var(--maroon)', color: 'white', fontFamily: 'var(--font-head)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-head)', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{title}</div>
                  <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{body}</div>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 26, height: 26, borderRadius: '50%', background: '#e65100', color: 'white', fontFamily: 'var(--font-head)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⚠</div>
              <div>
                <div style={{ fontFamily: 'var(--font-head)', fontSize: 12, fontWeight: 700, color: '#e65100', marginBottom: 3 }}>Disable auto-framing in Zoom</div>
                <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>In Zoom → Settings → Video → uncheck <strong>"Auto-adjust my video"</strong> or <strong>"Auto-frame my video"</strong>. If left on, Zoom will detect your face and zoom in, cutting off the timer display.</div>
              </div>
            </div>
          </div>
        </div>
      </details>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: 14, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-head)', fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opening Script</span>
          <button className="btn-b" onClick={() => navigator.clipboard.writeText(TIMER_SCRIPT)} style={{ fontSize: 10, height: 28, padding: '0 10px' }}>Copy</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8, maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-line' }}>{TIMER_SCRIPT}</div>
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

      {!queue.length ? (
        <div className="empty-state"><div className="icon">⏱</div><p>No speakers in queue.<br />Add speakers above.</p></div>
      ) : (
        queue.map((sp, i) => {
          const isActive = activeIdx === i;
          const colorClass = timerColorClass(sp.elapsed || 0, sp.green, sp.yellow, sp.red);
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
              {(isActive || sp.state === 'stopped') && (
                <>
                  <div className={'timer-clock' + (sp.state === 'stopped' && !colorClass ? ' yellow' : colorClass ? ' ' + colorClass : '')}>{secToMmSs(sp.elapsed || 0)}</div>
                  <div className="timer-signals" style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '10px 0' }}>
                    <div className={'signal-dot g' + ((sp.elapsed || 0) >= sp.green ? ' active' : '')}></div>
                    <div className={'signal-dot y' + ((sp.elapsed || 0) >= sp.yellow ? ' active' : '')}></div>
                    <div className={'signal-dot r' + ((sp.elapsed || 0) >= sp.red ? ' active' : '')}></div>
                  </div>
                </>
              )}
              <div className="timer-btn-row">
                {!sp.done && (
                  isActive
                    ? <button className="btn-start running" onClick={pause}>⏸ Pause</button>
                    : sp.state === 'stopped'
                      ? <button className="btn-start" onClick={() => resumeSpeaker(i)}>▶ Resume</button>
                      : <button className="btn-start" onClick={() => startSpeaker(i)}>▶ Start</button>
                )}
                {(isActive || sp.state === 'stopped') && <button className="btn-log" onClick={() => logSpeaker(i)}>✓ Log Time</button>}
                {sp.done && <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-head)', fontWeight: 700 }}>✓ Logged {secToMmSs(sp.elapsed)}</span>}
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
              <thead><tr><th>Speaker</th><th>Type</th><th>Green</th><th>Yellow</th><th>Red</th><th>Actual</th><th>Within?</th></tr></thead>
              <tbody>
                {log.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td><td>{r.type}</td>
                    <td>{secToMmSs(r.green)}</td><td>{secToMmSs(r.yellow)}</td><td>{secToMmSs(r.red)}</td>
                    <td style={{ fontWeight: 700 }}>{secToMmSs(r.elapsed)}</td>
                    <td className={r.within ? 'within' : 'over-time'}>{r.within ? '✓ Yes' : '✗ No'}</td>
                  </tr>
                ))}
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
