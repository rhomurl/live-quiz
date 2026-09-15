import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function manilaStamp(ms) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

function safeName(value) {
  return /^[a-z0-9][a-z0-9-]{0,63}$/u.test(value) ? value : null;
}

export async function writeResults(view, { status, resultsDir = resolve('server/results'), now = Date.now } = {}) {
  const quizId = safeName(view.quiz.id);
  if (!quizId || !/^\d{6}$/u.test(view.pin)) return { status: 'failed', message: 'Invalid export metadata' };
  const stamp = manilaStamp(now());
  const stem = `${quizId}-${stamp}-${view.pin}`;
  const filename = `${stem}.csv`;
  const jsonFilename = `${stem}.json`;
  const columns = ['rank', 'nickname', 'score', 'correct_count'];
  for (let index = 0; index < view.quiz.questions.length; index += 1) columns.push(`q${index + 1}_answer`, `q${index + 1}_correct`, `q${index + 1}_ms`);
  const rows = view.players.map((player) => {
    const row = [player.rank, player.nickname, player.score, player.correctCount];
    for (const answer of player.answers) row.push(answer.optionIndex ?? '', answer.correct ?? '', answer.receivedAtMs == null ? '' : answer.receivedAtMs - view.startedAtMsByQuestion[answer.questionIndex]);
    return row.map(csvCell).join(',');
  });
  const json = {
    version: 1, quiz: { id: view.quiz.id, title: view.quiz.title }, gameId: view.gameId, pin: view.pin, status,
    startedAtMs: view.startedAtMs, endedAtMs: view.endedAtMs, players: view.players,
  };
  try {
    await mkdir(resultsDir, { recursive: true });
    const directory = resolve(resultsDir);
    const csvPath = resolve(directory, filename);
    const jsonPath = resolve(directory, jsonFilename);
    if (!csvPath.startsWith(`${directory}/`) || !jsonPath.startsWith(`${directory}/`)) throw new Error('Invalid path');
    await writeFile(`${csvPath}.tmp`, `\uFEFF${columns.join(',')}\n${rows.join('\n')}\n`, 'utf8');
    await rename(`${csvPath}.tmp`, csvPath);
    await writeFile(`${jsonPath}.tmp`, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
    await rename(`${jsonPath}.tmp`, jsonPath);
    return { status: 'saved', filename, jsonFilename };
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : 'Results write failed' };
  }
}

export function issueDownloadToken(game, currentHostSocket, filename, { now = Date.now } = {}) {
  if (!game || game.hostSocket !== currentHostSocket || !game.exportStatus?.filename || game.exportStatus.filename !== filename) return null;
  const token = randomBytes(32).toString('base64url');
  const expiresAtMs = now() + 5 * 60 * 1000;
  game.downloadTokens.set(token, { socketId: currentHostSocket.id, filename, expiresAtMs });
  return { url: `/api/games/${encodeURIComponent(game.gameId)}/results/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`, expiresAtMs };
}

export function consumeDownloadToken(game, socketId, filename, token, { now = Date.now } = {}) {
  const entry = game?.downloadTokens.get(token);
  if (!entry || entry.socketId !== socketId || entry.filename !== filename || entry.expiresAtMs <= now()) return false;
  game.downloadTokens.delete(token);
  return true;
}

export async function cleanupResults(resultsDir, { now = Date.now, maxAgeMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  const directory = resolve(resultsDir); let removed = 0;
  try {
    for (const filename of await readdir(directory)) {
      const path = resolve(directory, filename);
      if (!path.startsWith(`${directory}/`)) continue;
      const details = await stat(path);
      if (details.isFile() && now() - details.mtimeMs > maxAgeMs) { await rm(path); removed += 1; }
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return { removed, directory: basename(directory) };
}
