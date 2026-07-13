const TABS = [
  { id: 'roster', label: '👥 Roster' },
  { id: 'session', label: '⚡ Session' },
  { id: 'history', label: '📋 History' },
  { id: 'charts', label: '📊 Charts' },
  { id: 'post', label: '📸 Post' },
];

export default function NavTabs({ active, onChange }) {
  return (
    <div className="nav-bar">
      <div className="nav-inner">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'nav-tab' + (active === t.id ? ' active' : '')}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
