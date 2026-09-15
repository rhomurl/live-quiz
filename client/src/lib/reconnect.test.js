import assert from 'node:assert/strict';
import test from 'node:test';

import { createAckEmitter } from './ack.js';
import { formatCountdown, remainingMs, serverOffsetMs } from './clock.js';
import { createMemoryStorage, createPlayerSession } from './session.js';
import { createGameSnapshotStore } from './viewStore.js';

const question = (revision, ownAnswer = null) => ({
  gameId: 'game-1', state: 'QUESTION', stateVersion: 1, revision, serverNowMs: 11_000,
  data: { question: { index: 0, endsAtMs: 15_000 }, eligible: true, ownAnswer },
});

test('replaces a stale question view with a resync snapshot and recalculates the countdown', () => {
  const store = createGameSnapshotStore(question(9));
  assert.equal(store.apply('host:progress', question(8)), false);
  assert.equal(store.applySnapshot(question(2, 3)), true);
  assert.equal(store.getSnapshot().revision, 2);
  assert.equal(store.getSnapshot().data.ownAnswer, 3);
  assert.equal(remainingMs(store.getSnapshot().data.question.endsAtMs, serverOffsetMs(11_000, 10_000), 10_000), 4_000);
});

test('keeps join and recovery request IDs stable across acknowledgement retries', () => {
  const session = createPlayerSession(createMemoryStorage());
  session.setPendingJoinRequestId('join-request');
  session.setPendingRecoveryRequestId('recovery-request');
  assert.equal(session.load().joinRequestId, 'join-request');
  assert.equal(session.load().recoveryRequestId, 'recovery-request');
  session.clearPendingJoinRequestId();
  session.clearPendingRecoveryRequestId();
  assert.deepEqual(session.load(), {});
});

test('turns an unacknowledged answer into a timeout so the caller can resync', async () => {
  const emitter = createAckEmitter({ connected: true, emit() {} }, { timeoutMs: 1 });
  await assert.rejects(() => emitter.emitWithAck('player:answer', { gameId: 'game-1' }), { code: 'ACK_TIMEOUT' });
});

test('preserves the complete role view while a public transition precedes its private snapshot', () => {
  const current = {
    gameId: 'game-1', state: 'QUESTION', stateVersion: 1, revision: 4, serverNowMs: 11_000,
    data: { question: { index: 0 }, progress: { eligibleCount: 2, answeredCount: 1 } },
  };
  const store = createGameSnapshotStore(current);
  assert.equal(store.apply('game:reveal', {
    gameId: 'game-1', state: 'REVEAL', stateVersion: 2, revision: 5, serverNowMs: 12_000,
    data: { reveal: { correctOptionIndex: 0 } },
  }), true);
  assert.equal(store.getSnapshot().data.progress.answeredCount, 1);
  assert.equal(store.getSnapshot().data.reveal.correctOptionIndex, 0);
});

test('formats the server-synchronized countdown as a realtime clock', () => {
  assert.equal(formatCountdown(30_000), '00:30');
  assert.equal(formatCountdown(15_000), '00:15');
  assert.equal(formatCountdown(0), '00:00');
  assert.equal(formatCountdown(65_000), '01:05');
});
