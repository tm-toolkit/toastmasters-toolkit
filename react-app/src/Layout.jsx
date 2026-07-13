import { useState } from 'react';
import Header from './components/Header';
import NavTabs from './components/NavTabs';
import RosterTab from './tabs/RosterTab';
import SessionTab from './tabs/SessionTab';
import HistoryTab from './tabs/HistoryTab';
import ChartsTab from './tabs/ChartsTab';
import OtherToolsTab from './tabs/OtherToolsTab';
import { useLocalStorageState } from './hooks/useLocalStorageState';

// All 5 tabs stay mounted at all times (display:none when inactive) — matching
// the vanilla toolkit's architecture. This matters for real: unmounting the
// Session tab on every tab switch would kill a running live timer and wipe
// out an in-progress Ah-Counter session every time someone glances at Charts.
export default function Layout() {
  const [activeTab, setActiveTab] = useState('roster');
  const [roster, setRoster] = useLocalStorageState('tmRoster', []);
  const [currentRole, setCurrentRole] = useLocalStorageState('tmRole', 'ah', { raw: true });
  const [history, setHistory] = useLocalStorageState('tmHistory', []);
  const [gsEndpoint, setGsEndpoint] = useLocalStorageState('gsEndpoint', '', { raw: true });
  const [ahCount, setAhCount] = useState(0);
  const [timerCount, setTimerCount] = useState(0);

  const sessionPillText = currentRole === 'ah'
    ? (ahCount ? `${ahCount} speaker${ahCount !== 1 ? 's' : ''}` : 'No session')
    : (timerCount ? `${timerCount} in queue` : 'No session');

  return (
    <>
      <Header currentRole={currentRole} sessionPillText={sessionPillText} />
      <NavTabs active={activeTab} onChange={setActiveTab} />
      <main>
        <div className={'tab-panel' + (activeTab === 'roster' ? ' active' : '')}>
          <RosterTab
            roster={roster}
            setRoster={setRoster}
            currentRole={currentRole}
            setCurrentRole={setCurrentRole}
            onGoToSession={() => setActiveTab('session')}
          />
        </div>
        <div className={'tab-panel' + (activeTab === 'session' ? ' active' : '')}>
          <SessionTab
            currentRole={currentRole}
            roster={roster}
            history={history}
            setHistory={setHistory}
            onAhCount={setAhCount}
            onTimerCount={setTimerCount}
          />
        </div>
        <div className={'tab-panel' + (activeTab === 'history' ? ' active' : '')}>
          <HistoryTab
            history={history}
            setHistory={setHistory}
            gsEndpoint={gsEndpoint}
            setGsEndpoint={setGsEndpoint}
          />
        </div>
        <div className={'tab-panel' + (activeTab === 'charts' ? ' active' : '')}>
          <ChartsTab
            history={history}
            gsEndpoint={gsEndpoint}
            setGsEndpoint={setGsEndpoint}
          />
        </div>
        <div className={'tab-panel' + (activeTab === 'tools' ? ' active' : '')}>
          <OtherToolsTab />
        </div>
      </main>
      <footer className="site-footer">
        Developed by <strong>Alexander Sandoval</strong> &nbsp;·&nbsp;
        District 222, Peru &nbsp;·&nbsp;
        <a
          href="https://www.toastmasters.org/Find-a-Club/07767436-structures-college-peru-toastmasters-club"
          target="_blank"
          rel="noopener noreferrer"
        >
          Structures College Peru Toastmasters Club
        </a>
      </footer>
    </>
  );
}
