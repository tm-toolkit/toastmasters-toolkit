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
  '500 16px Montserrat', '700 26px Montserrat', '600 16px Montserrat', '700 140px Montserrat',
  '700 20px Montserrat', '700 30px Montserrat', '600 13px Montserrat',
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

  // Top-left: club logo. Sized for a Zoom *gallery* tile, not a solo/pinned
  // view — in an actual meeting with several people on screen, the whole
  // 1920x1080 frame gets squeezed into a tile a couple hundred pixels wide,
  // shrinking everything on it by 7-8x. A logo/clock that reads fine zoomed
  // in is illegible at that size, so everything here runs much bigger than
  // it looks like it "should" need to be at full resolution.
  const logoH = 108;
  let textX = 28;
  if (logoImg) {
    const logoW = logoH * (logoImg.width / logoImg.height);
    ctx.drawImage(logoImg, 28, 20, logoW, logoH);
    textX = 28 + logoW + 16;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '500 16px Montserrat';
  ctx.fillText('TOASTMASTERS INTERNATIONAL', textX, 55);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 26px Montserrat';
  ctx.fillText('TIMER', textX, 95);

  // Top-right: speaker/type/clock, mirroring the logo's corner. Zoom
  // composites the presenter's full body roughly across the middle of the
  // frame, so nothing sits center.
  ctx.textAlign = 'right';
  let cy = 46;
  if (speakerName) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 26px Montserrat';
    ctx.fillText(speakerName, W - 28, cy);
    cy += 30;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '600 16px Montserrat';
  ctx.fillText(typeLabel.toUpperCase(), W - 28, cy);

  ctx.fillStyle = colors.clock;
  ctx.font = '700 140px Montserrat';
  ctx.fillText(secToMmSs(elapsed), W - 28, 240);

  if (colors.alertText) {
    ctx.fillStyle = colors.alertColor;
    ctx.font = '700 20px Montserrat';
    ctx.fillText(colors.alertText, W - 28, 272);
  }

  // Left edge — green/yellow/red reference times. Horizontally clear of the
  // presenter (who occupies roughly the middle third of the frame's width),
  // so there's no vertical constraint here — sized to match the clock.
  ctx.textAlign = 'left';
  const leftX = 32;
  const markers = [
    ['GREEN', green, '#43a047'],
    ['YELLOW', yellow, '#f9a825'],
    ['RED', red, '#e53935'],
  ];
  markers.forEach(([label, val, color], i) => {
    const y = 320 + i * 90;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(leftX + 10, y - 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 30px Montserrat';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(secToMmSs(val), leftX + 32, y);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '600 13px Montserrat';
    ctx.fillText(label, leftX + 32, y + 22);
  });

  // Right edge — the same idea as the live Display Window's progress bar
  // (a dot traveling past green/yellow/red tick marks on a track), just
  // rotated: top = start, bottom = red, instead of left-to-right.
  const total = red || 1;
  const trackX = W - 60, trackTop = 300, trackBottom = 580;
  const yFor = (v) => trackTop + Math.min(v / total, 1) * (trackBottom - trackTop);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(trackX, trackTop);
  ctx.lineTo(trackX, trackBottom);
  ctx.stroke();

  [[green, '#43a047'], [yellow, '#f9a825'], [red, '#e53935']].forEach(([val, color]) => {
    const y = yFor(val);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(trackX - 14, y);
    ctx.lineTo(trackX + 14, y);
    ctx.stroke();
  });

  const dotY = yFor(elapsed);
  ctx.fillStyle = colors.dot;
  ctx.beginPath();
  ctx.arc(trackX, dotY, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 3;
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

export default function TimerVideoTool({ green, yellow, red, typeLabel, speakerName }) {
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
      <h3 className="tool-title">🎥 Zoom Background Video</h3>
      <p className="tool-desc">
        Download the video for the speaker and type selected above, and set it as your Zoom Video Virtual
        Background — then start the live clock below when they begin and switch your background to match.
      </p>

      {status === 'unsupported' && (
        <div style={{ background: '#fce4ec', color: '#c62828', padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 14 }}>
          This browser doesn't support in-browser video encoding. Try a recent Chrome or Edge.
        </div>
      )}

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
