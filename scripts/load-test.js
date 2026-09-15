import { performance } from 'node:perf_hooks';
import { io } from 'socket.io-client';

const target = Number.parseInt(process.argv[2] ?? '50', 10);
const baseUrl = process.env.LIVE_QUIZ_URL;
const hostSecret = process.env.HOST_SECRET;

if (!baseUrl || !hostSecret || !Number.isInteger(target) || target < 1 || target > 50) {
  console.error('Usage: LIVE_QUIZ_URL=https://quiz.example HOST_SECRET=… node scripts/load-test.js [1-50]');
  process.exitCode = 2;
} else {
  await run();
}

async function run() {
  const sockets = new Set();
  const failures = [];
  const answerLatencies = [];
  const joinLatencies = [];
  const sensitiveKeys = new Set(['resumeToken', 'recoveryCode', 'hostSecret']);
  const leakEvents = new Set(['game:question', 'game:reveal', 'game:leaderboard', 'game:podium', 'game:ended', 'game:player-count', 'game:snapshot', 'host:lobby', 'host:progress', 'host:export-status', 'player:result']);

  const percentile = (values, fraction) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
  };
  const containsSecret = (value) => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(containsSecret);
    return Object.entries(value).some(([key, child]) => sensitiveKeys.has(key) || containsSecret(child));
  };
  const connect = () => new Promise((resolve, reject) => {
    const client = io(baseUrl, { transports: ['websocket'], reconnection: false, timeout: 5_000 });
    const timeout = setTimeout(() => reject(new Error('Socket connection timed out')), 6_000);
    client.once('connect', () => { clearTimeout(timeout); sockets.add(client); resolve(client); });
    client.once('connect_error', (error) => { clearTimeout(timeout); reject(error); });
    client.on('error', (error) => failures.push(`socket error: ${error?.message ?? String(error)}`));
    for (const event of leakEvents) client.on(event, (view) => {
      if (containsSecret(view)) failures.push(`credential leaked in ${event}`);
    });
  });
  const ack = (client, event, payload) => new Promise((resolve, reject) => {
    client.timeout(5_000).emit(event, payload, (error, response) => {
      if (error) return reject(new Error(`${event}: acknowledgement timeout`));
      if (!response?.ok) return reject(new Error(`${event}: ${response?.error ?? 'invalid response'}`));
      return resolve(response.data);
    });
  });

  try {
    const host = await connect();
    const created = await ack(host, 'host:create', { quizId: 'sample-test', hostSecret, requestId: `load-create-${Date.now()}` });
    const players = await Promise.all([...Array(target)].map(async (_, index) => {
      const client = await connect();
      const started = performance.now();
      const identity = await ack(client, 'player:join', { pin: created.pin, nickname: `Load${index + 1}`, joinRequestId: `load-join-${index + 1}-${Date.now()}` });
      joinLatencies.push(performance.now() - started);
      return { client, identity };
    }));

    const reconnectCount = Math.floor(target * 0.1);
    await Promise.all(players.slice(0, reconnectCount).map(async (player) => {
      player.client.disconnect(); sockets.delete(player.client);
      const replacement = await connect();
      await ack(replacement, 'player:resume', { gameId: player.identity.gameId, pin: created.pin, playerId: player.identity.playerId, resumeToken: player.identity.resumeToken });
      player.client = replacement;
    }));

    await ack(host, 'host:start', { gameId: created.gameId, requestId: `load-start-${Date.now()}`, expectedStateVersion: 0 });
    await Promise.all(players.map(async (player, index) => {
      const started = performance.now();
      await ack(player.client, 'player:answer', { gameId: created.gameId, questionIndex: 0, optionIndex: index % 4, clientRequestId: `load-answer-${index}-${Date.now()}` });
      answerLatencies.push(performance.now() - started);
    }));

    const result = {
      target,
      joined: joinLatencies.length,
      reconnected: reconnectCount,
      joinMs: { p50: percentile(joinLatencies, 0.5), p95: percentile(joinLatencies, 0.95) },
      answerAckMs: { p50: percentile(answerLatencies, 0.5), p95: percentile(answerLatencies, 0.95) },
      unexpectedErrors: failures,
    };
    console.log(JSON.stringify(result, null, 2));
    if (result.joined !== target || failures.length || result.answerAckMs.p95 >= 500) {
      throw new Error('Load-test acceptance criteria failed');
    }
  } catch (error) {
    failures.push(error?.message ?? String(error));
    console.error(JSON.stringify({ target, unexpectedErrors: failures }, null, 2));
    process.exitCode = 1;
  } finally {
    for (const client of sockets) client.disconnect();
  }
}
