import assert from 'node:assert/strict';
import test from 'node:test';

import { GameManager } from '../game.js';
import { handleHostCreate, handleQuizCreate } from '../index.js';

const quiz = {
  id: 'unit-quiz', title: 'Unit quiz', questions: [{
    text: 'Pick A', options: ['A', 'B', 'C', 'D'], correct: 0, timeLimitSeconds: 5, points: 1000,
  }],
};

function manager() {
  return new GameManager({ quizzes: new Map([[quiz.id, quiz]]), now: () => 1_000, randomBytes: (size) => Buffer.alloc(size, 7) });
}

test('creates isolated games and gives a join retry the original credentials', () => {
  const games = manager();
  const first = games.create('unit-quiz');
  const second = games.create('unit-quiz');
  assert.notEqual(first.gameId, second.gameId);
  assert.notEqual(first.pin, second.pin);

  const joined = games.join({ pin: first.pin, nickname: ' Ada  Lovelace ', joinRequestId: 'join-1' });
  assert.equal(joined.ok, true);
  const replay = games.join({ pin: first.pin, nickname: 'Ada Lovelace', joinRequestId: 'join-1' });
  assert.deepEqual(replay, joined);
  assert.equal(games.join({ pin: second.pin, nickname: 'Ada Lovelace', joinRequestId: 'join-2' }).ok, true);
});

test('generates a memorable two-word recovery code', () => {
  const games = manager();
  const created = games.create('unit-quiz');
  const joined = games.join({ pin: created.pin, nickname: 'Ada', joinRequestId: 'join-code' });
  assert.equal(joined.ok, true);
  const words = joined.data.recoveryCode.split('-');
  assert.equal(words.length, 2);
  assert.ok(words.every((word) => /^[a-z]+$/.test(word)));
  assert.ok(words.every((word) => word.length >= 4));
});

test('authorizes transitions by current host and expected state version', () => {
  const games = manager();
  const created = games.create('unit-quiz');
  const host = { id: 'host-1' };
  games.attachHost(created.gameId, host);
  assert.equal(games.command(host, 'host:start', { gameId: created.gameId, requestId: 'start', expectedStateVersion: 0 }).ok, true);
  assert.equal(games.command(host, 'host:next', { gameId: created.gameId, requestId: 'late', expectedStateVersion: 0 }).error, 'STALE_COMMAND');
  assert.equal(games.command({ id: 'intruder' }, 'host:abort', { gameId: created.gameId, requestId: 'abort', expectedStateVersion: 1 }).error, 'UNAUTHORIZED');
  assert.equal(games.command(host, 'host:start', undefined).error, 'BAD_PAYLOAD');
});

test('accepts only the eligible player first answer before deadline', () => {
  let now = 1_000;
  const games = new GameManager({ quizzes: new Map([[quiz.id, quiz]]), now: () => now, randomBytes: (size) => Buffer.alloc(size, 9) });
  const created = games.create('unit-quiz');
  const host = { id: 'host' };
  games.attachHost(created.gameId, host);
  const joined = games.join({ pin: created.pin, nickname: 'Ada', joinRequestId: 'join' }).data;
  const player = { id: 'player' };
  games.attachPlayer(created.gameId, joined.playerId, player);
  games.command(host, 'host:start', { gameId: created.gameId, requestId: 'start', expectedStateVersion: 0 });
  const accepted = games.answer(player, { gameId: created.gameId, questionIndex: 0, optionIndex: 0, clientRequestId: 'answer' });
  assert.equal(accepted.data.status, 'accepted');
  assert.equal(games.answer(player, undefined).error, 'BAD_PAYLOAD');
  assert.equal(games.answer(player, { gameId: created.gameId, questionIndex: 0, optionIndex: 1, clientRequestId: 'other' }).data.status, 'already-accepted');
  now = 6_000;
  assert.equal(games.answer(player, { gameId: created.gameId, questionIndex: 0, optionIndex: 0, clientRequestId: 'late' }).error, 'NOT_ACCEPTING_ANSWERS');
});

test('throttles repeated bad recovery codes and resets after its bounded window', () => {
  let now = 1_000;
  const games = new GameManager({ quizzes: new Map([[quiz.id, quiz]]), now: () => now, randomBytes: (size) => Buffer.alloc(size, 3) });
  const created = games.create('unit-quiz');
  const joined = games.join({ pin: created.pin, nickname: 'Ada', joinRequestId: 'join' }).data;
  const socket = { id: 'recovering-tab', data: {} };
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal(games.recover({ pin: created.pin, nickname: 'Ada', recoveryCode: 'wrong-code', recoveryRequestId: `bad-${attempt}` }, socket).error, 'BAD_RECOVERY_CODE');
  assert.equal(games.recover({ pin: created.pin, nickname: 'Ada', recoveryCode: 'wrong-code', recoveryRequestId: 'blocked' }, socket).error, 'THROTTLED');
  now += 60_001;
  assert.equal(games.recover({ pin: created.pin, nickname: 'Ada', recoveryCode: joined.recoveryCode, recoveryRequestId: 'good' }, socket).ok, true);
});

test('replays a matching host create request without making another game', () => {
  const games = manager();
  const cache = new Map();
  const socket = { id: 'host-tab', data: {}, handshake: { headers: { host: 'quiz.test' } }, join() {} };
  const payload = { quizId: 'unit-quiz', hostSecret: 'test-secret', requestId: 'create-1' };
  const first = handleHostCreate({ manager: games, cache, socket, payload, configuredHostSecret: 'test-secret', requestOrigin: 'https://quiz.test' });
  assert.equal(first.ok, true);
  const replay = handleHostCreate({ manager: games, cache, socket, payload, configuredHostSecret: 'test-secret', requestOrigin: 'https://quiz.test' });
  assert.deepEqual(replay, first);
  assert.equal(games.games.size, 1);
  assert.equal(handleHostCreate({ manager: games, cache, socket, payload: { ...payload, quizId: 'other' }, configuredHostSecret: 'test-secret', requestOrigin: 'https://quiz.test' }).error, 'BAD_PAYLOAD');
});

test('accepts a host-authenticated quiz draft and rejects duplicate ids', () => {
  const quizzes = new Map();
  const draft = {
    id: 'seminar-practice',
    title: 'Seminar practice',
    questions: [{ text: 'Pick A', options: ['A', 'B', 'C', 'D'], correct: 0, timeLimitSeconds: 15, points: 1000 }],
  };
  assert.deepEqual(handleQuizCreate({ quizzes, quiz: draft, hostSecret: 'secret', configuredHostSecret: 'secret' }), {
    ok: true,
    data: { id: draft.id, title: draft.title, questionCount: 1 },
  });
  assert.equal(quizzes.get(draft.id), draft);
  assert.equal(handleQuizCreate({ quizzes, quiz: draft, hostSecret: 'secret', configuredHostSecret: 'secret' }).error, 'QUIZ_EXISTS');
  assert.equal(handleQuizCreate({ quizzes, quiz: { ...draft, id: 'other-quiz' }, hostSecret: 'wrong', configuredHostSecret: 'secret' }).error, 'BAD_SECRET');
});
