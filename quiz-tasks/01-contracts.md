# Task 01 — Contract, Bootstrap, and Integration Gate

**Blocking task.** Finish and verify this task before releasing any feature branch.

**Owns until handoff:** root setup; `package.json`; lockfile; `.gitignore`; `.env.example`; `README.md`; `AGENTS.md`; `shared/contracts.js`; `shared/fixtures/**`; `server/quizzes/_contract-sample.json`; `scripts/validate-contract-fixture.js`; a minimal `server/index.js`; minimal `client/index.html`, `client/src/main.jsx`, and `client/src/App.jsx`; test setup; and this document. Task 02 takes `server/index.js` and Task 04 takes client entry files after this gate.

The scaffold serves a placeholder page and `/healthz`; it has no live game behavior. It exists only to prove the Node/Vite/shared-module boundary, not to pre-implement Tasks 02 or 04.

## Contract-wide rules

- Use Node.js 24 LTS, ESM, Express, Socket.IO 4, React 18, Vite, plain CSS, JSON quiz files, and one Node process.
- Timestamps are epoch milliseconds and use `*AtMs`; durations use `*Seconds` or `*Ms`.
- The server alone decides deadline, eligibility, answer acceptance, correctness, scoring, state transitions, and export status. Clients render server views.
- `stateVersion` increments exactly once per state transition and protects host transition commands. `revision` increments for every emitted game/host/player view update and prevents clients from applying stale updates. A client applies a message only when its `gameId` matches and `revision` is greater than the last applied revision; snapshots always replace current state.
- Every server-to-client event has this envelope: `{ gameId, state, stateVersion, revision, serverNowMs, data }`. The server emits the common room event first and then any private player event with a higher revision. `game:snapshot` is a complete replacement view, not a partial patch.
- A connected, unattached socket may call only initial create, join, resume, recover, and protocol-safe error routes. After authentication, host commands require the current host role; player commands require the attached player identity.
- A host secret may exist only in the host create form and that browser tab's `sessionStorage`. It must never enter player state, build-time client constants, a URL, an export, analytics, or logs.
- Do not serialize an internal Game, quiz, `Map`, socket, token, code, or secret. Construct every emitted view from an explicit allowlist.

## Identity and retry rules

Initial join is PIN plus nickname. Before emitting, the client generates and saves a random `joinRequestId` in tab session storage. Repeating `player:join` with the same valid PIN, normalized nickname, and `joinRequestId` returns the original credential outcome. Recovery likewise has a saved `recoveryRequestId`; repeating the same valid recovery operation returns its original replacement-token outcome. The server retains these operation outcomes for the game retention window.

The server creates an opaque random `playerId` and `resumeToken`, plus a memorable recovery code made from exactly two lowercase words joined by one hyphen (for example, `amber-canyon`). Store the resume token with the player session; show the recovery code once with a copy action and tell the participant to save it. The recovery code is a persistent, rate-limited secret, valid only until the game is purged; store its long-lived record as a hash. A short-lived encrypted in-memory provisioning cache, keyed by the join/recovery request ID, holds the raw credential response only so an acknowledgement retry can return the same code or replacement token. Delete that cache with the game. A successful recovery revokes the prior resume token and issues a new resume token; it does not rotate the recovery code. A valid resume or recovery atomically replaces the old socket; the old socket's later disconnect must not change the replacement's state.

Nickname normalization is `trim` then collapse internal whitespace to one space then lowercase for uniqueness. Display the trimmed original casing. Names must be 2–16 Unicode code points after trimming and match letters, digits, spaces, or underscores. They are unique by normalized form within a game and always render as text, never HTML.

## State machine

```text
LOBBY --host:start--> QUESTION
QUESTION --server deadline--> REVEAL
REVEAL --host:next--> LEADERBOARD
LEADERBOARD --host:next--> QUESTION | PODIUM
PODIUM --host:end--> ENDED
LOBBY|QUESTION|REVEAL|LEADERBOARD|PODIUM --host:abort--> ENDED
```

Questions never reveal early. Starting a question snapshots eligible player IDs. A new player during QUESTION watches it with `eligible: false` and becomes eligible at the next question. Accept an eligible player's first answer only when `receivedAtMs < endsAtMs` and REVEAL has not begun. There is no grace period.

