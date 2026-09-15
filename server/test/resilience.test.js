import assert from 'node:assert/strict';
import test from 'node:test';

import { GameManager } from '../game.js';

const quiz = {
  id: 'resilience-quiz', title: 'Resilience quiz', questions: [{
    text: 'Choose A', options: ['A', 'B', 'C', 'D'], correct: 0, timeLimitSeconds: 5, points: 1000,
  }],
};

function socket(id) { return { id, data: {}, emit() {} }; }

function createManager({ now = () => 1_000, onEvent = null } = {}) {
  let byte = 1;
  return new GameManager({
    quizzes: new Map([[quiz.id, quiz]]), now, onEvent,
    randomBytes: (size) => Buffer.alloc(size, byte++),
  });
}

function createGame(manager) {
  const created = manager.create(quiz.id);
  assert.equal(created.ok, undefined);
  return created;
}

test('rejects nickname-only impersonation and atomically replaces a valid player socket', () => {
  const manager = createManager();
  const created = createGame(manager);
  const joined = manager.join({ pin: created.pin, nickname: 'Ada', joinRequestId: 'join-ada' }).data;
  const original = socket('original');
  const replacement = socket('replacement');
  assert.equal(manager.attachPlayer(created.gameId, joined.playerId, original).ok, true);

  assert.equal(manager.join({ pin: created.pin, nickname: ' ada ', joinRequestId: 'intruder' }).error, 'NICKNAME_TAKEN');
  assert.equal(manager.resume({ gameId: created.gameId, pin: created.pin, playerId: joined.playerId, resumeToken: 'nickname-is-not-a-token' }, replacement).error, 'BAD_RESUME_TOKEN');
  assert.equal(manager.resume({ gameId: created.gameId, pin: created.pin, playerId: joined.playerId, resumeToken: joined.resumeToken }, replacement).ok, true);

  const player = manager.get(created.gameId).players.get(joined.playerId);
  assert.equal(player.socket, replacement);
  assert.equal(player.connected, true);
  assert.deepEqual(original.data, {});
  // This is the same identity check used by the disconnect handler: a late close
  // from the old socket must not detach the replacement session.
  assert.notEqual(player.socket, original);
});

test('replays join and recovery credentials only for their saved request IDs', () => {
  const manager = createManager();
  const created = createGame(manager);
  const joined = manager.join({ pin: created.pin, nickname: 'Ada', joinRequestId: 'join-ada' });
  const joinReplay = manager.join({ pin: created.pin, nickname: 'Ada', joinRequestId: 'join-ada' });
  assert.deepEqual(joinReplay, joined);

  const recoveredSocket = socket('recovered');
  const recovered = manager.recover({ pin: created.pin, nickname: 'Ada', recoveryCode: joined.data.recoveryCode, recoveryRequestId: 'recover-ada' }, recoveredSocket);
  const recoveryReplay = manager.recover({ pin: created.pin, nickname: ' Ada ', recoveryCode: 'not-needed-for-the-retry', recoveryRequestId: 'recover-ada' }, socket('recovered-retry'));
  assert.equal(recovered.ok, true);
  assert.deepEqual(recoveryReplay.data, recovered.data);
  assert.equal(manager.resume({ gameId: created.gameId, pin: created.pin, playerId: joined.data.playerId, resumeToken: joined.data.resumeToken }, socket('old-token')).error, 'BAD_RESUME_TOKEN');
  assert.equal(manager.resume({ gameId: created.gameId, pin: created.pin, playerId: joined.data.playerId, resumeToken: recovered.data.resumeToken }, socket('new-token')).ok, true);
});

test('reconciles an acknowledgement-lost answer from an authenticated snapshot', () => {
  const manager = createManager();
  const created = createGame(manager);
  const host = socket('host');
  const joined = manager.join({ pin: created.pin, nickname: 'Ada', joinRequestId: 'join-ada' }).data;
  const player = socket('player');
  manager.attachHost(created.gameId, host);
  manager.attachPlayer(created.gameId, joined.playerId, player);
  assert.equal(manager.command(host, 'host:start', { gameId: created.gameId, requestId: 'start', expectedStateVersion: 0 }).ok, true);

  // Simulate a server-accepted answer whose Socket.IO acknowledgement never reaches the browser.
  assert.equal(manager.answer(player, { gameId: created.gameId, questionIndex: 0, optionIndex: 2, clientRequestId: 'answer-ada' }).data.status, 'accepted');
  const resynced = manager.resync(player, { gameId: created.gameId });
  assert.equal(resynced.ok, true);
  assert.equal(resynced.data.state, 'QUESTION');
  assert.equal(resynced.data.data.ownAnswer, 2);
});

