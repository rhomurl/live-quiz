import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTRACT_FIXTURES,
  GAME_STATES,
  quizSchema,
  shouldApplyView,
  validateContractFixture,
  validateQuiz,
} from '../../shared/contracts.js';

test('exports the six game states and validates every contract fixture', () => {
  assert.deepEqual(GAME_STATES, ['LOBBY', 'QUESTION', 'REVEAL', 'LEADERBOARD', 'PODIUM', 'ENDED']);

  for (const fixture of CONTRACT_FIXTURES) {
    assert.deepEqual(validateContractFixture(fixture), { valid: true, errors: [] }, fixture.name);
  }
});

test('only accepts a newer view for the current game, except snapshots which replace', () => {
  assert.equal(shouldApplyView({ gameId: 'game-1', revision: 4 }, { gameId: 'game-1', revision: 5 }), true);
  assert.equal(shouldApplyView({ gameId: 'game-1', revision: 5 }, { gameId: 'game-1', revision: 5 }), false);
  assert.equal(shouldApplyView({ gameId: 'game-1', revision: 5 }, { gameId: 'game-2', revision: 9 }), false);
  assert.equal(shouldApplyView({ gameId: 'game-1', revision: 9 }, { gameId: 'game-1', revision: 1 }, { snapshot: true }), true);
});

test('accepts the contract quiz and rejects malformed quiz data through its JSON schema contract', () => {
  const validQuiz = {
    id: 'contract-sample',
    title: 'Contract Sample',
    questions: [{
      text: 'Which option is correct?',
      options: ['A', 'B', 'C', 'D'],
      correct: 0,
      timeLimitSeconds: 20,
      points: 1000,
      explanation: 'A is the sample answer.',
    }],
  };

  assert.equal(quizSchema.type, 'object');
  assert.deepEqual(validateQuiz(validQuiz), { valid: true, errors: [] });
  assert.equal(validateQuiz({ ...validQuiz, questions: [] }).valid, false);
  assert.equal(validateQuiz({ ...validQuiz, questions: [{ ...validQuiz.questions[0], options: ['A', 'B', 'C'] }] }).valid, false);
});