Host commands use `{ gameId, requestId, expectedStateVersion }`; `host:create` is the exception because it has no game ID or expected version. Repeat `requestId` returns its cached outcome. A different request with an old state version returns `STALE_COMMAND` without changing the game.

## Events and acknowledgements

Every acknowledgement is `{ ok: true, data }` or `{ ok: false, error: ErrorCode }`. All incoming payloads are runtime-validated before any state lookup.

| Direction | Event | Payload and successful `data` |
|---|---|---|
| Host → server | `host:create` | `{ quizId, hostSecret, requestId }` → `{ gameId, pin, joinUrl, snapshot }` |
| Host → server | `host:resume` | `{ gameId, pin, hostSecret }` → `{ snapshot }` |
| Host → server | `host:start`, `host:next`, `host:abort`, `host:end` | `{ gameId, requestId, expectedStateVersion }` → `{ snapshot }` |
| Host → server | `host:retry-export`, `host:result-download` | `{ gameId, requestId }` → `{ exportStatus, downloadUrl? }` |
| Player → server | `player:join` | `{ pin, nickname, joinRequestId }` → `{ gameId, playerId, resumeToken, recoveryCode, snapshot }` |
| Player → server | `player:resume` | `{ gameId, pin, playerId, resumeToken }` → `{ snapshot }` |
| Player → server | `player:recover` | `{ pin, nickname, recoveryCode, recoveryRequestId }` → `{ gameId, playerId, resumeToken, snapshot }` |
| Authenticated host/player → server | `game:resync` | `{ gameId }` → `{ snapshot }` |
| Player → server | `player:answer` | `{ gameId, questionIndex, optionIndex, clientRequestId }` → `{ status: 'accepted' \| 'already-accepted', optionIndex, receivedAtMs, revision }` |
| Server → all game sockets | `game:question`, `game:reveal`, `game:leaderboard`, `game:podium`, `game:ended`, `game:player-count` | Common event envelope and the matching public `data` view below |
| Server → current host socket | `host:lobby`, `host:progress`, `host:export-status` | Event envelope and host-only `data` below |
| Server → one player socket | `player:result` | Event envelope with the player's result below |
| Server → one authenticated socket | `game:snapshot` | Complete `HostSnapshot` or `PlayerSnapshot` below |

`joinUrl` is the full encoded player URL including `?pin=<six digits>`.

## Complete views

Each snapshot includes the envelope plus a role-specific `data` object. Public room-event data never contains `own`, a resume credential, recovery code, host secret, or unrevealed correction/explanation.

| State | Host snapshot data | Player snapshot data |
|---|---|---|
| LOBBY | `{ pin, joinUrl, players: [{ playerId, nickname, connected }], connectedCount, totalCount }` | `{ nickname, connectedCount, totalCount }` |
| QUESTION | `{ question: QuestionView, progress: { eligibleCount, answeredCount } }` | `{ question: QuestionView, eligible, ownAnswer: number\|null }` |
| REVEAL | `{ reveal: RevealView, progress: { eligibleCount, answeredCount } }` | `{ reveal: RevealView, ownResult: PlayerResult }` |
| LEADERBOARD | `{ leaderboard: LeaderboardView }` | `{ leaderboard: LeaderboardView, own: PlayerStanding }` |
| PODIUM | `{ podium: PodiumView, exportStatus: ExportStatus }` | `{ podium: PodiumView, own: PlayerStanding }` |
| ENDED | `{ reason, podium: PodiumView, exportStatus: ExportStatus }` | `{ reason, own: PlayerStanding, exportStatus: 'pending'\|'saved'\|'failed' }` |

```text
QuestionView = { index, total, text, options: [string, string, string, string], timeLimitSeconds, startsAtMs, endsAtMs }
RevealView = { index, correctOptionIndex, distribution: [number, number, number, number], answeredCount, explanation?: string }
PlayerResult = { questionIndex, correct, pointsEarned, score, rank }
PlayerStanding = { score, rank }
LeaderboardView = { questionIndex, top: [{ nickname, score, delta, rank }] }
PodiumView = { top3: [{ nickname, score, rank }] }
ExportStatus = { status: 'pending'|'saved'|'failed', filename?: string, message?: string }
```

