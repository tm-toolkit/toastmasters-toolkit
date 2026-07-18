import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { OFFICER_POSITIONS } from '../../lib/constants';

const TEMPLATE_SRC = `${import.meta.env.BASE_URL}zoom-template.png`;

// Calibrated to sit directly under the template's "DISTRICT 222 · PERU" line,
// matching its font, size, color, and letter-spacing.
const GOLD = '#EAC85A';
const LINE_X = 175;
const LINE_BASELINE_Y = 161;
const FONT_SIZE = 15;
const TRACKING = 2;

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function ZoomBackgroundTool({ defaultPosition }) {
  const [position, setPosition] = useState(defaultPosition || OFFICER_POSITIONS[0]);
  const [ready, setReady] = useState(false);
  const canvasRef = useRef(null);
  const templateImgRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { templateImgRef.current = img; setReady(true); };
    img.src = TEMPLATE_SRC;
  }, []);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    const img = templateImgRef.current;
    if (!canvas || !img) return;
    await document.fonts.load(`600 ${FONT_SIZE}px Montserrat`);

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    ctx.font = `600 ${FONT_SIZE}px Montserrat`;
    ctx.fillStyle = GOLD;
    ctx.textBaseline = 'alphabetic';
    let x = LINE_X;
    for (const ch of position.toUpperCase()) {
      ctx.fillText(ch, x, LINE_BASELINE_Y);
      x += ctx.measureText(ch).width + TRACKING;
    }
  }, [position]);

  useEffect(() => { if (ready) render(); }, [ready, position, render]);

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `zoom-background-${slugify(position)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div>
      <h3 className="tool-title">Zoom Background</h3>
      <p className="tool-desc">Pick your position — get your personalized virtual background with the club's official branding, ready to set in Zoom.</p>

      <div className="fg" style={{ maxWidth: 320 }}>
        <span className="fl">Position</span>
        <select className="fs" value={position} onChange={(e) => setPosition(e.target.value)}>
          {OFFICER_POSITIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, marginTop: 16 }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 480, height: 'auto', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }} />
        <motion.button className="btn-b" whileTap={{ scale: 0.96 }} onClick={downloadImage} disabled={!ready}>⬇ Download PNG</motion.button>
      </motion.div>
    </div>
  );
}
