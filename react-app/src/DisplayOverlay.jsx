import { useState, useEffect } from 'react';
import { useBroadcastChannel } from './hooks/useBroadcastChannel';
import { secToMmSs } from './lib/format';

function computeColors(elapsed, green, yellow, red) {
  if (red && elapsed >= red) {
    return {
      bg: 'rgba(58,1,4,0.97)', clock: '#ff6b6b', glow: 'rgba(119,36,50,0.35)',
      alertText: '⛔  TIME IS UP', alertColor: '#ff8080', bar: '#e53935', dot: '#ff6b6b',
    };
  }
  if (yellow && elapsed >= yellow) {
    const remaining = red - elapsed;
    return {
      bg: 'rgba(40,28,2,0.97)', clock: '#F2DF74', glow: 'rgba(249,168,37,0.2)',
      alertText: remaining <= 30 ? '⚠  ' + remaining + ' SEC REMAINING' : '',
      alertColor: '#F2DF74', bar: '#f9a825', dot: '#F2DF74',
    };
  }
  if (green && elapsed >= green) {
    return {
      bg: 'rgba(2,30,10,0.97)', clock: '#81c784', glow: 'rgba(67,160,71,0.18)',
      alertText: '', alertColor: 'white', bar: '#43a047', dot: '#81c784',
    };
  }
  return { bg: '#0d1b2a', clock: 'white', glow: 'rgba(255,255,255,0.06)', alertText: '', alertColor: 'white', bar: '#43a047', dot: 'white' };
}

