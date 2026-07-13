import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

export default function Header({ currentRole = 'ah', sessionPillText = 'No session' }) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  const toggle = useCallback(() => {
    if (running) {
      clearInterval(intervalRef.current);
      setRunning(false);
    } else {
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setRunning(true);
    }
  }, [running]);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setSeconds(0);
  }, []);

  const timerClass = 'hdr-timer' + (seconds >= 420 ? ' over' : seconds >= 300 ? ' warn' : '');

  return (
    <header>
      <motion.div
        className="header-inner"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      >
        <motion.div
          className="brand"
          variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}
        >
          <svg className="brand-globe" viewBox="0 0 38 38" fill="none">
            <circle cx="19" cy="19" r="17" fill="#004165" stroke="#F2DF74" strokeWidth="1.5" />
            <ellipse cx="19" cy="19" rx="8" ry="17" stroke="#F2DF74" strokeWidth="1" fill="none" />
            <line x1="2" y1="19" x2="36" y2="19" stroke="#F2DF74" strokeWidth="1" />
            <line x1="2" y1="13" x2="36" y2="13" stroke="#F2DF74" strokeWidth="0.7" />
            <line x1="2" y1="25" x2="36" y2="25" stroke="#F2DF74" strokeWidth="0.7" />
            <rect x="4" y="6" width="30" height="26" rx="2" fill="none" stroke="#F2DF74" strokeWidth="1.5" />
          </svg>
          <div className="brand-text">
            <div className="org">Toastmasters International</div>
            <div className="name">Club Toolkit</div>
            <div className="club">District 222, Peru &nbsp;·&nbsp; Structures College Peru Toastmasters Club</div>
          </div>
        </motion.div>

        <motion.div
          className="header-right"
          variants={{ hidden: { opacity: 0, x: 12 }, show: { opacity: 1, x: 0 } }}
        >
          <span className={'role-badge ' + (currentRole === 'ah' ? 'ah' : 'timer')}>
            {currentRole === 'ah' ? 'Ah Counter' : 'Timer'}
          </span>
          <span className="session-pill">{sessionPillText}</span>
          <span className={timerClass}>{formatTime(seconds)}</span>
          <motion.button className={'btn-ht' + (running ? ' running' : '')} whileTap={{ scale: 0.94 }} onClick={toggle}>
            {running ? '⏸ PAUSE' : seconds > 0 ? '▶ RESUME' : '▶ START'}
          </motion.button>
          <motion.button className="btn-ht" whileTap={{ scale: 0.94 }} onClick={reset}>↺</motion.button>
        </motion.div>
      </motion.div>
    </header>
  );
}
