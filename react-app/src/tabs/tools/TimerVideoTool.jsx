import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from 'mediabunny';
import { secToMmSs } from '../../lib/format';
import { getPreset, TYPE_LABELS } from '../../lib/timerPresets';
import { computeColors } from '../../lib/timerColors';

const LOGO_SRC = `${import.meta.env.BASE_URL}tm-logo.png`;
// Layout math stays in this 1280x720 logical space; the canvas that actually
// gets encoded is scaled up to 1920x1080 (Zoom's documented max) via
// ctx.scale() in generateMp4, so text renders crisper without redoing
// every coordinate below.
const W = 1280, H = 720;
const OUTPUT_SCALE = 1.5;
// Extra time recorded past "red" so the video keeps showing TIME IS UP instead
// of cutting off — Zoom loops the file once it runs out, which resets the
// clock to 0:00, so this just delays that reset for speakers who run a bit over.
const OVERTIME_BUFFER_SEC = 120;

const FONT_WEIGHTS = [
  '500 10px Montserrat', '700 15px Montserrat', '700 17px Montserrat', '600 10px Montserrat',
  '700 72px Montserrat', '700 13px Montserrat', '600 8px Montserrat',
];

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function drawFrame(ctx, logoImg, { speakerName, typeLabel, elapsed, green, yellow, red }) {
  const colors = computeColors(elapsed, green, yellow, red);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: club logo. The brand manual's 72px figure is a *minimum* for
  // small print/web placements (buttons, footers) — this is the dominant
  // graphic on a full-frame background, so it runs well above that floor.
  const logoH = 56;
  let textX = 24;
  if (logoImg) {
    const logoW = logoH * (logoImg.width / logoImg.height);
    ctx.drawImage(logoImg, 24, 16, logoW, logoH);
    textX = 24 + logoW + 12;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '500 10px Montserrat';
  ctx.fillText('TOASTMASTERS INTERNATIONAL', textX, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 15px Montserrat';
  ctx.fillText('TIMER', textX, 60);

  // Top-right: speaker/type/clock, mirroring the logo's corner. Zoom
  // composites the presenter's full body roughly across the middle of the
  // frame, so nothing sits center — but this plays inside a small gallery
  // tile during an actual meeting, so the clock still runs large to stay
  // readable at a glance, not just clear of the presenter.
  ctx.textAlign = 'right';
  let cy = 32;
  if (speakerName) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 17px Montserrat';
    ctx.fillText(speakerName, W - 24, cy);
    cy += 20;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '600 10px Montserrat';
  ctx.fillText(typeLabel.toUpperCase(), W - 24, cy);

  ctx.fillStyle = colors.clock;
  ctx.font = '700 72px Montserrat';
  ctx.fillText(secToMmSs(elapsed), W - 24, 145);

  if (colors.alertText) {
    ctx.fillStyle = colors.alertColor;
    ctx.font = '700 13px Montserrat';
    ctx.fillText(colors.alertText, W - 24, 168);
  }

  // Left edge, vertically centered in the middle (person) band — green/
  // yellow/red reference times, clear of both the top band and the center.
  ctx.textAlign = 'left';
  const leftX = 30;
  const markers = [
    ['GREEN', green, '#43a047'],
    ['YELLOW', yellow, '#f9a825'],
    ['RED', red, '#e53935'],
  ];
  markers.forEach(([label, val, color], i) => {
    const y = 300 + i * 44;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(leftX + 5, y - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 13px Montserrat';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(secToMmSs(val), leftX + 18, y);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '600 8px Montserrat';
    ctx.fillText(label, leftX + 18, y + 12);
  });

  // Right edge — the same idea as the live Display Window's progress bar
  // (a dot traveling past green/yellow/red tick marks on a track), just
  // rotated: top = start, bottom = red, instead of left-to-right.
  const total = red || 1;
  const trackX = W - 40, trackTop = 296, trackBottom = 456;
  const yFor = (v) => trackTop + Math.min(v / total, 1) * (trackBottom - trackTop);

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(trackX, trackTop);
  ctx.lineTo(trackX, trackBottom);
  ctx.stroke();

  [[green, '#43a047'], [yellow, '#f9a825'], [red, '#e53935']].forEach(([val, color]) => {
    const y = yFor(val);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trackX - 7, y);
    ctx.lineTo(trackX + 7, y);
    ctx.stroke();
  });

  const dotY = yFor(elapsed);
  ctx.fillStyle = colors.dot;
  ctx.beginPath();
  ctx.arc(trackX, dotY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Encodes one unique frame per simulated second (content only changes on
// second boundaries) via Mediabunny/WebCodecs — this runs as fast as the
// machine can encode, not tied to real playback time like MediaRecorder
// would be, so a 9-minute video takes a few seconds to build, not 9 minutes.
async function generateMp4({ green, yellow, red, speakerName, typeLabel, logoImg, onProgress }) {
  const totalSec = red + OVERTIME_BUFFER_SEC;
  const canvas = document.createElement('canvas');
  canvas.width = W * OUTPUT_SCALE;
  canvas.height = H * OUTPUT_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(OUTPUT_SCALE, OUTPUT_SCALE);

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: 6_000_000 });
  output.addVideoTrack(videoSource, { frameRate: 1 });
  await output.start();

  for (let elapsed = 0; elapsed <= totalSec; elapsed++) {
    drawFrame(ctx, logoImg, { speakerName, typeLabel, elapsed, green, yellow, red });
    await videoSource.add(elapsed, 1);
    onProgress?.(elapsed, totalSec);
  }

  await output.finalize();
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}

export default function TimerVideoTool({ roster = [] }) {
  const [type, setType] = useState('speech57');
  const [customTotal, setCustomTotal] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [guestName, setGuestName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | generating | done | unsupported
  const [progressPct, setProgressPct] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const logoImgRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { logoImgRef.current = img; };
    img.src = LOGO_SRC;
  }, []);

  useEffect(() => {
    if (typeof VideoEncoder === 'undefined') setStatus('unsupported');
  }, []);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const [green, yellow, red] = getPreset(type, customTotal);
  const typeLabel = TYPE_LABELS[type] || type;
  const totalRecordSec = red + OVERTIME_BUFFER_SEC;
  const speakerName = selectValue === '__guest__' ? guestName.trim() : selectValue;

  const generate = useCallback(async () => {
    await Promise.all(FONT_WEIGHTS.map((f) => document.fonts.load(f)));
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); }
    setStatus('generating');
    setProgressPct(0);

    const blob = await generateMp4({
      green, yellow, red, speakerName, typeLabel, logoImg: logoImgRef.current,
      onProgress: (elapsed, total) => setProgressPct(Math.round((elapsed / total) * 100)),
    });

    setVideoUrl(URL.createObjectURL(blob));
    setStatus('done');
  }, [speakerName, typeLabel, green, yellow, red, videoUrl]);

  const downloadName = `zoom-timer-${slugify(typeLabel)}${speakerName ? '-' + slugify(speakerName) : ''}.mp4`;

  return (
    <div>
      <h3 className="tool-title">🎥 Zoom Background Video</h3>
      <p className="tool-desc">
        Pick the speaker and type, download the video, and set it as your Zoom Video Virtual Background —
        then start the live clock below when they begin and switch your background to match.
      </p>

      {status === 'unsupported' && (
        <div style={{ background: '#fce4ec', color: '#c62828', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 14 }}>
          This browser doesn't support in-browser video encoding. Try a recent Chrome or Edge.
        </div>
      )}

      <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '13px 16px', marginBottom: 14, boxShadow: 'var(--shadow)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="fg" style={{ maxWidth: 190 }}>
          <span className="fl">Type</span>
          <select className="fs" value={type} onChange={(e) => setType(e.target.value)} disabled={status === 'generating'}>
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
            <input className="fi" type="text" placeholder="15:00" value={customTotal} onChange={(e) => setCustomTotal(e.target.value)} disabled={status === 'generating'} />
          </div>
        )}
        <div className="fg" style={{ minWidth: 170 }}>
          <span className="fl">Speaker</span>
          <select className="fs" value={selectValue} onChange={(e) => setSelectValue(e.target.value)} disabled={status === 'generating'}>
            <option value="">— No name (reuse for anyone) —</option>
            {roster.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            <option value="__guest__">✚ Add guest…</option>
          </select>
        </div>
        {selectValue === '__guest__' && (
          <div className="fg" style={{ maxWidth: 170 }}>
            <span className="fl">Guest name</span>
            <input className="fi" type="text" placeholder="Type name" value={guestName} onChange={(e) => setGuestName(e.target.value)} disabled={status === 'generating'} />
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        🟢 {secToMmSs(green)} · 🟡 {secToMmSs(yellow)} · 🔴 {secToMmSs(red)} — video runs {secToMmSs(totalRecordSec)} total (includes {OVERTIME_BUFFER_SEC / 60} extra minutes past red, in case the speaker runs over).
      </div>

      {status === 'idle' || status === 'unsupported' ? (
        <motion.button className="btn-b" whileTap={{ scale: 0.96 }} onClick={generate} disabled={status === 'unsupported'}>
          ⏺ Generate Video
        </motion.button>
      ) : status === 'generating' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--maroon)', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 13 }}>Generating your video…</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Just a few seconds — building the MP4 in your browser.</div>
            </div>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: progressPct + '%', background: 'var(--maroon)', borderRadius: 3, transition: 'width .2s linear' }} />
          </div>
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
            <motion.button className="btn-s" whileTap={{ scale: 0.96 }} onClick={generate}>⟳ Generate another</motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
