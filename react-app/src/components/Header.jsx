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
          <img className="brand-globe" src={`${import.meta.env.BASE_URL}tm-logo.png`} alt="Toastmasters International" />
          <div className="brand-text">
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
