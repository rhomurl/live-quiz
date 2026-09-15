import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AnswerButton from '../components/AnswerButton.jsx';
import Countdown from '../components/Countdown.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import Podium from '../components/Podium.jsx';
import { emitWithAck } from '../lib/ack.js';
import { useGameSnapshot } from '../lib/gameHooks.jsx';
import { newRequestId, playerSession } from '../lib/session.js';
import { shouldDiscardResumeSession } from '../lib/reconnect.js';
import { socket } from '../lib/socket.js';
import { gameStore } from '../lib/viewStore.js';

function RecoveryNotice({ code }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  const copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
      else {
        const input = document.createElement('textarea');
        input.value = code; input.setAttribute('readonly', ''); input.style.position = 'fixed'; input.style.opacity = '0';
        document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
      }
      setCopied(true);
    } catch { setCopied(false); }
  };
  return <aside className="recovery-notice" role="status"><h2>Save your recovery code</h2><p>Keep this code somewhere private. It is the way to recover on a new tab or device.</p><div className="recovery-code-row"><code>{code}</code><button type="button" className="copy-button" onClick={copyCode} aria-label="Copy recovery code" title="Copy recovery code"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><rect x="8" y="8" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="2" /></svg></button></div><p aria-live="polite">{copied ? 'Copied to clipboard.' : 'This code is shown once.'}</p></aside>;
}

export default function Play() {
  const snapshot = useGameSnapshot(); const location = useLocation(); const navigate = useNavigate();
  const [selected, setSelected] = useState(null); const [sending, setSending] = useState(false); const [notice, setNotice] = useState('');
  const resumeInFlight = useRef(false); const connectEpoch = useRef(0); const wakeLock = useRef(null);
  const resume = async () => {
    if (resumeInFlight.current) return;
    const saved = playerSession.load();
    if (!saved.gameId || !saved.resumeToken) return navigate('/', { replace: true });
    const epoch = connectEpoch.current;
    resumeInFlight.current = true;
    try {
      const data = await emitWithAck(socket, 'player:resume', { gameId: saved.gameId, pin: saved.pin, playerId: saved.playerId, resumeToken: saved.resumeToken });
      gameStore.applySnapshot(data.snapshot);
    } catch (error) {
      if (shouldDiscardResumeSession(error.code)) { playerSession.clear(); navigate('/', { replace: true }); }
      else setNotice('Reconnected. Restoring your quiz session…');
    } finally {
      resumeInFlight.current = false;
      // A socket replacement while its predecessor awaited an acknowledgement needs its own resume.
      if (connectEpoch.current !== epoch && socket.connected) resume();
    }
  };
  useEffect(() => { const onConnect = () => { connectEpoch.current += 1; resume(); }; socket.on('connect', onConnect); if (socket.connected) onConnect(); return () => socket.off('connect', onConnect); }, []);
  useEffect(() => { const acquire = async () => { if (document.visibilityState === 'visible' && window.isSecureContext && 'wakeLock' in navigator) { try { wakeLock.current = await navigator.wakeLock.request('screen'); } catch {} } }; acquire(); const onVisibility = () => { if (document.visibilityState === 'visible' && !wakeLock.current) acquire(); }; document.addEventListener('visibilitychange', onVisibility); return () => { document.removeEventListener('visibilitychange', onVisibility); wakeLock.current?.release?.(); }; }, []);
  useEffect(() => { if (snapshot?.state !== 'QUESTION') { setSelected(null); setSending(false); } else if (snapshot.data.ownAnswer !== null && snapshot.data.ownAnswer !== undefined) { setSelected(snapshot.data.ownAnswer); setSending(false); } }, [snapshot?.state, snapshot?.revision]);
  if (!snapshot) return <main className="page"><p>Restoring your quiz session…</p></main>;
  const data = snapshot.data;
  const submitAnswer = async (optionIndex) => { if (sending || data.ownAnswer !== null || !data.eligible) return; setSelected(optionIndex); setSending(true); setNotice('Sending answer…'); try { const acknowledgement = await emitWithAck(socket, 'player:answer', { gameId: snapshot.gameId, questionIndex: data.question.index, optionIndex, clientRequestId: newRequestId() }); setSelected(acknowledgement.optionIndex); setNotice('Answer locked'); } catch (error) { setNotice(error.code === 'ACK_TIMEOUT' ? 'Confirming your answer with the server…' : 'Your answer could not be sent.'); try { const { snapshot: refreshed } = await emitWithAck(socket, 'game:resync', { gameId: snapshot.gameId }); gameStore.applySnapshot(refreshed); if (refreshed.state === 'QUESTION' && refreshed.data.ownAnswer === null) { setSelected(null); setNotice('Choose an answer before time ends.'); } } catch {} } finally { setSending(false); } };
  if (snapshot.state === 'LOBBY') return <main className="page"><RecoveryNotice code={location.state?.recoveryCode} /><section className="panel"><h1>You’re in</h1><p>Waiting for the host to start. {data.connectedCount} connected of {data.totalCount} joined.</p></section></main>;
  if (snapshot.state === 'QUESTION' && !Object.hasOwn(data, 'eligible')) return <main className="page"><section className="panel"><p role="status">Starting question…</p></section></main>;
  if (snapshot.state === 'QUESTION') return <main className="page"><RecoveryNotice code={location.state?.recoveryCode} /><section className="panel question screen-enter"><p>Question {data.question.index + 1} of {data.question.total}</p><Countdown startsAtMs={data.question.startsAtMs} endsAtMs={data.question.endsAtMs} /><h1>{data.question.text}</h1>{!data.eligible && <p className="notice">You join from the next question.</p>}<div className="answer-grid">{data.question.options.map((option, index) => <AnswerButton key={index} optionIndex={index} disabled={!data.eligible || sending || data.ownAnswer !== null || selected !== null} selected={selected === index} onClick={() => submitAnswer(index)}>{option}</AnswerButton>)}</div><p role="status" aria-live="polite">{data.ownAnswer !== null ? 'Answer locked' : notice}</p></section></main>;
  if (snapshot.state === 'REVEAL' && !data.ownResult) return <main className="page"><section className="panel"><p role="status">Calculating your result…</p></section></main>;
  if (snapshot.state === 'REVEAL') return <main className="page"><section className="panel"><h1>{data.ownResult.correct ? 'Correct' : 'Incorrect'}</h1><p>The correct answer was option {String.fromCharCode(65 + data.reveal.correctOptionIndex)}.</p><p>You gained {data.ownResult.pointsEarned} points. Total: {data.ownResult.score}. Rank: {data.ownResult.rank}.</p>{data.reveal.explanation && <p className="explanation">{data.reveal.explanation}</p>}</section></main>;
  if (snapshot.state === 'LEADERBOARD') return <main className="page panel"><Leaderboard leaderboard={data.leaderboard} own={data.own} /></main>;
  if (snapshot.state === 'PODIUM') return <main className="page panel"><Podium podium={data.podium} own={data.own} /></main>;
  return <main className="page panel"><h1>Quiz ended</h1><p>{data.reason === 'aborted' ? 'The host ended the quiz early.' : 'Thanks for playing.'}</p><Podium podium={data.podium} own={data.own} /></main>;
}