Common event data is `{ question: QuestionView }` for question; `{ reveal: RevealView }` for reveal; `{ leaderboard: LeaderboardView }` for leaderboard; `{ podium: PodiumView, exportStatus: ExportStatus }` for podium; `{ reason, exportStatus: ExportStatus }` for ended; and `{ connectedCount, totalCount }` for player count. Host-only event data is the LOBBY `players` list, QUESTION `progress`, or `ExportStatus`. `player:result` data is `PlayerResult`.

## Errors, quiz schema, scoring, and retention

Error codes: `BAD_PAYLOAD`, `GAME_NOT_FOUND`, `GAME_FULL`, `GAME_ENDED`, `NICKNAME_TAKEN`, `NICKNAME_INVALID`, `BAD_RESUME_TOKEN`, `BAD_RECOVERY_CODE`, `UNAUTHORIZED`, `BAD_SECRET`, `QUIZ_NOT_FOUND`, `QUIZ_EXISTS`, `INVALID_TRANSITION`, `STALE_COMMAND`, `NOT_ACCEPTING_ANSWERS`, `ALREADY_ANSWERED`, `INVALID_OPTION`, `NOT_ELIGIBLE`, `THROTTLED`, `EXPORT_UNAVAILABLE`, `SERVER_CAPACITY`.

The host may add a quiz for the current server session with `POST /api/quizzes`, sending `{ "quiz": Quiz }` as JSON and the configured secret in the `x-host-secret` header. The endpoint applies the same quiz validator as bundled files, returns `{ ok: true, data: { id, title, questionCount } }` with HTTP 201, and rejects an existing ID with `QUIZ_EXISTS`. These quizzes are held in memory and are lost when the server restarts.

```json
{
  "id": "contract-sample",
  "title": "Contract Sample",
  "questions": [{
    "text": "Which option is correct?",
    "options": ["A", "B", "C", "D"],
    "correct": 0,
    "timeLimitSeconds": 20,
    "points": 1000,
    "explanation": "A is the sample answer."
  }]
}
```

Quiz IDs match filenames. A quiz has 1–50 questions; text is 1–200 characters; each option is 1–80; `correct` is 0–3; time is 5–120 seconds; points are 100–2,000; explanation is optional and 1–200. The JSON Schema enforces all values.

For correct answers, `responseMs = clamp(receivedAtMs - startsAtMs, 0, timeLimitSeconds * 1000)`. Score is full points through 500 ms, otherwise `round(points * (1 - (responseMs / (timeLimitSeconds * 1000)) / 2))`; wrong/unanswered answers score zero. Rank by score descending, correct-answer response-time total ascending, then normalized nickname ascending.

Clients estimate server time as `Date.now() + offsetMs`, with `offsetMs = serverNowMs - clientNowMs` sampled on every snapshot/resync. Render `max(0, endsAtMs - (Date.now() + offsetMs))`.

Support 50 players per game and five active games. Retain ENDED games for 30 minutes, unless the retained-game cap of ten evicts the oldest ended game first. A PODIUM with no host action automatically ends after 30 minutes. Purge disk exports after 30 days during server startup and daily cleanup. `host:abort` during QUESTION scores only answers already accepted by the server, marks every unfinished question unanswered, and writes status `aborted`; aborting PODIUM does not overwrite an already completed export.

Downloads use `GET /api/games/:gameId/results/:filename?token=<opaque-token>`. `host:result-download` issues a random one-time token bound to the current host socket, filename, and game, valid for five minutes. The route consumes it, verifies the file remains in the result directory, and returns 401/404 without disclosing filenames when invalid. Repeating a failed export uses a new `host:retry-export` request ID; repeating the same request ID returns that request's cached outcome.

## Gate acceptance

- Initialize the repository and commit a clean Node 24 scaffold with root README and AGENTS guidance.
- `npm install`, `npm run build`, `npm test`, `npm start`, and `curl http://localhost:3000/healthz` succeed for the placeholder scaffold.
- Shared contracts import in both a Node test and Vite build; the JSON Schema validates `_contract-sample.json` and rejects malformed fixture files.
- Contract fixtures cover both roles in all six states, zero-player lobby, late question observer, answer acknowledgement loss, same-state question→progress and reveal→result revisions, stale state-version commands, join retry, recovery retry, and absence of unrevealed corrections/credentials.
- Handoff records name the final owner for `server/index.js` and each client entry file. Server gameplay behavior is not an acceptance condition until Task 02; full-game smoke is not an acceptance condition until Task 03.
