import assert from 'node:assert/strict';
import test from 'node:test';

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLeaderboard, rankOf, scoreAnswer } from '../scoring.js';
import { writeResults } from '../results.js';

test('scores correct responses according to the contract timing formula', () => {
  assert.equal(scoreAnswer({ correct: true, points: 1000, timeLimitSeconds: 20, responseMs: 0 }), 1000);
  assert.equal(scoreAnswer({ correct: true, points: 1000, timeLimitSeconds: 20, responseMs: 500 }), 1000);
  assert.equal(scoreAnswer({ correct: true, points: 1000, timeLimitSeconds: 20, responseMs: 10_000 }), 750);
  assert.equal(scoreAnswer({ correct: true, points: 1000, timeLimitSeconds: 20, responseMs: 99_999 }), 500);
  assert.equal(scoreAnswer({ correct: false, points: 1000, timeLimitSeconds: 20, responseMs: 0 }), 0);
});

test('uses score, response time, then normalized nickname for stable ranks', () => {
  const table = buildLeaderboard([
    { playerId: 'slow', nickname: 'Zed', normalizedNickname: 'zed', score: 100, correctResponseMsTotal: 30, delta: 2 },
    { playerId: 'fast', nickname: 'Ada', normalizedNickname: 'ada', score: 100, correctResponseMsTotal: 20, delta: 3 },
    { playerId: 'name', nickname: 'Bob', normalizedNickname: 'bob', score: 100, correctResponseMsTotal: 20, delta: 4 },
  ]);
  assert.deepEqual(table.map((entry) => entry.playerId), ['fast', 'name', 'slow']);
  assert.equal(rankOf('name', table), 2);
});

test('writes an Excel-safe CSV and sanitized JSON export', async () => {
  const resultsDir = await mkdtemp(join(tmpdir(), 'live-quiz-results-'));
  const result = await writeResults({
    gameId: 'game-1', pin: '123456', startedAtMs: 1_000, endedAtMs: 2_000, startedAtMsByQuestion: [1_000],
    quiz: { id: 'unit-quiz', title: 'A unit quiz', questions: [{}] },
    players: [{ playerId: 'p1', nickname: 'Ada, "Ace"', score: 1000, rank: 1, correctCount: 1, answers: [{ questionIndex: 0, optionIndex: 0, correct: true, receivedAtMs: 1_500 }] }],
  }, { status: 'completed', resultsDir, now: () => 1_000 });
  assert.equal(result.status, 'saved');
  assert.match(await readFile(join(resultsDir, result.filename), 'utf8'), /^\uFEFFrank,nickname,score,correct_count,q1_answer,q1_correct,q1_ms\n1,"Ada, ""Ace""",1000,1,0,true,500/m);
  const json = JSON.parse(await readFile(join(resultsDir, result.jsonFilename), 'utf8'));
  assert.deepEqual(Object.keys(json).sort(), ['endedAtMs', 'gameId', 'pin', 'players', 'quiz', 'startedAtMs', 'status', 'version']);
});
