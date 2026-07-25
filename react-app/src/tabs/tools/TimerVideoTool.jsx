import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { secToMmSs } from '../../lib/format';
import { getPreset, TYPE_LABELS } from '../../lib/timerPresets';
import { computeColors } from '../../lib/timerColors';

const LOGO_SRC = `${import.meta.env.BASE_URL}tm-logo.png`;
const W = 1280, H = 720;
// Extra time recorded past "red" so the video keeps showing TIME IS UP instead
// of cutting off — Zoom loops the file once it runs out, which resets the
// clock to 0:00, so this just delays that reset for speakers who run a bit over.
const OVERTIME_BUFFER_SEC = 120;

const FONT_WEIGHTS = ['500 9px Montserrat', '600 11px Montserrat', '700 15px Montserrat', '700 22px Montserrat', '700 140px Montserrat'];

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function drawFrame(ctx, logoImg, { speakerName, typeLabel, elapsed, green, yellow, red }) {
  const colors = computeColors(elapsed, green, yellow, red);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top bar
  const logoH = 40;
  let textX = 24;
  if (logoImg) {
    const logoW = logoH * (logoImg.width / logoImg.height);
    ctx.drawImage(logoImg, 24, 16, logoW, logoH);
    textX = 24 + logoW + 12;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '500 9px Montserrat';
  ctx.fillText('TOASTMASTERS INTERNATIONAL', textX, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 12px Montserrat';
  ctx.fillText('TIMER', textX, 46);

  // Center block
  ctx.textAlign = 'center';
  let cy = H / 2 - 130;
  if (speakerName) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 22px Montserrat';
    ctx.fillText(speakerName, W / 2, cy);
    cy += 30;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '600 11px Montserrat';
  ctx.fillText(typeLabel.toUpperCase(), W / 2, cy);

  ctx.fillStyle = colors.clock;
  ctx.font = '700 140px Montserrat';
  ctx.fillText(secToMmSs(elapsed), W / 2, H / 2 + 45);

  if (colors.alertText) {
    ctx.fillStyle = colors.alertColor;
    ctx.font = '700 15px Montserrat';
    ctx.fillText(colors.alertText, W / 2, H / 2 + 90);
  }

  const row = [
    ['GREEN', green, '#43a047'],
    ['YELLOW', yellow, '#f9a825'],
    ['RED', red, '#e53935'],
  ];
  row.forEach(([label, val, color], i) => {
    const x = W / 2 + (i - 1) * 130;
    ctx.fillStyle = color;
    ctx.font = '700 15px Montserrat';
    ctx.fillText(secToMmSs(val), x, H / 2 + 135);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '600 9px Montserrat';
    ctx.fillText(label, x, H / 2 + 150);
  });

  // Bottom progress bar
  const total = red || 1;
  const pct = Math.min(elapsed / total, 1);
  const x1 = 60, x2 = W - 60, barY = H - 50;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(x1, barY, x2 - x1, 6);
  ctx.fillStyle = colors.bar;
  ctx.fillRect(x1, barY, (x2 - x1) * pct, 6);
}

export default function TimerVideoTool() {
  const [type, setType] = useState('speech57');
  const [customTotal, setCustomTotal] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | recording | done | unsupported
  const [elapsedSec, setElapsedSec] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const canvasRef = useRef(null);
  const logoImgRef = useRef(null);
  const intervalRef = useRef(null);
  const recorderRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { logoImgRef.current = img; };
    img.src = LOGO_SRC;
  }, []);

  useEffect(() => {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
      setStatus('unsupported');
    }
  }, []);

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [green, yellow, red] = getPreset(type, customTotal);
  const typeLabel = TYPE_LABELS[type] || type;
  const totalRecordSec = red + OVERTIME_BUFFER_SEC;

  const startRecording = useCallback(async () => {
    const canvas = canvasRef.current;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    await Promise.all(FONT_WEIGHTS.map((f) => document.fonts.load(f)));

    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); }
    setStatus('recording');
    setElapsedSec(0);
    drawFrame(ctx, logoImgRef.current, { speakerName, typeLabel, elapsed: 0, green, yellow, red });

    const stream = canvas.captureStream(30);
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
    recorderRef.current = recorder;
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      setVideoUrl(URL.createObjectURL(blob));
      setStatus('done');
    };
    recorder.start();

    let elapsed = 0;
    intervalRef.current = setInterval(() => {
      elapsed += 1;
      drawFrame(ctx, logoImgRef.current, { speakerName, typeLabel, elapsed, green, yellow, red });
      setElapsedSec(elapsed);
      if (elapsed >= totalRecordSec) {
        clearInterval(intervalRef.current);
        recorder.stop();
      }
    }, 1000);
  }, [speakerName, typeLabel, green, yellow, red, totalRecordSec, videoUrl]);

  // Stops early and keeps whatever was recorded so far — e.g. skip the extra
  // minute of "TIME IS UP" tail. Recording finishes via recorder.onstop above,
  // which is what actually flips status to 'done'; setting status here too
  // would race the (async) stop event and could stomp its result.
  const stopRecording = () => {
    clearInterval(intervalRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  const downloadName = `zoom-timer-${slugify(typeLabel)}${speakerName ? '-' + slugify(speakerName) : ''}.webm`;
  const progressPct = Math.min(Math.round((elapsedSec / totalRecordSec) * 100), 100);

  return (
    <div>
      <h3 className="tool-title">Timer Video (no OBS needed)</h3>
      <p className="tool-desc">
        Generates a countdown video you download once and set directly as a Zoom Video Virtual Background —
        no OBS, no window capture, nothing to configure in Zoom beyond picking the file. It builds in the
        background — pick your settings, hit Generate, and download it when it's ready.
      </p>

      {status === 'unsupported' && (
        <div style={{ background: '#fce4ec', color: '#c62828', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 14 }}>
          This browser doesn't support recording canvas to video. Try a recent Chrome or Edge.
        </div>
      )}

      {/* Off-screen — canvas.captureStream() needs a real, sized canvas in the
          DOM, but there's no reason to show the countdown ticking by; nobody
          wants to watch a clock to get a file. */}
      <canvas ref={canvasRef} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} aria-hidden="true" />

      <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '13px 16px', marginBottom: 14, boxShadow: 'var(--shadow)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="fg" style={{ maxWidth: 190 }}>
          <span className="fl">Type</span>
          <select className="fs" value={type} onChange={(e) => setType(e.target.value)} disabled={status === 'recording'}>
            <option value="speech57">Speech (5–7 min)</option>
            <option value="eval">Evaluator (2–3 min)</option>
            <option value="topics">Table Topics (1–2 min)</option>
            <option value="speech46">Ice Breaker (4–6 min)</option>
            <option value="custom">Custom…</option>
          </select>
        </div>
        {type === 'custom' && (
          <div className="fg" style={{ maxWidth: 140 }}>
            <span className="fl">Total time (mm:ss)</span>
            <input className="fi" type="text" placeholder="15:00" value={customTotal} onChange={(e) => setCustomTotal(e.target.value)} disabled={status === 'recording'} />
          </div>
        )}
        <div className="fg" style={{ minWidth: 200 }}>
          <span className="fl">Speaker name (optional)</span>
          <input className="fi" type="text" placeholder="Leave blank to reuse for anyone" value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} disabled={status === 'recording'} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        🟢 {secToMmSs(green)} · 🟡 {secToMmSs(yellow)} · 🔴 {secToMmSs(red)} — video runs {secToMmSs(totalRecordSec)} total (includes {OVERTIME_BUFFER_SEC / 60} extra minutes past red, in case the speaker runs over).
      </div>

      {status === 'idle' || status === 'unsupported' ? (
        <motion.button className="btn-b" whileTap={{ scale: 0.96 }} onClick={startRecording} disabled={status === 'unsupported'}>
          ⏺ Generate Video
        </motion.button>
      ) : status === 'recording' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--maroon)', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 13 }}>Generating your video…</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Keep this tab open — no need to watch it, just let it run.</div>
            </div>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: progressPct + '%', background: 'var(--maroon)', borderRadius: 3, transition: 'width 1s linear' }} />
          </div>
          <button className="btn-s" style={{ fontSize: 11, alignSelf: 'flex-start' }} onClick={stopRecording}>
            Don't want to wait? Stop now and download what's ready
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          {videoUrl && (
            /* eslint-disable-next-line jsx-a11y/media-has-caption -- generated clip has no audio track */
            <video src={videoUrl} controls style={{ width: '100%', maxWidth: 420, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', background: '#0d1b2a' }} />
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            {videoUrl && (
              <motion.a
                className="btn-b" whileTap={{ scale: 0.96 }} href={videoUrl} download={downloadName}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                ⬇ Download Video
              </motion.a>
            )}
            <motion.button className="btn-s" whileTap={{ scale: 0.96 }} onClick={startRecording}>⟳ Generate another</motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
