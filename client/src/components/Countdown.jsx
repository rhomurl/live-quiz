import { formatCountdown, remainingMs } from '../lib/clock.js';
import { useServerClock } from '../lib/gameHooks.jsx';
export default function Countdown({ startsAtMs, endsAtMs }) {
  const { offsetMs, now } = useServerClock();
  const remaining = remainingMs(endsAtMs, offsetMs, now);
  const duration = Math.max(1, (endsAtMs ?? now) - (startsAtMs ?? now));
  const percentage = Math.min(100, Math.max(0, remaining / duration * 100));
  const urgent = remaining <= 5_000;
  return <div className={`countdown-wrap ${urgent ? 'is-urgent' : ''}`} role="timer" aria-label={`${formatCountdown(remaining)} remaining`}>
    <output className="countdown" aria-live="polite">{formatCountdown(remaining)}</output>
    <div className="countdown-track" aria-hidden="true"><span className="countdown-bar" style={{ width: `${percentage}%` }} /></div>
  </div>;
}
