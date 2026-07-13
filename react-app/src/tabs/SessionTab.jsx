import AhCounterPanel from './session/AhCounterPanel';
import TimerPanel from './session/TimerPanel';

export default function SessionTab({ currentRole, roster, history, setHistory, onAhCount, onTimerCount }) {
  return (
    <div>
      <div style={{ display: currentRole === 'ah' ? '' : 'none' }}>
        <AhCounterPanel roster={roster} history={history} setHistory={setHistory} onCountChange={onAhCount} />
      </div>
      <div style={{ display: currentRole === 'timer' ? '' : 'none' }}>
        <TimerPanel roster={roster} history={history} setHistory={setHistory} onCountChange={onTimerCount} />
      </div>
    </div>
  );
}