test('emits complete role snapshots after state transitions', () => {
  const events = [];
  const manager = createManager({ onEvent: (event) => events.push(event) });
  const created = createGame(manager);
  const host = socket('host');
  const joined = manager.join({ pin: created.pin, nickname: 'Ada', joinRequestId: 'join-ada' }).data;
  const player = socket('player');
  manager.attachHost(created.gameId, host);
  manager.attachPlayer(created.gameId, joined.playerId, player);

  assert.equal(manager.command(host, 'host:start', { gameId: created.gameId, requestId: 'start', expectedStateVersion: 0 }).ok, true);
  const questionSnapshot = events.find((event) => event.scope === 'socket' && event.event === 'game:snapshot' && event.socket === player && event.view.state === 'QUESTION');
  assert.equal(questionSnapshot.view.data.eligible, true);
  assert.equal(questionSnapshot.view.data.ownAnswer, null);

  manager.reveal(created.gameId, 0);
  const hostReveal = events.find((event) => event.scope === 'socket' && event.event === 'game:snapshot' && event.socket === host && event.view.state === 'REVEAL');
  const playerReveal = events.find((event) => event.scope === 'socket' && event.event === 'game:snapshot' && event.socket === player && event.view.state === 'REVEAL');
  assert.equal(typeof hostReveal.view.data.progress.answeredCount, 'number');
  assert.equal(typeof playerReveal.view.data.ownResult.score, 'number');
});

test('retains terminal player views until expiry and excludes credentials from public or exported data', () => {
  let now = 1_000;
  const events = [];
  const manager = createManager({ now: () => now, onEvent: (event) => events.push(event) });
  const created = createGame(manager);
  const host = socket('host');
  const ada = manager.join({ pin: created.pin, nickname: 'Ada', joinRequestId: 'join-ada' }).data;
  const ben = manager.join({ pin: created.pin, nickname: 'Ben', joinRequestId: 'join-ben' }).data;
  const adaSocket = socket('ada');
  manager.attachHost(created.gameId, host);
  manager.attachPlayer(created.gameId, ada.playerId, adaSocket);
  assert.equal(manager.command(host, 'host:start', { gameId: created.gameId, requestId: 'start', expectedStateVersion: 0 }).ok, true);

  const publicQuestion = events.find((event) => event.event === 'game:question').view;
  const benView = manager.playerSnapshot(manager.get(created.gameId), manager.get(created.gameId).players.get(ben.playerId));
  const exported = manager.exportView(manager.get(created.gameId));
  for (const view of [publicQuestion, benView, exported]) {
    const serialized = JSON.stringify(view);
    assert.equal(serialized.includes(ada.resumeToken), false);
    assert.equal(serialized.includes(ada.recoveryCode), false);
    assert.equal(serialized.includes(ben.resumeToken), false);
    assert.equal(serialized.includes(ben.recoveryCode), false);
  }

  manager.reveal(created.gameId, 0);
  assert.equal(manager.command(host, 'host:next', { gameId: created.gameId, requestId: 'leaderboard', expectedStateVersion: 2 }).ok, true);
  assert.equal(manager.command(host, 'host:next', { gameId: created.gameId, requestId: 'podium', expectedStateVersion: 3 }).ok, true);
  const resumed = manager.resume({ gameId: created.gameId, pin: created.pin, playerId: ada.playerId, resumeToken: ada.resumeToken }, socket('ada-after-podium'));
  assert.equal(resumed.ok, true);
  assert.equal(resumed.data.state, 'PODIUM');

  manager.end(manager.get(created.gameId), 'ended');
  now += 30 * 60 * 1_000;
  manager.purgeExpired();
  assert.equal(manager.get(created.gameId), undefined);
});
