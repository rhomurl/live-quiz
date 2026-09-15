import { createCipheriv, createDecipheriv, createHash, randomBytes as cryptoRandomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeNickname } from '../shared/contracts.js';
import { buildLeaderboard, rankOf, scoreAnswer } from './scoring.js';

const ACTIVE_STATES = new Set(['LOBBY', 'QUESTION', 'REVEAL', 'LEADERBOARD', 'PODIUM']);
const MAX_PLAYERS = 50;
const RECOVERY_ADJECTIVES = Object.freeze([
  'amber', 'ancient', 'autumn', 'brave', 'bright', 'calm', 'cedar', 'clever',
  'cloudy', 'cobalt', 'cosmic', 'crimson', 'curious', 'daring', 'dawn', 'deep',
  'dizzy', 'eager', 'early', 'emerald', 'famous', 'gentle', 'golden', 'happy',
  'hidden', 'honest', 'icy', 'jolly', 'kind', 'lively', 'lucky', 'mellow',
  'mighty', 'misty', 'modern', 'neat', 'nimble', 'noble', 'peaceful', 'proud',
  'quiet', 'rapid', 'ready', 'royal', 'rustic', 'sandy', 'scarlet',
  'shiny', 'silent', 'sleepy', 'solar', 'sparkly', 'steady', 'sunny', 'swift',
  'tidy', 'tranquil', 'vivid', 'warm', 'wise', 'wooden', 'young', 'zesty',
].map((word) => word.trim()));
const RECOVERY_NOUNS = Object.freeze([
  'apple', 'arrow', 'beacon', 'berry', 'bird', 'blanket', 'breeze', 'bridge',
  'candle', 'canyon', 'castle', 'cedar', 'circle', 'comet', 'coral', 'corner',
  'crystal', 'deer', 'dolphin', 'dream', 'eagle', 'ember', 'falcon', 'feather',
  'forest', 'garden', 'harbor', 'horizon', 'island', 'jungle', 'lantern', 'maple',
  'meadow', 'meteor', 'moon', 'mountain', 'ocean', 'orchid', 'pebble', 'planet',
  'pocket', 'prairie', 'rabbit', 'rainbow', 'river', 'rocket', 'sailboat', 'shadow',
  'shell', 'shore', 'signal', 'star', 'sunset', 'thunder', 'tiger', 'valley',
  'violet', 'willow', 'window', 'winter', 'wizard', 'woodland', 'zephyr', 'zinnia',
].map((word) => word.trim()));

const ok = (data) => ({ ok: true, data });
const fail = (error) => ({ ok: false, error });
const hash = (value) => createHash('sha256').update(value).digest();
const sameHash = (a, b) => a?.length === b.length && timingSafeEqual(a, b);

function nickname(raw) {
  if (typeof raw !== 'string') return null;
  const display = raw.trim().replace(/\s+/gu, ' ');
  if ([...display].length < 2 || [...display].length > 16 || !/^[\p{L}\p{N}_ ]+$/u.test(display)) return null;
  return { display, normalized: normalizeNickname(display) };
}

export class GameManager {
  constructor({ quizzes = new Map(), now = Date.now, randomBytes = cryptoRandomBytes, onEvent = null, writeResults = null, resultsDir, publicUrl = '' } = {}) {
    this.quizzes = quizzes; this.now = now; this.randomBytes = randomBytes; this.onEvent = onEvent; this.writeResults = writeResults; this.resultsDir = resultsDir;
    this.games = new Map(); this.pinIndex = new Map(); this.counter = 0; this.publicUrl = publicUrl; this.provisioningKey = this.randomBytes(32);
  }

