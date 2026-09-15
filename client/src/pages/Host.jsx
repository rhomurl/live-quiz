import { useEffect, useRef, useState } from 'react';
import Distribution from '../components/host/Distribution.jsx';
import Countdown from '../components/Countdown.jsx';
import FullscreenButton from '../components/FullscreenButton.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import Podium from '../components/Podium.jsx';
import QRCode from '../components/QRCode.jsx';
import QuizEditor from '../components/QuizEditor.jsx';
import { emitWithAck } from '../lib/ack.js';
import { useGameSnapshot } from '../lib/gameHooks.jsx';
import { hostSession } from '../lib/hostSession.js';
import { newRequestId } from '../lib/session.js';
import { shouldDiscardResumeSession } from '../lib/reconnect.js';
import { socket } from '../lib/socket.js';
import { gameStore } from '../lib/viewStore.js';

const ERROR_COPY = { BAD_SECRET: 'The host secret is not valid.', QUIZ_NOT_FOUND: 'Choose a valid quiz.', QUIZ_EXISTS: 'That quiz ID already exists.', STALE_COMMAND: 'The quiz changed before that command completed. The latest server state is shown.', ACK_TIMEOUT: 'The server did not confirm that command. The latest state is being requested.', OFFLINE: 'Reconnect before controlling the quiz.', EXPORT_UNAVAILABLE: 'Results are not available yet.' };
const errorCopy = (code) => ERROR_COPY[code] ?? 'The server could not complete that request.';

function ExportStatus({ exportStatus, onRetry, onDownload, pending }) {
  if (!exportStatus) return null;
  if (exportStatus.status === 'pending') return <p role="status">Preparing the result export…</p>;
  if (exportStatus.status === 'saved') return <p className="success" role="status">Results saved. <button className="link-button" disabled={pending} onClick={onDownload}>Download results</button></p>;
  return <p className="error" role="alert">Results could not be exported. {exportStatus.message} <button className="link-button" disabled={pending} onClick={onRetry}>Retry export</button></p>;
}

