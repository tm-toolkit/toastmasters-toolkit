import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const LOGO_SRC = `${import.meta.env.BASE_URL}tm-logo.png`;

export default function PostTab() {
  const [sourceImg, setSourceImg] = useState(null);
  const [footerMode, setFooterMode] = useState('full');
  const canvasRef = useRef(null);
  const logoImgRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Loaded once — same-origin under both `vite dev` and the GitHub Pages build,
  // so drawing it to canvas never taints it (unlike the file:// case the
  // standalone HTML version had to work around with a base64 data URI).
  useEffect(() => {
    const img = new Image();
    img.onload = () => { logoImgRef.current = img; render(); };
    img.src = LOGO_SRC;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img = sourceImg;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');

    const scale = img.width / 1080;
    const headerH = Math.round(150 * scale);
    const footerH = Math.round(110 * scale);
    const W = img.width;
    const H = headerH + img.height + footerH;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#0a2338';
    ctx.fillRect(0, 0, W, headerH);

    const logo = logoImgRef.current;
    const logoH = Math.round(92 * scale);
    const logoW = logo ? Math.round(logoH * (logo.width / logo.height)) : 0;
    const pad = Math.round(40 * scale);
    if (logo) ctx.drawImage(logo, pad, (headerH - logoH) / 2, logoW, logoH);
    const textX = logo ? pad + logoW + 16 * scale : pad;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 ' + Math.round(30 * scale) + 'px Arial';
    ctx.fillText('Structures College Peru', textX, headerH / 2 + 10 * scale);

    ctx.drawImage(img, 0, headerH, img.width, img.height);

    ctx.fillStyle = '#781327';
    ctx.fillRect(0, H - footerH, W, footerH);
    if (footerMode !== 'none') {
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      const text = footerMode === 'full'
        ? 'District 222, Peru  ·  Structures College Peru Toastmasters Club'
        : 'Structures College Peru Toastmasters Club';
      let fontSize = Math.round(30 * scale);
      ctx.font = '700 ' + fontSize + 'px Arial';
      while (ctx.measureText(text).width > W - 80 * scale && fontSize > 12) {
        fontSize -= 1;
        ctx.font = '700 ' + fontSize + 'px Arial';
      }
      ctx.fillText(text, W / 2, H - footerH / 2 + fontSize / 3);
      ctx.textAlign = 'left';
    }
  }, [sourceImg, footerMode]);

  useEffect(() => { render(); }, [render]);

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => setSourceImg(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    const onPaste = (e) => {
      for (const item of e.clipboardData?.items || []) {
        if (item.type.startsWith('image/')) { loadFile(item.getAsFile()); break; }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [loadFile]);

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'structures-college-post-' + Date.now() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div>
      <div className="section-head">
        <h2>Post</h2>
        <p>Paste, drag, or pick a meeting photo — get it back with the club header and district footer, ready to post.</p>
        <div className="maroon-line"></div>
      </div>

      {!sourceImg && (
        <div
          ref={dropZoneRef}
          style={{
            width: '100%', maxWidth: 420, minHeight: 280, background: 'var(--white)',
            border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, cursor: 'pointer', textAlign: 'center', padding: 20, boxShadow: 'var(--shadow)',
          }}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--maroon)'; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--border)';
            if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
          }}
        >
          <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>
            📋 Paste an image with <span style={{ fontFamily: "'Courier New',monospace", background: 'var(--surface)', padding: '2px 8px', borderRadius: 5, fontSize: 13 }}>Ctrl+V</span>
          </p>
          <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>or drag it here, or</p>
          <label className="btn-b" style={{ display: 'inline-block' }}>
            Choose file
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => loadFile(e.target.files[0])} />
          </label>
        </div>
      )}

      {sourceImg && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, marginTop: 16 }}
        >
          <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 420, height: 'auto', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <label>Footer:
              <select className="fs" style={{ height: 32, fontSize: 13 }} value={footerMode} onChange={(e) => setFooterMode(e.target.value)}>
                <option value="full">District 222, Peru · Structures College Peru Toastmasters Club</option>
                <option value="short">Structures College Peru Toastmasters Club</option>
                <option value="none">No text</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <motion.button className="btn-b" whileTap={{ scale: 0.96 }} onClick={downloadImage}>⬇ Download PNG</motion.button>
            <motion.button className="btn-s" whileTap={{ scale: 0.96 }} onClick={() => setSourceImg(null)}>↺ Another photo</motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
