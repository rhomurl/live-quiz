#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const schema = {
  type: 'object',
  required: ['id', 'title', 'questions'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9-]+$' },
    title: { type: 'string', minLength: 1 },
    questions: { type: 'array', minItems: 1, maxItems: 50 }
  }
};

function fail(message) { throw new Error(message); }
function string(value, name, min, max) {
  if (typeof value !== 'string' || value.length < min || value.length > max) fail(`${name} must be a string of ${min}-${max} characters`);
}
function integer(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${name} must be an integer from ${min} to ${max}`);
}

function validateQuiz(quiz, filename) {
  if (!quiz || typeof quiz !== 'object' || Array.isArray(quiz)) fail('root must be an object');
  for (const key of schema.required) if (!(key in quiz)) fail(`missing required property: ${key}`);
  for (const key of Object.keys(quiz)) if (!['id', 'title', 'questions'].includes(key)) fail(`unexpected root property: ${key}`);
  string(quiz.id, 'id', 1, 80);
  if (!/^[a-z0-9-]+$/.test(quiz.id)) fail('id may contain only lowercase letters, digits, and hyphens');
  if (filename && filename !== `${quiz.id}.json` && !filename.endsWith(`/${quiz.id}.json`)) fail(`id ${quiz.id} does not match filename ${filename}`);
  string(quiz.title, 'title', 1, 200);
  if (!Array.isArray(quiz.questions) || quiz.questions.length < 1 || quiz.questions.length > 50) fail('questions must contain 1-50 items');
  quiz.questions.forEach((question, index) => {
    const p = `questions[${index}]`;
    if (!question || typeof question !== 'object' || Array.isArray(question)) fail(`${p} must be an object`);
    for (const key of ['text', 'options', 'correct', 'timeLimitSeconds', 'points']) if (!(key in question)) fail(`${p} missing required property: ${key}`);
    for (const key of Object.keys(question)) if (!['text', 'options', 'correct', 'timeLimitSeconds', 'points', 'explanation'].includes(key)) fail(`${p} unexpected property: ${key}`);
    string(question.text, `${p}.text`, 1, 200);
    if (!Array.isArray(question.options) || question.options.length !== 4) fail(`${p}.options must contain exactly 4 items`);
    question.options.forEach((option, optionIndex) => string(option, `${p}.options[${optionIndex}]`, 1, 80));
    integer(question.correct, `${p}.correct`, 0, 3);
    integer(question.timeLimitSeconds, `${p}.timeLimitSeconds`, 5, 120);
    integer(question.points, `${p}.points`, 100, 2000);
    if ('explanation' in question) string(question.explanation, `${p}.explanation`, 1, 200);
  });
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: node scripts/validate-quiz.js <quiz.json> [...quiz.json]');
  process.exit(2);
}
let failed = false;
for (const path of paths) {
  try {
    const quiz = JSON.parse(await readFile(path, 'utf8'));
    validateQuiz(quiz, path);
    console.log(`Valid quiz: ${path} (${quiz.questions.length} questions)`);
  } catch (error) {
    failed = true;
    console.error(`Invalid quiz: ${path}: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
