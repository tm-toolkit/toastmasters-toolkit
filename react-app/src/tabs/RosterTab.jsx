import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OFFICER_POSITIONS } from '../lib/constants';

// Note: "Sadith Lopez" is duplicated here on purpose — it matches the
// original list exactly (parity with the vanilla toolkit's DEFAULT_MEMBERS).
const DEFAULT_MEMBERS = [
  'Alexander Sandoval', 'Angela Figueroa', 'Antonio Guerra', 'Carlos Millones',
  'Erika Fernandez', 'Leonardo Chihuan', 'Lincol Rios', 'Magaly Fernandez',
  'Mary Salazar', 'Niki Caceres', 'Sadith Lopez', 'Sadith Lopez',
  'Sara Cueva', 'Yvette Arbulu',
];

function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function RosterTab({ roster, setRoster, currentRole, setCurrentRole, userName, setUserName, userPosition, setUserPosition, onGoToSession }) {
  const [nameInput, setNameInput] = useState('');
  // Resets every mount, same as the vanilla app's loadDefaultMembers() — this
  // tracks today's chip selection, independent of what's already in the roster.
  const [defaultActive, setDefaultActive] = useState({});

  const addToRoster = () => {
    const name = nameInput.trim();
    if (!name) return;
    if (roster.find((r) => r.name.toLowerCase() === name.toLowerCase())) {
      alert('Already in roster.');
      return;
    }
    setRoster([...roster, { name }]);
    setNameInput('');
  };

  const removeFromRoster = (i) => setRoster(roster.filter((_, idx) => idx !== i));

  const clearRoster = () => {
    if (!roster.length || !confirm('Clear roster?')) return;
    setRoster([]);
  };

  const addDefaultsToRoster = () => {
    let next = roster;
    DEFAULT_MEMBERS.forEach((n) => {
      if (!next.find((r) => r.name === n)) next = [...next, { name: n }];
    });
    setRoster(next);
    const active = {};
    DEFAULT_MEMBERS.forEach((n) => { active[n] = true; });
    setDefaultActive(active);
  };

  const toggleDefaultMember = (name) => {
    const nowActive = !(defaultActive[name] !== false);
    setDefaultActive({ ...defaultActive, [name]: nowActive });
    if (nowActive) {
      if (!roster.find((r) => r.name === name)) setRoster([...roster, { name }]);
    } else {
      setRoster(roster.filter((r) => r.name !== name));
    }
  };

  return (
    <div>
      <div className="section-head">
        <h2>Today&apos;s Meeting</h2>
        <p>Set your role first, then add the members for today</p>
        <div className="maroon-line"></div>
      </div>

      <div style={{ background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '13px 16px', marginBottom: 16, boxShadow: 'var(--shadow)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="fg" style={{ minWidth: 200 }}>
          <span className="fl">Your name</span>
          <input
            className="fi" type="text" placeholder="e.g. Ralph Smedley"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
        </div>
        <div className="fg" style={{ minWidth: 220 }}>
          <span className="fl">Position</span>
          <select className="fs" value={userPosition} onChange={(e) => setUserPosition(e.target.value)}>
            {OFFICER_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingBottom: 9, maxWidth: 260 }}>
          Shown on the Display Window and pre-filled into the Zoom Background tool.
        </div>
      </div>

      <div className="role-selector">
        <div className={'role-card' + (currentRole === 'ah' ? ' active' : '')} onClick={() => setCurrentRole('ah')}>
          <div className="role-card-icon">🎙</div>
          <div className="role-card-name">Ah Counter</div>
          <div className="role-card-desc">Track filler words per speaker</div>
        </div>
        <div className={'role-card timer-card' + (currentRole === 'timer' ? ' active' : '')} onClick={() => setCurrentRole('timer')}>
          <div className="role-card-icon">⏱</div>
          <div className="role-card-name">Timer</div>
          <div className="role-card-desc">Monitor speech &amp; evaluation times</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="fg">
          <span className="fl">Member name</span>
          <input
            className="fi" type="text" placeholder="e.g. Carlos Mendoza"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addToRoster(); }}
          />
        </div>
        <button className="btn-p" onClick={addToRoster}>+ Add Member</button>
        <button className="btn-s" onClick={clearRoster}>Clear Roster</button>
      </div>

      {!roster.length ? (
        <div className="empty-state"><div className="icon">👥</div><p>No members yet.</p></div>
      ) : (
        <div className="roster-list">
          <AnimatePresence>
            {roster.map((r, i) => (
              <motion.div
                key={r.name}
                className="roster-item"
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="roster-avatar">{initials(r.name)}</div>
                <span className="roster-name">{r.name}</span>
                <button className="btn-d" onClick={() => removeFromRoster(i)}>Remove</button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <span style={{ fontFamily: 'var(--font-head)', fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Club Members</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Pre-loaded — remove any that won&apos;t attend today</span>
          </div>
          <button className="btn-b" onClick={addDefaultsToRoster} style={{ fontSize: 10, height: 28, padding: '0 10px' }}>+ Add default members</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DEFAULT_MEMBERS.map((name, idx) => {
            const active = defaultActive[name] !== false;
            return (
              <motion.div
                key={name + idx}
                onClick={() => toggleDefaultMember(name)}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 20,
                  cursor: 'pointer', fontFamily: 'var(--font-head)', fontSize: 12, fontWeight: 600,
                  userSelect: 'none',
                  background: active ? '#e8f5e9' : 'var(--gray-fair)',
                  border: active ? '1.5px solid #43a047' : '1.5px solid var(--border)',
                  color: active ? '#2e7d32' : 'var(--text-muted)',
                }}
              >
                {(active ? '✓ ' : '○ ') + name}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 14, textAlign: 'right' }}>
        <button className="btn-b" onClick={onGoToSession}>Go to Session →</button>
      </div>
    </div>
  );
}
