import assert from 'node:assert/strict';
import test from 'node:test';

import { createAckEmitter } from '../src/lib/ack.js';
import { remainingMs, serverOffsetMs } from '../src/lib/clock.js';
import { createMemoryStorage, createPlayerSession } from '../src/lib/session.js';
import { createHostSession } from '../src/lib/hostSession.js';
import { shouldDiscardResumeSession } from '../src/lib/reconnect.js';
import { createGameSnapshotStore } from '../src/lib/viewStore.js';
import { CONTRACT_FIXTURES } from '../../shared/contracts.js';

const lobby = {
  gameId: 'game-1', state: 'LOBBY', stateVersion: 0, revision: 2, serverNowMs: 11_000,
  data: { pin: '123456', joinUrl: 'https://example.test/?pin=123456', players: [], connectedCount: 0, totalCount: 0 },
};

test('uses server-now minus client-now for a countdown', () => {
  assert.equal(serverOffsetMs(11_000, 10_000), 1_000);
  assert.equal(remainingMs(14_000, 1_000, 10_000), 3_000);
  assert.equal(remainingMs(9_000, 1_000, 10_000), 0);
});

test('replaces snapshots and only accepts newer revisions for the same game', () => {
  const store = createGameSnapshotStore();
  assert.equal(store.applySnapshot(lobby), true);
  assert.equal(store.apply('host:lobby', { ...lobby, revision: 3, data: { players: [{ playerId: 'p1', nickname: 'Ada', connected: true }], connectedCount: 1, totalCount: 1 } }), true);
  assert.equal(store.getSnapshot().data.pin, '123456');
  assert.equal(store.getSnapshot().data.players[0].nickname, 'Ada');
  assert.equal(store.apply('game:player-count', { ...lobby, revision: 3, data: { connectedCount: 2, totalCount: 2 } }), false);
  assert.equal(store.apply('game:player-count', { ...lobby, revision: 4, data: { connectedCount: 2, totalCount: 2 } }), true);
  assert.equal(store.apply('game:player-count', { ...lobby, gameId: 'other-game', revision: 5, data: { connectedCount: 3, totalCount: 3 } }), false);
  assert.equal(store.getSnapshot().stateVersion, 0);
});

test('keeps stateVersion separate from revision when applying host transitions', () => {
  const store = createGameSnapshotStore(lobby);
  const question = { ...lobby, state: 'QUESTION', stateVersion: 1, revision: 5, data: { question: { index: 0, options: ['A', 'B', 'C', 'D'] } } };
  assert.equal(store.apply('game:question', question), true);
  assert.equal(store.getSnapshot().stateVersion, 1);
  assert.equal(store.getSnapshot().revision, 5);
});

test('hydrates every role and state contract snapshot as a complete view', () => {
  for (const fixture of CONTRACT_FIXTURES.filter((fixture) => fixture.kind === 'snapshot')) {
    const store = createGameSnapshotStore();
    assert.equal(store.applySnapshot(fixture.view), true, fixture.name);
    assert.deepEqual(store.getSnapshot(), fixture.view, fixture.name);
  }
});

test('player session persists only permitted resume and retry fields', () => {
  const session = createPlayerSession(createMemoryStorage());
  session.save({ gameId: 'game-1', pin: '123456', playerId: 'p1', resumeToken: 'opaque', nickname: 'Ada', recoveryCode: 'do-not-save', secret: 'nope' });
  session.setPendingJoinRequestId('join-1');
  session.setPendingRecoveryRequestId('recover-1');
  assert.deepEqual(session.load(), { gameId: 'game-1', pin: '123456', playerId: 'p1', resumeToken: 'opaque', nickname: 'Ada', joinRequestId: 'join-1', recoveryRequestId: 'recover-1' });
});

test('host session is tab-scoped and only stores resume credentials', () => {
  const session = createHostSession(createMemoryStorage());
  session.save({ gameId: 'game-1', pin: '123456', hostSecret: 'host-only', nickname: 'Ada' });
  assert.deepEqual(session.load(), { gameId: 'game-1', pin: '123456', hostSecret: 'host-only' });
});

test('never emits commands when offline and turns acknowledgement expiry into a timeout', async () => {
  let emitted = false;
  const offline = createAckEmitter({ connected: false, emit() { emitted = true; } }, { timeoutMs: 10 });
  await assert.rejects(() => offline.emitWithAck('player:answer', {}), { code: 'OFFLINE' });
  assert.equal(emitted, false);

  const online = createAckEmitter({ connected: true, emit() {} }, { timeoutMs: 1 });
  await assert.rejects(() => online.emitWithAck('player:answer', {}), { code: 'ACK_TIMEOUT' });
});

test('keeps a saved session across transient reconnect failures and discards only invalid credentials', () => {
  assert.equal(shouldDiscardResumeSession('ACK_TIMEOUT'), false);
  assert.equal(shouldDiscardResumeSession('OFFLINE'), false);
  assert.equal(shouldDiscardResumeSession('BAD_RESUME_TOKEN'), true);
  assert.equal(shouldDiscardResumeSession('GAME_NOT_FOUND'), true);
  assert.equal(shouldDiscardResumeSession('BAD_SECRET'), true);
});
