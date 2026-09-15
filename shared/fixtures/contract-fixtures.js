const question = {
  index: 0,
  total: 1,
  text: 'Which option is correct?',
  options: ['A', 'B', 'C', 'D'],
  timeLimitSeconds: 20,
  startsAtMs: 1_700_000_000_000,
  endsAtMs: 1_700_000_020_000,
};

const reveal = {
  index: 0,
  correctOptionIndex: 0,
  distribution: [1, 0, 0, 0],
  answeredCount: 1,
  explanation: 'A is the sample answer.',
};

const standing = { score: 1000, rank: 1 };
const leaderboard = { questionIndex: 0, top: [{ nickname: 'Ada', score: 1000, delta: 1000, rank: 1 }] };
const podium = { top3: [{ nickname: 'Ada', score: 1000, rank: 1 }] };
const exportStatus = { status: 'saved', filename: 'contract-sample.csv' };

function snapshot(role, state, revision, data) {
  return {
    kind: 'snapshot',
    role,
    view: { gameId: 'game-contract', state, stateVersion: state === 'LOBBY' ? 0 : 1, revision, serverNowMs: 1_700_000_000_000, data },
  };
}

export const CONTRACT_FIXTURES = [
  { name: 'host zero-player lobby', ...snapshot('host', 'LOBBY', 1, { pin: '123456', joinUrl: 'https://quiz.example/?pin=123456', players: [], connectedCount: 0, totalCount: 0 }) },
  { name: 'player zero-player lobby', ...snapshot('player', 'LOBBY', 1, { nickname: 'Ada', connectedCount: 0, totalCount: 0 }) },
  { name: 'host question', ...snapshot('host', 'QUESTION', 2, { question, progress: { eligibleCount: 1, answeredCount: 0 } }) },
  { name: 'late question observer has no correction', ...snapshot('player', 'QUESTION', 2, { question, eligible: false, ownAnswer: null }) },
  { name: 'host reveal', ...snapshot('host', 'REVEAL', 3, { reveal, progress: { eligibleCount: 1, answeredCount: 1 } }) },
  { name: 'player reveal', ...snapshot('player', 'REVEAL', 4, { reveal, ownResult: { questionIndex: 0, correct: true, pointsEarned: 1000, score: 1000, rank: 1 } }) },
  { name: 'host leaderboard', ...snapshot('host', 'LEADERBOARD', 5, { leaderboard }) },
  { name: 'player leaderboard', ...snapshot('player', 'LEADERBOARD', 5, { leaderboard, own: standing }) },
  { name: 'host podium', ...snapshot('host', 'PODIUM', 6, { podium, exportStatus }) },
  { name: 'player podium', ...snapshot('player', 'PODIUM', 6, { podium, own: standing }) },
  { name: 'host ended', ...snapshot('host', 'ENDED', 7, { reason: 'completed', podium, exportStatus }) },
  { name: 'player ended', ...snapshot('player', 'ENDED', 7, { reason: 'completed', own: standing, exportStatus: 'saved' }) },
  { name: 'same-state question progress revision', kind: 'revision-sequence', state: 'QUESTION', revisions: [10, 11], stateVersions: [4, 4], privateAfterCommon: true },
  { name: 'same-state reveal result revision', kind: 'revision-sequence', state: 'REVEAL', revisions: [12, 13], stateVersions: [5, 5], privateAfterCommon: true },
  { name: 'stale state-version command', kind: 'command', request: { gameId: 'game-contract', requestId: 'request-1', expectedStateVersion: 2 }, response: { ok: false, error: 'STALE_COMMAND' } },
  { name: 'join acknowledgement retry', kind: 'retry', event: 'player:join', requestId: 'join-request-1', replayReturnsOriginalCredential: true },
  { name: 'recovery acknowledgement retry', kind: 'retry', event: 'player:recover', requestId: 'recovery-request-1', replayReturnsOriginalCredential: true },
  { name: 'answer acknowledgement loss', kind: 'retry', event: 'player:answer', requestId: 'answer-request-1', replayReturnsOriginalCredential: true, response: { status: 'already-accepted', optionIndex: 0 } },
];
