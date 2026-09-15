import { CONTRACT_FIXTURES } from './fixtures/contract-fixtures.js';

export { CONTRACT_FIXTURES };

export const GAME_STATES = Object.freeze(['LOBBY', 'QUESTION', 'REVEAL', 'LEADERBOARD', 'PODIUM', 'ENDED']);
export const ERROR_CODES = Object.freeze([
  'BAD_PAYLOAD', 'GAME_NOT_FOUND', 'GAME_FULL', 'GAME_ENDED', 'NICKNAME_TAKEN', 'NICKNAME_INVALID',
  'BAD_RESUME_TOKEN', 'BAD_RECOVERY_CODE', 'UNAUTHORIZED', 'BAD_SECRET', 'QUIZ_NOT_FOUND',
  'INVALID_TRANSITION', 'STALE_COMMAND', 'NOT_ACCEPTING_ANSWERS', 'ALREADY_ANSWERED',
  'INVALID_OPTION', 'NOT_ELIGIBLE', 'THROTTLED', 'EXPORT_UNAVAILABLE', 'SERVER_CAPACITY', 'QUIZ_EXISTS',
]);

export const EVENT_ENVELOPE_FIELDS = Object.freeze(['gameId', 'state', 'stateVersion', 'revision', 'serverNowMs', 'data']);
export const acknowledgement = (data) => ({ ok: true, data });
export const failure = (error) => ({ ok: false, error });

export const quizSchema = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object', additionalProperties: false,
  required: ['id', 'title', 'questions'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,63}$' },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    questions: {
      type: 'array', minItems: 1, maxItems: 50,
      items: {
        type: 'object', additionalProperties: false,
        required: ['text', 'options', 'correct', 'timeLimitSeconds', 'points'],
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 200 },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string', minLength: 1, maxLength: 80 } },
          correct: { type: 'integer', minimum: 0, maximum: 3 },
          timeLimitSeconds: { type: 'integer', minimum: 5, maximum: 120 },
          points: { type: 'integer', minimum: 100, maximum: 2000 },
          explanation: { type: 'string', minLength: 1, maxLength: 200 },
        },
      },
    },
  },
});

function errorsForQuiz(quiz) {
  const errors = [];
  const text = (value, min, max) => typeof value === 'string' && [...value].length >= min && [...value].length <= max;
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  if (!quiz || typeof quiz !== 'object' || Array.isArray(quiz)) return ['quiz must be an object'];
  if (!text(quiz.id, 1, 64) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(quiz.id)) errors.push('id');
  if (!text(quiz.title, 1, 200)) errors.push('title');
  if (!Array.isArray(quiz.questions) || quiz.questions.length < 1 || quiz.questions.length > 50) errors.push('questions');
  for (const [index, question] of (quiz.questions ?? []).entries()) {
    if (!question || typeof question !== 'object') { errors.push(`questions[${index}]`); continue; }
    if (!text(question.text, 1, 200)) errors.push(`questions[${index}].text`);
    if (!Array.isArray(question.options) || question.options.length !== 4 || !question.options.every((option) => text(option, 1, 80))) errors.push(`questions[${index}].options`);
    if (!integer(question.correct, 0, 3)) errors.push(`questions[${index}].correct`);
    if (!integer(question.timeLimitSeconds, 5, 120)) errors.push(`questions[${index}].timeLimitSeconds`);
    if (!integer(question.points, 100, 2000)) errors.push(`questions[${index}].points`);
    if (question.explanation !== undefined && !text(question.explanation, 1, 200)) errors.push(`questions[${index}].explanation`);
    if (Object.keys(question).some((key) => !['text', 'options', 'correct', 'timeLimitSeconds', 'points', 'explanation'].includes(key))) errors.push(`questions[${index}].additionalProperties`);
  }
  if (Object.keys(quiz).some((key) => !['id', 'title', 'questions'].includes(key))) errors.push('additionalProperties');
  return errors;
}

export function validateQuiz(quiz) {
  const errors = errorsForQuiz(quiz);
  return { valid: errors.length === 0, errors };
}

export function normalizeNickname(nickname) {
  return nickname.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

export function validateEventEnvelope(view) {
  const errors = [];
  if (!view || typeof view !== 'object') return { valid: false, errors: ['view must be an object'] };
  if (typeof view.gameId !== 'string' || !view.gameId) errors.push('gameId');
  if (!GAME_STATES.includes(view.state)) errors.push('state');
  for (const field of ['stateVersion', 'revision', 'serverNowMs']) if (!Number.isInteger(view[field]) || view[field] < 0) errors.push(field);
  if (!Object.hasOwn(view, 'data') || !view.data || typeof view.data !== 'object') errors.push('data');
  return { valid: errors.length === 0, errors };
}

export function shouldApplyView(current, incoming, { snapshot = false } = {}) {
  if (!current) return true;
  if (current.gameId !== incoming.gameId) return false;
  return snapshot || incoming.revision > current.revision;
}

const forbiddenBeforeReveal = new Set(['correctOptionIndex', 'correct', 'explanation', 'resumeToken', 'recoveryCode', 'hostSecret']);
function containsForbidden(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => forbiddenBeforeReveal.has(key) || containsForbidden(child));
}

export function validateContractFixture(fixture) {
  const errors = [];
  if (!fixture?.name) return { valid: false, errors: ['name'] };
  if (fixture.kind === 'snapshot') {
    const result = validateEventEnvelope(fixture.view);
    errors.push(...result.errors);
    if (!['host', 'player'].includes(fixture.role)) errors.push('role');
    if (fixture.view?.state === 'QUESTION' && containsForbidden(fixture.view.data)) errors.push('unrevealed credential or correction');
  } else if (fixture.kind === 'revision-sequence') {
    if (fixture.revisions?.[1] <= fixture.revisions?.[0] || fixture.stateVersions?.[1] !== fixture.stateVersions?.[0] || !fixture.privateAfterCommon) errors.push('revision ordering');
  } else if (fixture.kind === 'command') {
    if (fixture.response?.error !== 'STALE_COMMAND') errors.push('stale command');
  } else if (fixture.kind === 'retry') {
    if (!fixture.replayReturnsOriginalCredential) errors.push('retry outcome');
  } else errors.push('kind');
  return { valid: errors.length === 0, errors };
}
