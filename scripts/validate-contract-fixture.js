import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { CONTRACT_FIXTURES, quizSchema, validateContractFixture } from '../shared/contracts.js';

const root = new URL('../', import.meta.url);
const samplePath = new URL('server/quizzes/_contract-sample.json', root);
const malformedPath = new URL('shared/fixtures/malformed-quiz.json', root);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateQuiz = ajv.compile(quizSchema);

async function readJson(url) {
  return JSON.parse(await readFile(fileURLToPath(url), 'utf8'));
}

const sample = await readJson(samplePath);
const malformed = await readJson(malformedPath);
const invalidFixtures = CONTRACT_FIXTURES.filter((fixture) => !validateContractFixture(fixture).valid);

if (!validateQuiz(sample)) throw new Error(`Contract sample failed JSON Schema validation: ${ajv.errorsText(validateQuiz.errors)}`);
if (validateQuiz(malformed)) throw new Error('Malformed fixture unexpectedly passed JSON Schema validation');
if (invalidFixtures.length) throw new Error(`Invalid contract fixtures: ${invalidFixtures.map((fixture) => fixture.name).join(', ')}`);

console.log(`Validated ${CONTRACT_FIXTURES.length} contract fixtures, the sample quiz, and one malformed quiz fixture.`);