export default function Host() {
  const snapshot = useGameSnapshot(); const [quizzes, setQuizzes] = useState([]); const [quizId, setQuizId] = useState(''); const [hostSecret, setHostSecret] = useState(''); const [pending, setPending] = useState(false); const [error, setError] = useState(''); const [showEditor, setShowEditor] = useState(false); const [confirmAbort, setConfirmAbort] = useState(false); const resumeInFlight = useRef(false); const connectEpoch = useRef(0);
  const resync = async () => { const current = gameStore.getSnapshot(); if (!current || !socket.connected) return; try { const { snapshot: refreshed } = await emitWithAck(socket, 'game:resync', { gameId: current.gameId }); gameStore.applySnapshot(refreshed); } catch {} };
  useEffect(() => { fetch('/api/quizzes').then((response) => response.ok ? response.json() : []).then((items) => { const list = Array.isArray(items) ? items : []; setQuizzes(list); setQuizId((current) => current || list[0]?.id || ''); }).catch(() => {}); }, []);
  const resume = async () => {
    if (resumeInFlight.current) return;
    const saved = hostSession.load();
    if (!saved.gameId || !saved.hostSecret) return;
    const epoch = connectEpoch.current;
    resumeInFlight.current = true;
    try {
      const data = await emitWithAck(socket, 'host:resume', saved);
      gameStore.applySnapshot(data.snapshot);
    } catch (requestError) {
      if (shouldDiscardResumeSession(requestError.code)) hostSession.clear();
      else setError('Reconnected. Restoring host controls…');
    } finally {
      resumeInFlight.current = false;
      if (connectEpoch.current !== epoch && socket.connected) resume();
    }
  };
  useEffect(() => { const onConnect = () => { connectEpoch.current += 1; resume(); }; socket.on('connect', onConnect); if (socket.connected) onConnect(); return () => socket.off('connect', onConnect); }, []);
  const create = async (event) => { event.preventDefault(); setPending(true); setError(''); try { const data = await emitWithAck(socket, 'host:create', { quizId, hostSecret, requestId: newRequestId() }); hostSession.save({ gameId: data.gameId, pin: data.pin, hostSecret }); gameStore.applySnapshot(data.snapshot); } catch (requestError) { setError(errorCopy(requestError.code)); } finally { setPending(false); } };
  const transition = async (event) => { const current = gameStore.getSnapshot(); if (!current || pending) return; setPending(true); setError(''); try { const data = await emitWithAck(socket, event, { gameId: current.gameId, requestId: newRequestId(), expectedStateVersion: current.stateVersion }); gameStore.applySnapshot(data.snapshot); } catch (requestError) { setError(errorCopy(requestError.code)); if (requestError.code === 'ACK_TIMEOUT' || requestError.code === 'STALE_COMMAND') resync(); } finally { setPending(false); setConfirmAbort(false); } };
  const retryExport = async () => { const current = gameStore.getSnapshot(); if (!current) return; setPending(true); try { await emitWithAck(socket, 'host:retry-export', { gameId: current.gameId, requestId: newRequestId() }); await resync(); } catch (requestError) { setError(errorCopy(requestError.code)); } finally { setPending(false); } };
  const download = async () => { const current = gameStore.getSnapshot(); if (!current) return; setPending(true); try { const data = await emitWithAck(socket, 'host:result-download', { gameId: current.gameId, requestId: newRequestId() }); if (data.downloadUrl) window.location.assign(data.downloadUrl); } catch (requestError) { setError(errorCopy(requestError.code)); } finally { setPending(false); } };
  useEffect(() => { const shortcut = (event) => { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return; if ((event.key === ' ' || event.key === 'ArrowRight') && snapshot && ['LOBBY', 'REVEAL', 'LEADERBOARD', 'PODIUM'].includes(snapshot.state)) { event.preventDefault(); transition(snapshot.state === 'LOBBY' ? 'host:start' : snapshot.state === 'PODIUM' ? 'host:end' : 'host:next'); } }; document.addEventListener('keydown', shortcut); return () => document.removeEventListener('keydown', shortcut); }, [snapshot, pending]);
  if (!snapshot) return <main className="page host-page"><section className="panel screen-enter"><h1>Host a live quiz</h1><form onSubmit={create}><label>Quiz<select value={quizId} onChange={(event) => setQuizId(event.target.value)} required><option value="" disabled>Select a quiz</option>{quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}</select></label><label>Host secret<input type="password" value={hostSecret} onChange={(event) => setHostSecret(event.target.value)} autoComplete="current-password" required /></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary-button" disabled={pending || !quizId}>{pending ? 'Creating…' : 'Create quiz'}</button></form><button type="button" className="link-button" onClick={() => { setShowEditor((current) => !current); setError(''); }}>{showEditor ? 'Use an existing quiz' : 'Create a new quiz'}</button></section>{showEditor && <QuizEditor hostSecret={hostSecret} onCreated={(summary) => { setQuizzes((current) => [...current, summary]); setQuizId(summary.id); setShowEditor(false); setError('Quiz saved. Select it and create the game.'); }} />}</main>;
  const data = snapshot.data; const nextEvent = snapshot.state === 'LOBBY' ? 'host:start' : snapshot.state === 'PODIUM' ? 'host:end' : 'host:next'; const nextLabel = snapshot.state === 'LOBBY' ? 'Start quiz' : snapshot.state === 'PODIUM' ? 'End quiz' : 'Next'; const supportsNext = ['LOBBY', 'REVEAL', 'LEADERBOARD', 'PODIUM'].includes(snapshot.state);
  return <main className="page host-page"><header className="host-toolbar"><span>Host controls</span><FullscreenButton /></header>{error && <p className="error" role="alert">{error}</p>}
    {snapshot.state === 'LOBBY' && <section className="panel"><h1>Quiz PIN: <strong className="pin">{data.pin}</strong></h1><QRCode value={data.joinUrl} /><p>{data.connectedCount} connected of {data.totalCount} joined</p><h2>Players</h2><ul className="roster">{data.players.map((player) => <li key={player.playerId}>{player.nickname} — {player.connected ? 'connected' : 'reconnecting'}</li>)}</ul></section>}
    {snapshot.state === 'QUESTION' && !data.progress && <section className="panel"><p role="status">Starting question…</p></section>}
    {snapshot.state === 'QUESTION' && data.progress && <section className="panel question screen-enter"><p>Question {data.question.index + 1} of {data.question.total}</p><Countdown startsAtMs={data.question.startsAtMs} endsAtMs={data.question.endsAtMs} /><h1>{data.question.text}</h1><ol className="host-options">{data.question.options.map((option, index) => <li key={index}>{String.fromCharCode(65 + index)}. {option}</li>)}</ol><p>{data.progress.answeredCount} answered of {data.progress.eligibleCount} eligible</p></section>}
    {snapshot.state === 'REVEAL' && !data.progress && <section className="panel"><p role="status">Revealing results…</p></section>}
    {snapshot.state === 'REVEAL' && data.progress && <section className="panel screen-enter"><h1>Answer: {String.fromCharCode(65 + data.reveal.correctOptionIndex)}</h1>{data.reveal.explanation && <p className="explanation">{data.reveal.explanation}</p>}<p>{data.progress.answeredCount} answered of {data.progress.eligibleCount} eligible</p><Distribution distribution={data.reveal.distribution} /></section>}
    {snapshot.state === 'LEADERBOARD' && <section className="panel"><Leaderboard leaderboard={data.leaderboard} /></section>}
    {snapshot.state === 'PODIUM' && <section className="panel"><Podium podium={data.podium} /><ExportStatus exportStatus={data.exportStatus} onRetry={retryExport} onDownload={download} pending={pending} /></section>}
    {snapshot.state === 'ENDED' && <section className="panel"><h1>Quiz ended</h1><Podium podium={data.podium} /><ExportStatus exportStatus={data.exportStatus} onRetry={retryExport} onDownload={download} pending={pending} /></section>}
    {supportsNext && <div className="host-actions"><button className="primary-button" disabled={pending} onClick={() => transition(nextEvent)}>{pending ? 'Sending…' : nextLabel}</button></div>}
    {snapshot.state !== 'ENDED' && <div className="danger-zone">{confirmAbort ? <><p>End the quiz now? A partial result export will be attempted.</p><button className="danger-button" disabled={pending} onClick={() => transition('host:abort')}>Confirm end quiz</button><button className="quiet-button" disabled={pending} onClick={() => setConfirmAbort(false)}>Keep quiz running</button></> : <button className="quiet-button" onClick={() => setConfirmAbort(true)}>Abort quiz</button>}</div>}
  </main>;
}