  opaque(bytes = 18) { return `${this.randomBytes(bytes).toString('base64url')}${(++this.counter).toString(36)}`; }
  recoveryCode() {
    const entropy = this.randomBytes(8);
    const first = entropy.readUInt32BE(0) % RECOVERY_ADJECTIVES.length;
    const second = entropy.readUInt32BE(4) % RECOVERY_NOUNS.length;
    return `${RECOVERY_ADJECTIVES[first]}-${RECOVERY_NOUNS[second]}`;
  }
  cacheProvision(game, requestId, response) {
    const iv = this.randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.provisioningKey, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(response), 'utf8'), cipher.final()]);
    game.provisioning.set(requestId, { iv, tag: cipher.getAuthTag(), ciphertext });
  }
  readProvision(game, requestId) {
    const entry = game.provisioning.get(requestId); if (!entry) return null;
    try { const decipher = createDecipheriv('aes-256-gcm', this.provisioningKey, entry.iv); decipher.setAuthTag(entry.tag); return JSON.parse(Buffer.concat([decipher.update(entry.ciphertext), decipher.final()]).toString('utf8')); } catch { return null; }
  }
  create(quizId, publicUrl = this.publicUrl) {
    this.purgeExpired();
    const quiz = this.quizzes.get(quizId);
    if (!quiz) return fail('QUIZ_NOT_FOUND');
    if ([...this.games.values()].filter((game) => ACTIVE_STATES.has(game.state) && game.state !== 'ENDED').length >= 5) return fail('SERVER_CAPACITY');
    const gameId = this.opaque();
    let pin;
    do { pin = String((Number.parseInt(this.randomBytes(4).toString('hex'), 16) + this.counter) % 1_000_000).padStart(6, '0'); } while (this.pinIndex.has(pin));
    const game = {
      gameId, pin, quiz, joinUrl: this.joinUrl(pin, publicUrl), state: 'LOBBY', stateVersion: 0, revision: 0, questionIndex: -1, players: new Map(),
      hostSocket: null, hostRequests: new Map(), joinOperations: new Map(), recoveryOperations: new Map(), recoveryAttempts: new Map(), provisioning: new Map(),
      eligible: new Set(), timer: null, startedAtMs: this.now(), endsAtMs: null, endedAtMs: null, reason: null,
      exportStatus: { status: 'pending' }, downloadTokens: new Map(), exportStarted: false, exportRequests: new Map(), purgeTimer: null,
    };
    this.games.set(gameId, game); this.pinIndex.set(pin, gameId);
    this.evictRetained();
    return { gameId, pin, joinUrl: game.joinUrl, game };
  }

  joinUrl(pin, baseUrl = '') { return `${String(baseUrl).replace(/\/$/u, '')}/?pin=${encodeURIComponent(pin)}`; }

  gameByPin(pin) { return this.games.get(this.pinIndex.get(String(pin))); }
  get(gameId) { return this.games.get(gameId); }
  attachHost(gameId, socket) {
    const game = this.get(gameId); if (!game) return fail('GAME_NOT_FOUND');
    if (game.hostSocket && game.hostSocket !== socket) game.hostSocket.data = {};
    game.hostSocket = socket; socket.data = { role: 'host', gameId };
    return ok(this.hostSnapshot(game));
  }
  attachPlayer(gameId, playerId, socket) {
    const game = this.get(gameId); const player = game?.players.get(playerId);
    if (!player) return fail('BAD_RESUME_TOKEN');
    if (player.socket && player.socket !== socket) player.socket.data = {};
    player.socket = socket; player.connected = true; socket.data = { role: 'player', gameId, playerId };
    return ok(this.playerSnapshot(game, player));
  }
  join({ pin, nickname: rawNickname, joinRequestId }) {
    const game = this.gameByPin(pin);
    if (!game) return fail('GAME_NOT_FOUND');
    if (game.state === 'PODIUM' || game.state === 'ENDED') return fail('GAME_ENDED');
    const name = nickname(rawNickname); if (!name) return fail('NICKNAME_INVALID');
    if (typeof joinRequestId !== 'string' || joinRequestId.length < 1 || joinRequestId.length > 200) return fail('BAD_PAYLOAD');
    const replay = game.joinOperations.get(joinRequestId);
    if (replay) return replay.normalized === name.normalized ? this.readProvision(game, joinRequestId) ?? fail('BAD_PAYLOAD') : fail('BAD_PAYLOAD');
    if ([...game.players.values()].some((player) => player.normalizedNickname === name.normalized)) return fail('NICKNAME_TAKEN');
    if (game.players.size >= MAX_PLAYERS) return fail('GAME_FULL');
    const playerId = this.opaque(); const resumeToken = this.opaque(32); const recoveryCode = this.recoveryCode();
    const player = { playerId, nickname: name.display, normalizedNickname: name.normalized, resumeHash: hash(resumeToken), recoveryHash: hash(recoveryCode), socket: null, connected: false, answers: new Map(), score: 0, delta: 0, correctResponseMsTotal: 0, correctCount: 0 };
    game.players.set(playerId, player);
    const response = ok({ gameId: game.gameId, playerId, resumeToken, recoveryCode, snapshot: this.playerSnapshot(game, player) });
    game.joinOperations.set(joinRequestId, { normalized: name.normalized, playerId }); this.cacheProvision(game, joinRequestId, response);
    this.emitCount(game); return response;
  }
  resume({ gameId, pin, playerId, resumeToken }, socket) {
    const game = this.get(gameId); if (!game || game.pin !== String(pin)) return fail('GAME_NOT_FOUND');
    const player = game.players.get(playerId); if (!player || typeof resumeToken !== 'string' || !sameHash(player.resumeHash, hash(resumeToken))) return fail('BAD_RESUME_TOKEN');
    return this.attachPlayer(gameId, playerId, socket);
  }
  recover({ pin, nickname: rawNickname, recoveryCode, recoveryRequestId }, socket) {
    const game = this.gameByPin(pin); if (!game) return fail('GAME_NOT_FOUND');
    const name = nickname(rawNickname); if (!name || typeof recoveryCode !== 'string' || typeof recoveryRequestId !== 'string') return fail('BAD_PAYLOAD');
    if (this.recoveryThrottled(game, socket)) return fail('THROTTLED');
    const replay = game.recoveryOperations.get(recoveryRequestId);
    if (replay) { if (replay.normalized !== name.normalized) return fail('BAD_PAYLOAD'); const response = this.readProvision(game, recoveryRequestId); if (!response) return fail('BAD_PAYLOAD'); this.attachPlayer(game.gameId, replay.playerId, socket); return response; }
    const player = [...game.players.values()].find((entry) => entry.normalizedNickname === name.normalized);
    if (!player || !sameHash(player.recoveryHash, hash(recoveryCode))) { this.recordRecoveryFailure(game, socket); return fail('BAD_RECOVERY_CODE'); }
    const resumeToken = this.opaque(32); player.resumeHash = hash(resumeToken); this.attachPlayer(game.gameId, player.playerId, socket);
    const response = ok({ gameId: game.gameId, playerId: player.playerId, resumeToken, snapshot: this.playerSnapshot(game, player) });
    game.recoveryOperations.set(recoveryRequestId, { normalized: name.normalized, playerId: player.playerId }); this.cacheProvision(game, recoveryRequestId, response); game.recoveryAttempts.delete(this.recoveryKey(socket));
    return response;
  }
  recoveryKey(socket) { return socket?.id ?? 'unidentified'; }
  recoveryThrottled(game, socket) { const entry = game.recoveryAttempts.get(this.recoveryKey(socket)); if (!entry) return false; if (this.now() - entry.windowStartedAtMs >= 60_000) { game.recoveryAttempts.delete(this.recoveryKey(socket)); return false; } return entry.failures >= 5; }
  recordRecoveryFailure(game, socket) { const key = this.recoveryKey(socket); const entry = game.recoveryAttempts.get(key); if (!entry || this.now() - entry.windowStartedAtMs >= 60_000) game.recoveryAttempts.set(key, { windowStartedAtMs: this.now(), failures: 1 }); else entry.failures += 1; }
  resync(socket, { gameId }) {
    const game = this.get(gameId); if (!game || socket.data?.gameId !== gameId) return fail('UNAUTHORIZED');
    return socket.data.role === 'host' && game.hostSocket === socket ? ok(this.hostSnapshot(game)) : socket.data.role === 'player' ? ok(this.playerSnapshot(game, game.players.get(socket.data.playerId))) : fail('UNAUTHORIZED');
  }
  command(socket, event, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !['host:start', 'host:next', 'host:abort', 'host:end'].includes(event) || typeof payload.requestId !== 'string' || !Number.isInteger(payload.expectedStateVersion)) return fail('BAD_PAYLOAD');
    const game = this.get(payload.gameId); if (!game || socket.data?.gameId !== payload.gameId || game.hostSocket !== socket) return fail('UNAUTHORIZED');
    const replay = game.hostRequests.get(payload.requestId); if (replay) return replay;
    if (payload.expectedStateVersion !== game.stateVersion) return fail('STALE_COMMAND');
    let response;
    if (event === 'host:start' && game.state === 'LOBBY') { this.startQuestion(game, 0); response = ok({ snapshot: this.hostSnapshot(game) }); }
    else if (event === 'host:next' && game.state === 'REVEAL') { this.transition(game, 'LEADERBOARD'); this.emitState(game, 'game:leaderboard'); this.emitAuthenticatedSnapshots(game); response = ok({ snapshot: this.hostSnapshot(game) }); }
    else if (event === 'host:next' && game.state === 'LEADERBOARD') { if (game.questionIndex + 1 < game.quiz.questions.length) this.startQuestion(game, game.questionIndex + 1); else this.enterPodium(game); response = ok({ snapshot: this.hostSnapshot(game) }); }
    else if (event === 'host:abort' && game.state !== 'ENDED') { this.end(game, 'aborted'); response = ok({ snapshot: this.hostSnapshot(game) }); }
    else if (event === 'host:end' && game.state === 'PODIUM') { this.end(game, 'ended'); response = ok({ snapshot: this.hostSnapshot(game) }); }
    else response = fail('INVALID_TRANSITION');
    game.hostRequests.set(payload.requestId, response); return response;
  }
  answer(socket, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Number.isInteger(payload.questionIndex) || !Number.isInteger(payload.optionIndex) || typeof payload.clientRequestId !== 'string') return fail('BAD_PAYLOAD');
    const game = this.get(payload.gameId); if (!game || socket.data?.role !== 'player' || socket.data.gameId !== payload.gameId) return fail('UNAUTHORIZED');
    const player = game.players.get(socket.data.playerId); if (!player || player.socket !== socket) return fail('UNAUTHORIZED');
    if (game.state !== 'QUESTION' || payload.questionIndex !== game.questionIndex || this.now() >= game.endsAtMs) return fail('NOT_ACCEPTING_ANSWERS');
    if (!game.eligible.has(player.playerId)) return fail('NOT_ELIGIBLE');
    const previous = player.answers.get(game.questionIndex);
    if (previous) return ok({ status: 'already-accepted', optionIndex: previous.optionIndex, receivedAtMs: previous.receivedAtMs, revision: game.revision });
    if (payload.optionIndex < 0 || payload.optionIndex > 3) return fail('INVALID_OPTION');
    const receivedAtMs = this.now(); player.answers.set(game.questionIndex, { optionIndex: payload.optionIndex, receivedAtMs, clientRequestId: payload.clientRequestId });
    this.emitProgress(game); return ok({ status: 'accepted', optionIndex: payload.optionIndex, receivedAtMs, revision: game.revision });
  }
  startQuestion(game, index) {
    this.clearTimer(game); game.questionIndex = index; game.eligible = new Set(game.players.keys()); game.eligibleAtQuestion = new Set(game.eligible);
    game.questionStarts ??= []; game.questionStarts[index] = this.now(); game.endsAtMs = this.now() + game.quiz.questions[index].timeLimitSeconds * 1000;
    this.transition(game, 'QUESTION'); this.emitState(game, 'game:question'); this.emitProgress(game); this.emitAuthenticatedSnapshots(game);
    game.timer = setTimeout(() => this.reveal(game.gameId, index), Math.max(0, game.endsAtMs - this.now())); game.timer.unref?.();
  }
  reveal(gameId, index) {
    const game = this.get(gameId); if (!game || game.state !== 'QUESTION' || game.questionIndex !== index) return;
    this.clearTimer(game); this.scoreQuestion(game); this.transition(game, 'REVEAL'); this.emitState(game, 'game:reveal');
    for (const player of game.players.values()) if (player.socket) this.emitPrivate(game, player.socket, 'player:result', this.playerResult(game, player));
    this.emitAuthenticatedSnapshots(game);
  }
  scoreQuestion(game) {
    const question = game.quiz.questions[game.questionIndex];
    for (const player of game.players.values()) {
      player.delta = 0; const answer = player.answers.get(game.questionIndex);
      if (!game.eligible.has(player.playerId) || !answer) continue;
      const correct = answer.optionIndex === question.correct; const responseMs = answer.receivedAtMs - game.questionStarts[game.questionIndex];
      const earned = scoreAnswer({ correct, points: question.points, timeLimitSeconds: question.timeLimitSeconds, responseMs });
      Object.assign(answer, { correct, responseMs, pointsEarned: earned }); player.delta = earned; player.score += earned;
      if (correct) { player.correctCount += 1; player.correctResponseMsTotal += responseMs; }
    }
  }
  enterPodium(game) {
    this.transition(game, 'PODIUM'); this.emitState(game, 'game:podium'); this.emitAuthenticatedSnapshots(game); this.saveExport(game, 'completed');
    game.timer = setTimeout(() => this.end(game, 'ended'), 30 * 60 * 1000); game.timer.unref?.();
  }
  end(game, reason) {
    this.clearTimer(game); if (game.state === 'QUESTION') this.scoreQuestion(game); this.transition(game, 'ENDED'); game.reason = reason; game.endedAtMs = this.now(); this.emitState(game, 'game:ended'); this.emitAuthenticatedSnapshots(game);
    if (reason === 'aborted') this.saveExport(game, 'aborted');
    game.purgeTimer = setTimeout(() => this.purge(game), 30 * 60 * 1000); game.purgeTimer.unref?.(); this.evictRetained();
  }
  saveExport(game, status) {
    if (game.exportStarted || !this.writeResults) return; game.exportStarted = true; game.exportStatus = { status: 'pending' }; this.emitHost(game, 'host:export-status', game.exportStatus);
    Promise.resolve(this.writeResults(this.exportView(game), { status, resultsDir: this.resultsDir })).then((result) => { game.exportStatus = result; this.emitHost(game, 'host:export-status', result); }).catch(() => { game.exportStatus = { status: 'failed', message: 'Results write failed' }; this.emitHost(game, 'host:export-status', game.exportStatus); });
  }
  exportView(game) {
    const board = this.leaderboard(game); const rank = new Map(board.map((entry) => [entry.playerId, entry.rank]));
    return { gameId: game.gameId, pin: game.pin, quiz: game.quiz, startedAtMs: game.startedAtMs, endedAtMs: game.endedAtMs ?? this.now(), startedAtMsByQuestion: game.questionStarts ?? [], players: [...game.players.values()].map((player) => ({ playerId: player.playerId, nickname: player.nickname, score: player.score, rank: rank.get(player.playerId) ?? 0, correctCount: player.correctCount, answers: game.quiz.questions.map((_, questionIndex) => { const answer = player.answers.get(questionIndex); return { questionIndex, optionIndex: answer?.optionIndex, correct: answer?.correct, receivedAtMs: answer?.receivedAtMs, pointsEarned: answer?.pointsEarned }; }) })) };
  }
  purgeExpired() { for (const game of this.games.values()) if (game.state === 'ENDED' && game.endedAtMs && this.now() - game.endedAtMs >= 30 * 60 * 1000) this.purge(game); }
  evictRetained() { const retained = [...this.games.values()].filter((game) => game.state === 'ENDED').sort((a, b) => a.endedAtMs - b.endedAtMs); while (retained.length > 10) this.purge(retained.shift()); }
  purge(game) { this.clearTimer(game); if (game.purgeTimer) clearTimeout(game.purgeTimer); this.games.delete(game.gameId); this.pinIndex.delete(game.pin); }
  transition(game, state) { this.clearTimer(game); game.state = state; game.stateVersion += 1; }
  clearTimer(game) { if (game.timer) clearTimeout(game.timer); game.timer = null; }
  envelope(game, data) { return { gameId: game.gameId, state: game.state, stateVersion: game.stateVersion, revision: ++game.revision, serverNowMs: this.now(), data }; }
  questionView(game) { const question = game.quiz.questions[game.questionIndex]; return { index: game.questionIndex, total: game.quiz.questions.length, text: question.text, options: question.options, timeLimitSeconds: question.timeLimitSeconds, startsAtMs: game.questionStarts[game.questionIndex], endsAtMs: game.endsAtMs }; }
  leaderboard(game) { return buildLeaderboard([...game.players.values()]); }
  revealView(game) { const question = game.quiz.questions[game.questionIndex]; const distribution = [0, 0, 0, 0]; let answeredCount = 0; for (const player of game.players.values()) { const answer = player.answers.get(game.questionIndex); if (game.eligible.has(player.playerId) && answer) { distribution[answer.optionIndex] += 1; answeredCount += 1; } } return { index: game.questionIndex, correctOptionIndex: question.correct, distribution, answeredCount, ...(question.explanation ? { explanation: question.explanation } : {}) }; }
  playerResult(game, player) { const answer = player.answers.get(game.questionIndex); return { questionIndex: game.questionIndex, correct: Boolean(answer?.correct), pointsEarned: answer?.pointsEarned ?? 0, score: player.score, rank: rankOf(player.playerId, this.leaderboard(game)) }; }
  podium(game) { return { top3: this.leaderboard(game).slice(0, 3).map(({ nickname, score, rank }) => ({ nickname, score, rank })) }; }
  hostSnapshot(game) { const base = game.state === 'LOBBY' ? { pin: game.pin, joinUrl: game.joinUrl, players: [...game.players.values()].map(({ playerId, nickname, connected }) => ({ playerId, nickname, connected })), connectedCount: [...game.players.values()].filter((p) => p.connected).length, totalCount: game.players.size } : game.state === 'QUESTION' ? { question: this.questionView(game), progress: this.progress(game) } : game.state === 'REVEAL' ? { reveal: this.revealView(game), progress: this.progress(game) } : game.state === 'LEADERBOARD' ? { leaderboard: { questionIndex: game.questionIndex, top: this.leaderboard(game).slice(0, 10) } } : game.state === 'PODIUM' ? { podium: this.podium(game), exportStatus: game.exportStatus } : { reason: game.reason, podium: this.podium(game), exportStatus: game.exportStatus }; return this.envelope(game, base); }
  playerSnapshot(game, player) { if (!player) return null; const count = { connectedCount: [...game.players.values()].filter((p) => p.connected).length, totalCount: game.players.size }; const base = game.state === 'LOBBY' ? { nickname: player.nickname, ...count } : game.state === 'QUESTION' ? { question: this.questionView(game), eligible: game.eligible.has(player.playerId), ownAnswer: player.answers.get(game.questionIndex)?.optionIndex ?? null } : game.state === 'REVEAL' ? { reveal: this.revealView(game), ownResult: this.playerResult(game, player) } : game.state === 'LEADERBOARD' ? { leaderboard: { questionIndex: game.questionIndex, top: this.leaderboard(game).slice(0, 10) }, own: this.playerStanding(game, player) } : game.state === 'PODIUM' ? { podium: this.podium(game), own: this.playerStanding(game, player) } : { reason: game.reason, own: this.playerStanding(game, player), exportStatus: game.exportStatus.status }; return this.envelope(game, base); }
  playerStanding(game, player) { return { score: player.score, rank: rankOf(player.playerId, this.leaderboard(game)) }; }
  progress(game) { return { eligibleCount: game.eligible.size, answeredCount: [...game.players.values()].filter((p) => game.eligible.has(p.playerId) && p.answers.has(game.questionIndex)).length }; }
  emitState(game, event) { const data = event === 'game:question' ? { question: this.questionView(game) } : event === 'game:reveal' ? { reveal: this.revealView(game) } : event === 'game:leaderboard' ? { leaderboard: { questionIndex: game.questionIndex, top: this.leaderboard(game).slice(0, 10) } } : event === 'game:podium' ? { podium: this.podium(game), exportStatus: game.exportStatus } : { reason: game.reason, exportStatus: game.exportStatus }; this.onEvent?.({ scope: 'game', game, event, view: this.envelope(game, data) }); }
  emitHost(game, event, data) { if (game.hostSocket) this.onEvent?.({ scope: 'socket', socket: game.hostSocket, event, view: this.envelope(game, data) }); }
  emitPrivate(game, socket, event, data) { this.onEvent?.({ scope: 'socket', socket, event, view: this.envelope(game, data) }); }
  emitAuthenticatedSnapshots(game) {
    if (game.hostSocket) this.emitSnapshot(game, game.hostSocket, this.hostSnapshot(game));
    for (const player of game.players.values()) if (player.socket) this.emitSnapshot(game, player.socket, this.playerSnapshot(game, player));
  }
  emitSnapshot(game, socket, view) { this.onEvent?.({ scope: 'socket', socket, event: 'game:snapshot', view }); }
  emitProgress(game) { this.emitHost(game, 'host:progress', this.progress(game)); }
  emitCount(game) { this.onEvent?.({ scope: 'game', game, event: 'game:player-count', view: this.envelope(game, { connectedCount: [...game.players.values()].filter((p) => p.connected).length, totalCount: game.players.size }) }); }
}
