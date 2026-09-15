import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLiveQuizServer } from '../server/index.js';
import { issueDownloadToken } from '../server/results.js';

const temporaryResults = await mkdtemp(join(tmpdir(), 'live-quiz-smoke-'));
const live = await createLiveQuizServer({ port: 0, hostSecret: 'smoke-secret', resultsDir: temporaryResults });
await live.listen();

function fakeSocket(id) { return { id, data: {}, emit() {} }; }
function expectOk(response, label) { assert.equal(response?.ok, true, `${label}: ${response?.error ?? 'missing acknowledgement'}`); return response.data; }

async function play(game, host, players) {
  live.manager.attachHost(game.gameId, host);
  for (const player of players) live.manager.attachPlayer(game.gameId, player.identity.playerId, player.socket);
  let version = 0;
  expectOk(live.manager.command(host, 'host:start', { gameId: game.gameId, requestId: 'start', expectedStateVersion: version++ }), 'start');
  for (let index = 0; index < game.game.quiz.questions.length; index += 1) {
    for (const [playerIndex, player] of players.entries()) expectOk(live.manager.answer(player.socket, { gameId: game.gameId, questionIndex: index, optionIndex: playerIndex % 2, clientRequestId: `answer-${index}` }), 'answer');
    live.manager.reveal(game.gameId, index); version += 1;
    expectOk(live.manager.command(host, 'host:next', { gameId: game.gameId, requestId: `reveal-${index}`, expectedStateVersion: version++ }), 'reveal next');
    expectOk(live.manager.command(host, 'host:next', { gameId: game.gameId, requestId: `leaderboard-${index}`, expectedStateVersion: version++ }), 'leaderboard next');
  }
  const deadline = Date.now() + 2_000;
  while (live.manager.get(game.gameId).exportStatus.status === 'pending' && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  const result = live.manager.get(game.gameId); assert.equal(result.state, 'PODIUM'); assert.equal(result.exportStatus.status, 'saved');
  const ticket = issueDownloadToken(result, host, result.exportStatus.filename); assert.ok(ticket);
  const port = live.httpServer.address().port;
  const downloaded = await fetch(`http://127.0.0.1:${port}${ticket.url}`);
  assert.equal(downloaded.status, 200, 'authorized results download');
  assert.match(await downloaded.text(), /rank,nickname,score/u);
  assert.equal((await fetch(`http://127.0.0.1:${port}${ticket.url}`)).status, 401, 'download token is one-time');
  return live.manager.leaderboard(result).map(({ nickname, score, rank }) => ({ nickname, score, rank }));
}

try {
  const first = live.manager.create('sample-test'); const second = live.manager.create('sample-test');
  assert.notEqual(first.pin, second.pin, 'games must not share a PIN');
  const firstPlayers = ['Ada', 'Ben', 'Cy'].map((nickname, index) => ({ identity: expectOk(live.manager.join({ pin: first.pin, nickname, joinRequestId: `first-${index}` }), 'join'), socket: fakeSocket(`first-${index}`) }));
  const secondPlayer = { identity: expectOk(live.manager.join({ pin: second.pin, nickname: 'Dee', joinRequestId: 'second-0' }), 'isolated join'), socket: fakeSocket('second-0') };
  const board = await play(first, fakeSocket('host-first'), firstPlayers);
  assert.equal(live.manager.get(second.gameId).players.size, 1, 'second game remains isolated');
  console.log(JSON.stringify({ ok: true, gameId: first.gameId, leaderboard: board }));
} finally {
  await live.close();
  await rm(temporaryResults, { recursive: true, force: true });
}
