import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { failure, validateQuiz } from '../shared/contracts.js';
import { GameManager } from './game.js';
import { consumeDownloadToken, issueDownloadToken, writeResults } from './results.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(path = resolve(root, '.env')) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/gu, '');
  }
}

async function loadQuizzes(directory = resolve(root, 'server/quizzes')) {
  const quizzes = new Map();
  for (const filename of await readdir(directory)) {
    if (!filename.endsWith('.json')) continue;
    const quiz = JSON.parse(await readFile(resolve(directory, filename), 'utf8'));
    if (!validateQuiz(quiz).valid) throw new Error(`Invalid quiz file: ${filename}`);
    quizzes.set(quiz.id, quiz);
  }
  return quizzes;
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const acknowledge = (callback, response) => { if (typeof callback === 'function') callback(response); };
const HOST_CREATE_CACHE_MS = 30 * 60 * 1000;

export function handleQuizCreate({ quizzes, quiz, hostSecret, configuredHostSecret }) {
  if (typeof hostSecret !== 'string' || hostSecret !== configuredHostSecret) return failure('BAD_SECRET');
  if (!isObject(quiz) || !validateQuiz(quiz).valid) return failure('BAD_PAYLOAD');
  if (quizzes.has(quiz.id)) return failure('QUIZ_EXISTS');
  quizzes.set(quiz.id, quiz);
  return { ok: true, data: { id: quiz.id, title: quiz.title, questionCount: quiz.questions.length } };
}

export function handleHostCreate({ manager, cache, socket, payload, configuredHostSecret, requestOrigin }) {
  if (!isObject(payload) || typeof payload.quizId !== 'string' || typeof payload.hostSecret !== 'string' || typeof payload.requestId !== 'string') return failure('BAD_PAYLOAD');
  if (payload.hostSecret !== configuredHostSecret) return failure('BAD_SECRET');
  const now = Date.now();
  for (const [requestId, entry] of cache) if (!entry.createdAtMs || now - entry.createdAtMs >= HOST_CREATE_CACHE_MS || !manager.get(entry.gameId)) cache.delete(requestId);
  const replay = cache.get(payload.requestId);
  if (replay) {
    if (replay.quizId !== payload.quizId) return failure('BAD_PAYLOAD');
    const game = manager.get(replay.gameId);
    if (!game) { cache.delete(payload.requestId); return failure('GAME_NOT_FOUND'); }
    if (socket.data?.role && (socket.data.role !== 'host' || socket.data.gameId !== game.gameId)) return failure('UNAUTHORIZED');
    if (!socket.data?.role) { manager.attachHost(game.gameId, socket); socket.join?.(`game:${game.gameId}`); }
    return replay.response;
  }
  if (socket.data?.role) return failure('UNAUTHORIZED');
  const created = manager.create(payload.quizId, requestOrigin);
  if (created.ok === false) return created;
  manager.attachHost(created.gameId, socket); socket.join?.(`game:${created.gameId}`);
  const response = { ok: true, data: { gameId: created.gameId, pin: created.pin, joinUrl: created.joinUrl, snapshot: manager.hostSnapshot(created.game) } };
  cache.set(payload.requestId, { quizId: payload.quizId, gameId: created.gameId, response, createdAtMs: now });
  return response;
}

export async function createLiveQuizServer({ port = Number.parseInt(process.env.PORT ?? '3000', 10), hostSecret = process.env.HOST_SECRET ?? 'change-me-before-production', publicUrl = process.env.PUBLIC_URL ?? '', resultsDir = process.env.RESULTS_DIR ?? resolve(root, 'server/results'), quizzes = null } = {}) {
  const loadedQuizzes = quizzes ?? await loadQuizzes();
  const app = express(); const httpServer = createServer(app);
  const hostCreateCache = new Map();
  let io;
  const manager = new GameManager({ quizzes: loadedQuizzes, resultsDir, writeResults, onEvent: ({ scope, game, socket, event, view }) => {
    if (scope === 'game') io.to(`game:${game.gameId}`).emit(event, view);
    else socket.emit(event, view);
  } });
  io = new SocketIOServer(httpServer, { serveClient: false, cors: { origin: true, credentials: true } });

  app.get('/healthz', (_request, response) => {
    const games = [...manager.games.values()];
    response.status(200).json({ ok: true, activeGames: games.filter((game) => game.state !== 'ENDED').length, retainedGames: games.filter((game) => game.state === 'ENDED').length });
  });
  app.use(express.json({ limit: '128kb' }));
  app.get('/api/quizzes', (_request, response) => response.json([...loadedQuizzes.values()].map(({ id, title, questions }) => ({ id, title, questionCount: questions.length }))));
  app.post('/api/quizzes', (request, response) => {
    const result = handleQuizCreate({ quizzes: loadedQuizzes, quiz: request.body?.quiz, hostSecret: request.get('x-host-secret'), configuredHostSecret: hostSecret });
    return response.status(result.ok ? 201 : result.error === 'QUIZ_EXISTS' ? 409 : result.error === 'BAD_SECRET' ? 401 : 400).json(result);
  });
  app.get('/api/games/:gameId/results/:filename', (request, response) => {
    const game = manager.get(request.params.gameId); const filename = request.params.filename; const token = typeof request.query.token === 'string' ? request.query.token : '';
    if (!game || !consumeDownloadToken(game, game.hostSocket?.id, filename, token)) return response.sendStatus(401);
    const fullPath = resolve(resultsDir, filename);
    if (!fullPath.startsWith(`${resolve(resultsDir)}/`) || !existsSync(fullPath)) return response.sendStatus(404);
    return response.download(fullPath, filename);
  });
  const dist = resolve(root, 'dist'); app.use(express.static(dist)); app.get(['/', '/play', '/host'], (_request, response) => response.sendFile(resolve(dist, 'index.html')));

  io.on('connection', (socket) => {
    const attached = () => Boolean(socket.data?.role);
    socket.on('host:create', (payload, callback) => {
      const requestOrigin = `${socket.handshake.headers['x-forwarded-proto'] ?? 'http'}://${socket.handshake.headers.host ?? `localhost:${port}`}`;
      return acknowledge(callback, handleHostCreate({ manager, cache: hostCreateCache, socket, payload, configuredHostSecret: hostSecret, requestOrigin: publicUrl || requestOrigin }));
    });
    socket.on('host:resume', (payload, callback) => {
      if (attached() || !isObject(payload) || typeof payload.gameId !== 'string' || typeof payload.pin !== 'string' || typeof payload.hostSecret !== 'string') return acknowledge(callback, failure('BAD_PAYLOAD'));
      const game = manager.get(payload.gameId); if (!game || game.pin !== payload.pin) return acknowledge(callback, failure('GAME_NOT_FOUND'));
      if (payload.hostSecret !== hostSecret) return acknowledge(callback, failure('BAD_SECRET'));
      const response = manager.attachHost(game.gameId, socket); socket.join(`game:${game.gameId}`); return acknowledge(callback, response);
    });
    socket.on('player:join', (payload, callback) => {
      if (attached() || !isObject(payload)) return acknowledge(callback, failure('BAD_PAYLOAD'));
      const response = manager.join(payload);
      if (response.ok) { const game = manager.get(response.data.gameId); manager.attachPlayer(game.gameId, response.data.playerId, socket); socket.join(`game:${game.gameId}`); response.data.snapshot = manager.playerSnapshot(game, game.players.get(response.data.playerId)); }
      return acknowledge(callback, response);
    });
    socket.on('player:resume', (payload, callback) => { if (attached() || !isObject(payload)) return acknowledge(callback, failure('BAD_PAYLOAD')); const response = manager.resume(payload, socket); if (response.ok) socket.join(`game:${payload.gameId}`); return acknowledge(callback, response); });
    socket.on('player:recover', (payload, callback) => { if (attached() || !isObject(payload)) return acknowledge(callback, failure('BAD_PAYLOAD')); const response = manager.recover(payload, socket); if (response.ok) socket.join(`game:${response.data.gameId}`); return acknowledge(callback, response); });
    for (const event of ['host:start', 'host:next', 'host:abort', 'host:end']) socket.on(event, (payload, callback) => acknowledge(callback, manager.command(socket, event, payload)));
    socket.on('player:answer', (payload, callback) => acknowledge(callback, manager.answer(socket, payload)));
    socket.on('game:resync', (payload, callback) => acknowledge(callback, isObject(payload) ? manager.resync(socket, payload) : failure('BAD_PAYLOAD')));
    socket.on('host:retry-export', (payload, callback) => {
      const game = manager.get(payload?.gameId); if (!game || game.hostSocket !== socket || !isObject(payload) || typeof payload.requestId !== 'string') return acknowledge(callback, failure('UNAUTHORIZED'));
      if (game.exportRequests.has(payload.requestId)) return acknowledge(callback, game.exportRequests.get(payload.requestId));
      if (game.exportStatus.status !== 'failed') return acknowledge(callback, failure('EXPORT_UNAVAILABLE'));
      game.exportStarted = false; manager.saveExport(game, game.reason === 'aborted' ? 'aborted' : 'completed'); const result = { ok: true, data: { exportStatus: game.exportStatus } }; game.exportRequests.set(payload.requestId, result); return acknowledge(callback, result);
    });
    socket.on('host:result-download', (payload, callback) => {
      const game = manager.get(payload?.gameId); if (!game || game.hostSocket !== socket || !isObject(payload) || typeof payload.requestId !== 'string') return acknowledge(callback, failure('UNAUTHORIZED'));
      if (game.exportRequests.has(payload.requestId)) return acknowledge(callback, game.exportRequests.get(payload.requestId));
      if (game.exportStatus.status !== 'saved') return acknowledge(callback, failure('EXPORT_UNAVAILABLE'));
      const issued = issueDownloadToken(game, socket, game.exportStatus.filename); if (!issued) return acknowledge(callback, failure('EXPORT_UNAVAILABLE'));
      const result = { ok: true, data: { exportStatus: game.exportStatus, downloadUrl: issued.url } }; game.exportRequests.set(payload.requestId, result); return acknowledge(callback, result);
    });
    socket.on('disconnect', () => {
      if (socket.data?.role !== 'player') return;
      const game = manager.get(socket.data.gameId); const player = game?.players.get(socket.data.playerId);
      if (player?.socket === socket) { player.connected = false; player.socket = null; manager.emitCount(game); }
    });
  });
  return { app, io, httpServer, manager, listen: () => new Promise((resolveListen) => httpServer.listen(port, resolveListen)), close: () => new Promise((resolveClose) => io.close(() => httpServer.close(resolveClose))) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadEnv(); const secret = process.env.HOST_SECRET ?? '';
  if (process.env.NODE_ENV === 'production' && (!secret || secret === 'change-me-before-production')) throw new Error('HOST_SECRET must be configured in production');
  createLiveQuizServer({ hostSecret: secret || 'change-me-before-production' }).then(async (live) => { await live.listen(); console.log(`Live Quiz listening on http://localhost:${process.env.PORT ?? '3000'}`); });
}
