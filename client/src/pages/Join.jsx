import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { emitWithAck } from '../lib/ack.js';
import { gameStore } from '../lib/viewStore.js';
import { newRequestId, playerSession } from '../lib/session.js';
import { socket } from '../lib/socket.js';

const ERROR_COPY = {
  BAD_PAYLOAD: 'Please check the information and try again.', GAME_NOT_FOUND: 'That PIN does not match an active quiz.', GAME_FULL: 'This quiz is full.', GAME_ENDED: 'This quiz has already ended.', NICKNAME_TAKEN: 'That nickname is already in use for this quiz.', NICKNAME_INVALID: 'Use 2–16 letters, numbers, spaces, or underscores.', BAD_RECOVERY_CODE: 'That recovery code does not match this player.', THROTTLED: 'Too many attempts. Please wait and try again.', SERVER_CAPACITY: 'The quiz server is at capacity. Please try again shortly.', OFFLINE: 'You are offline. Reconnect before joining.', ACK_TIMEOUT: 'The server did not confirm yet. Retry safely with the same request.',
};

function validNickname(value) { const trimmed = value.trim(); return [...trimmed].length >= 2 && [...trimmed].length <= 16 && /^[\p{L}\p{N}_ ]+$/u.test(trimmed); }
const errorCopy = (code) => ERROR_COPY[code] ?? 'The server could not complete that request.';

export default function Join() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryPin = new URLSearchParams(location.search).get('pin')?.replace(/\D/g, '').slice(0, 6) ?? '';
  const [pin, setPin] = useState(queryPin);
  const [nickname, setNickname] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [mode, setMode] = useState('join');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (!/^\d{6}$/.test(pin)) return setError('Enter the six-digit quiz PIN.');
    if (!validNickname(nickname)) return setError(ERROR_COPY.NICKNAME_INVALID);
    setPending(true);
    const isRecovery = mode === 'recover';
    const saved = playerSession.load();
    const requestId = isRecovery ? saved.recoveryRequestId ?? newRequestId() : saved.joinRequestId ?? newRequestId();
    if (isRecovery) playerSession.setPendingRecoveryRequestId(requestId); else playerSession.setPendingJoinRequestId(requestId);
    const payload = isRecovery
      ? { pin, nickname: nickname.trim(), recoveryCode, recoveryRequestId: requestId }
      : { pin, nickname: nickname.trim(), joinRequestId: requestId };
    try {
      const data = await emitWithAck(socket, isRecovery ? 'player:recover' : 'player:join', payload);
      playerSession.save({ gameId: data.gameId, pin, playerId: data.playerId, resumeToken: data.resumeToken, nickname: nickname.trim() });
      if (isRecovery) playerSession.clearPendingRecoveryRequestId(); else playerSession.clearPendingJoinRequestId();
      gameStore.applySnapshot(data.snapshot);
      navigate('/play', { replace: true, state: data.recoveryCode ? { recoveryCode: data.recoveryCode } : null });
    } catch (requestError) { setError(errorCopy(requestError.code)); }
    finally { setPending(false); }
  };

  return <main className="page join-page"><section className="panel"><h1>Join the live quiz</h1><p>Enter the PIN on the host screen, then choose a nickname.</p>
    <form onSubmit={submit} noValidate>
      <label>Quiz PIN<input inputMode="numeric" pattern="[0-9]*" maxLength="6" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" required /></label>
      <label>Nickname<input maxLength="16" value={nickname} onChange={(event) => setNickname(event.target.value)} autoComplete="nickname" required /></label>
      {mode === 'recover' && <label>Recovery code<input value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} autoComplete="off" required /></label>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary-button" disabled={pending}>{pending ? (mode === 'recover' ? 'Recovering…' : 'Joining…') : mode === 'recover' ? 'Recover session' : 'Join quiz'}</button>
    </form>
    <button type="button" className="link-button" onClick={() => { setMode(mode === 'recover' ? 'join' : 'recover'); setError(''); }}>{mode === 'recover' ? 'Join with a new nickname' : 'Recover a session'}</button>
    {mode === 'recover' && <p className="help">Use recovery only on a new tab or device. A closed browser tab may not keep its session.</p>}
  </section></main>;
}
