// Green/yellow/red visual treatment for the Timer Video's live-preview colors.
export function computeColors(elapsed, green, yellow, red) {
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
