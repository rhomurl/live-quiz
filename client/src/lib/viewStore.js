import { shouldApplyView } from '../../../shared/contracts.js';

const mergeEventData = new Set([
  'game:question', 'game:reveal', 'game:leaderboard', 'game:podium', 'game:ended',
  'game:player-count', 'host:lobby', 'host:progress', 'host:export-status', 'player:result',
]);

export function createGameSnapshotStore(initialSnapshot = null) {
  let snapshot = initialSnapshot;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    applySnapshot(next) {
      if (!next?.gameId) return false;
      snapshot = next;
      notify();
      return true;
    },
    apply(event, next) {
      if (!next?.gameId || !shouldApplyView(snapshot, next)) return false;
      snapshot = mergeEventData.has(event) && snapshot
        ? { ...next, data: { ...snapshot.data, ...next.data } }
        : next;
      notify();
      return true;
    },
    clear() { snapshot = null; notify(); },
  };
}

export const gameStore = createGameSnapshotStore();