export default function DisplayOverlay() {
  const [state, setState] = useState(null); // last {speaker, typeLabel, elapsed, green, yellow, red, running, done}
  const [obsGuide, setObsGuide] = useState(false);

  useBroadcastChannel('tm_display', (data) => { if (data.type === 'timer') setState(data); });

  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.margin = ''; document.body.style.overflow = ''; };
  }, []);

  const idle = !state || (!state.running && !state.done && !state.speaker);
  const { speaker = '', typeLabel = '', elapsed = 0, green = 0, yellow = 0, red = 0 } = state || {};
  const colors = computeColors(elapsed, green, yellow, red);

  const total = red || 1;
  const pctG = Math.round((green / total) * 100);
  const pctY = Math.round((yellow / total) * 100);
  const pctNow = Math.min(Math.round((elapsed / total) * 100), 100);

  return (
    <div style={{ position: 'fixed', inset: 0, background: idle ? '#0d1b2a' : colors.bg, fontFamily: 'Montserrat,sans-serif', overflow: 'hidden', transition: 'background 1s ease' }}>
      {/* TOP BAR */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="40" height="40" viewBox="0 0 38 38" fill="none">
            <circle cx="19" cy="19" r="17" fill="#004165" stroke="#F2DF74" strokeWidth="1.5" />
            <ellipse cx="19" cy="19" rx="8" ry="17" stroke="#F2DF74" strokeWidth="1" fill="none" />
            <line x1="2" y1="19" x2="36" y2="19" stroke="#F2DF74" strokeWidth="1" />
            <line x1="2" y1="13" x2="36" y2="13" stroke="#F2DF74" strokeWidth="0.7" />
            <line x1="2" y1="25" x2="36" y2="25" stroke="#F2DF74" strokeWidth="0.7" />
            <rect x="4" y="6" width="30" height="26" rx="2" fill="none" stroke="#F2DF74" strokeWidth="1.5" />
          </svg>
          <div>
            <div style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Toastmasters International</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.06em' }}>Timer</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#43a047', opacity: green && elapsed >= green ? 1 : 0.18, boxShadow: green && elapsed >= green ? '0 0 14px #43a047' : 'none', transition: 'opacity .4s,box-shadow .4s' }}></div>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f9a825', opacity: yellow && elapsed >= yellow ? 1 : 0.18, boxShadow: yellow && elapsed >= yellow ? '0 0 14px #f9a825' : 'none', transition: 'opacity .4s,box-shadow .4s' }}></div>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e53935', opacity: red && elapsed >= red ? 1 : 0.18, boxShadow: red && elapsed >= red ? '0 0 14px #e53935' : 'none', transition: 'opacity .4s,box-shadow .4s' }}></div>
        </div>
      </div>

      {/* OBS GUIDE TOGGLE */}
      <div style={{ position: 'absolute', top: 16, right: 110, zIndex: 20, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => setObsGuide((v) => !v)}>
        <div style={{ width: 14, height: 14, border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', background: obsGuide ? 'rgba(255,255,255,0.2)' : '' }}>{obsGuide ? '✓' : ''}</div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>OBS GUIDE</span>
      </div>

      {idle ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em' }}>STANDING BY</div>
          <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 12 }}></div>
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 120, boxSizing: 'border-box' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transition: 'opacity 1s ease', opacity: 1, background: `radial-gradient(ellipse 70% 55% at 50% 50%, ${colors.glow} 0%, transparent 70%)` }}></div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.03em', marginBottom: 4, textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>{speaker}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 32 }}>{typeLabel}</div>
          <div style={{ fontSize: 'clamp(60px,18vw,160px)', fontWeight: 700, lineHeight: 1, color: colors.clock, letterSpacing: '0.02em', transition: 'color .5s,text-shadow .5s', textShadow: `0 0 60px ${colors.glow}` }}>{secToMmSs(elapsed)}</div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.1em', minHeight: 24, marginTop: 18, opacity: colors.alertText ? 1 : 0, transition: 'opacity .4s', color: colors.alertColor }}>{colors.alertText}</div>
          <div style={{ display: 'flex', gap: 32, marginTop: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#43a047' }}>{secToMmSs(green)}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginTop: 2 }}>GREEN</div>
            </div>
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f9a825' }}>{secToMmSs(yellow)}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginTop: 2 }}>YELLOW</div>
            </div>
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e53935' }}>{secToMmSs(red)}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginTop: 2 }}>RED</div>
            </div>
          </div>
        </div>
      )}

      {!idle && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ position: 'relative', height: 20, marginBottom: 4 }}>
                <span style={{ position: 'absolute', left: 0, transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>START</span>
                <span style={{ position: 'absolute', left: pctG + '%', transform: 'translateX(-50%)', fontSize: 9, color: '#43a047', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{secToMmSs(green)}</span>
                <span style={{ position: 'absolute', left: pctY + '%', transform: 'translateX(-50%)', fontSize: 9, color: '#f9a825', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{secToMmSs(yellow)}</span>
                <span style={{ position: 'absolute', right: 0, transform: 'translateX(50%)', fontSize: 9, color: '#e53935', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{secToMmSs(red)}</span>
              </div>
              <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                <div style={{ height: '100%', borderRadius: 3, transition: 'width 1s linear,background .5s', width: pctNow + '%', background: colors.bar }}></div>
                <div style={{ position: 'absolute', top: -6, width: 2, height: 18, background: '#43a047', borderRadius: 1, opacity: 0.8, transform: 'translateX(-50%)', left: pctG + '%' }}></div>
                <div style={{ position: 'absolute', top: -6, width: 2, height: 18, background: '#f9a825', borderRadius: 1, opacity: 0.8, transform: 'translateX(-50%)', left: pctY + '%' }}></div>
                <div style={{ position: 'absolute', top: -6, right: 0, width: 2, height: 18, background: '#e53935', borderRadius: 1, opacity: 0.8 }}></div>
                <div style={{ position: 'absolute', top: '50%', width: 14, height: 14, borderRadius: '50%', background: colors.dot, border: '2px solid rgba(0,0,0,0.4)', transform: 'translate(-50%,-50%)', transition: 'left 1s linear,background .5s', left: pctNow + '%' }}></div>
              </div>
            </div>
            {obsGuide && (
              <div style={{ width: 200, height: 112, flexShrink: 0, border: '2px dashed rgba(255,255,255,0.25)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textAlign: 'center' }}>PLACE OBS CAMERA HERE</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>16:9</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
