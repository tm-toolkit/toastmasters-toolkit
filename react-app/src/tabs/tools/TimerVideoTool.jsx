import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from 'mediabunny';
import { secToMmSs } from '../../lib/format';
import { getPreset, TYPE_LABELS } from '../../lib/timerPresets';
import { computeColors } from '../../lib/timerColors';

const LOGO_SRC = `${import.meta.env.BASE_URL}tm-logo.png`;
const W = 1280, H = 720;
// Extra time recorded past "red" so the video keeps showing TIME IS UP instead
// of cutting off — Zoom loops the file once it runs out, which resets the
// clock to 0:00, so this just delays that reset for speakers who run a bit over.
const OVERTIME_BUFFER_SEC = 120;

const FONT_WEIGHTS = [
  '500 9px Montserrat', '700 12px Montserrat', '700 20px Montserrat', '600 10px Montserrat',
  '700 68px Montserrat', '700 13px Montserrat', '600 8px Montserrat',
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

  // Everything lives in a band across the top ~40% of the frame. Zoom's
  // virtual background puts the actual person — face included — roughly
  // centered in the frame, so nothing important can sit at vertical center
  // the way it does on the live Display Window (which layers a *separate*,
  // small camera box via OBS instead of a full-body cutout).
  ctx.textAlign = 'center';
  let cy = 90;
  if (speakerName) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 20px Montserrat';
    ctx.fillText(speakerName, W / 2, cy);
    cy += 22;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '600 10px Montserrat';
  ctx.fillText(typeLabel.toUpperCase(), W / 2, cy);

  ctx.fillStyle = colors.clock;
  ctx.font = '700 68px Montserrat';
  ctx.fillText(secToMmSs(elapsed), W / 2, 195);

  if (colors.alertText) {
    ctx.fillStyle = colors.alertColor;
    ctx.font = '700 13px Montserrat';
    ctx.fillText(colors.alertText, W / 2, 218);
  }

  const row = [
    ['GREEN', green, '#43a047'],
    ['YELLOW', yellow, '#f9a825'],
    ['RED', red, '#e53935'],
  ];
  row.forEach(([label, val, color], i) => {
    const x = W / 2 + (i - 1) * 110;
    ctx.fillStyle = color;
    ctx.font = '700 13px Montserrat';
    ctx.fillText(secToMmSs(val), x, 248);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '600 8px Montserrat';
    ctx.fillText(label, x, 261);
  });

  // Progress bar — kept inside the same top band rather than at the bottom
  // edge, since the bottom is just as likely to be covered (desk, hands,
  // chest) depending on how close someone sits to their camera.
  const total = red || 1;
  const pct = Math.min(elapsed / total, 1);
  const x1 = W / 2 - 170, x2 = W / 2 + 170, barY = 280;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x1, barY, x2 - x1, 4);
  ctx.fillStyle = colors.bar;
  ctx.fillRect(x1, barY, (x2 - x1) * pct, 4);
}

// Encodes one unique frame per simulated second (content only changes on
// second boundaries) via Mediabunny/WebCodecs — this runs as fast as the
// machine can encode, not tied to real playback time like MediaRecorder
// would be, so a 9-minute video takes a few seconds to build, not 9 minutes.
async function generateMp4({ green, yellow, red, speakerName, typeLabel, logoImg, onProgress }) {
  const totalSec = red + OVERTIME_BUFFER_SEC;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: 2_000_000 });
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

export default function TimerVideoTool() {
  const [type, setType] = useState('speech57');
  const [customTotal, setCustomTotal] = useState('');
  const [speakerName, setSpeakerName] = useState('');
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
      <h3 className="tool-title">Timer Video (no OBS needed)</h3>
      <p className="tool-desc">
        Generates a countdown video you download once and set directly as a Zoom Video Virtual Background —
        no OBS, no window capture, nothing to configure in Zoom beyond picking the file.
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
        <div className="fg" style={{ minWidth: 200 }}>
          <span className="fl">Speaker name (optional)</span>
          <input className="fi" type="text" placeholder="Leave blank to reuse for anyone" value={speakerName} onChange={(e) => setSpeakerName(e.target.value)} disabled={status === 'generating'} />
        </div>
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
