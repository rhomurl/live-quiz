import { useEffect, useState, useSyncExternalStore } from 'react';
import { emitWithAck } from './ack.js';
import { serverOffsetMs } from './clock.js';
import { hostSession } from './hostSession.js';
import { playerSession } from './session.js';
import { socket } from './socket.js';
import { gameStore } from './viewStore.js';

const EVENTS = ['game:question', 'game:reveal', 'game:leaderboard', 'game:podium', 'game:ended', 'game:player-count', 'host:lobby', 'host:progress', 'host:export-status', 'player:result'];

export function useGameSnapshot() {
  return useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, gameStore.getSnapshot);
}

export function useServerClock() {
  const snapshot = useGameSnapshot();
  const [now, setNow] = useState(Date.now());
  const [offsetMs, setOffsetMs] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (snapshot) setOffsetMs(serverOffsetMs(snapshot.serverNowMs, Date.now()));
  }, [snapshot?.revision, snapshot?.serverNowMs]);
  return { offsetMs, now, serverNowMs: now + offsetMs };
}

function authenticatedSession(gameId) {
  const host = hostSession.load();
  if (host.gameId === gameId && host.hostSecret) return host;
  const player = playerSession.load();
  return player.gameId === gameId && player.resumeToken ? player : null;
}

export function useGameConnection() {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onSnapshot = (view) => gameStore.applySnapshot(view);
    const onEvent = (event) => (view) => {
      const applied = gameStore.apply(event, view);
      // Room events are intentionally public and omit role-private standing/export fields.
      // Replace them with the authenticated complete view before rendering that state.
      if (applied && ['game:leaderboard', 'game:podium', 'game:ended'].includes(event)) {
        const session = authenticatedSession(view.gameId);
        if (session && socket.connected) emitWithAck(socket, 'game:resync', { gameId: view.gameId }).then(({ snapshot }) => gameStore.applySnapshot(snapshot)).catch(() => {});
      }
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('game:snapshot', onSnapshot);
    const handlers = EVENTS.map((event) => [event, onEvent(event)]);
    handlers.forEach(([event, handler]) => socket.on(event, handler));
    return () => {
      socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('game:snapshot', onSnapshot);
      handlers.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, []);
  const snapshot = useGameSnapshot();
  useEffect(() => {
    const resync = () => {
      const session = snapshot && authenticatedSession(snapshot.gameId);
      if (document.visibilityState === 'visible' && session && socket.connected) emitWithAck(socket, 'game:resync', { gameId: session.gameId }).then(({ snapshot }) => gameStore.applySnapshot(snapshot)).catch(() => {});
    };
    document.addEventListener('visibilitychange', resync);
    return () => document.removeEventListener('visibilitychange', resync);
  }, [snapshot?.gameId]);
  return connected;
}
