# Task 02 — Server Core and Authoritative Game Loop

Depends on: 01. This task precedes 03. **Owns after Task 01 handoff:** `server/index.js`, `server/game.js`, `server/test/game.test.js`, `scripts/smoke.js`.

Implement Express and Socket.IO in one Node 24 process. Serve `client/dist` in production and return that HTML entry point for direct browser loads of `/`, `/play`, and `/host`; API, health, and Socket.IO routes must retain their own handlers.

## Required behavior

- Load `PORT`, `NODE_ENV`, `HOST_SECRET`, `PUBLIC_URL`, and results settings with an application `.env` loader. Refuse production startup when `HOST_SECRET` is empty or the example value.
- `GET /healthz` returns `{ ok: true, activeGames, retainedGames }`. `GET /api/quizzes` returns validated quiz metadata only.
- `GameManager.create(quizId)` creates a cryptographically random `gameId` and collision-checked six-digit PIN. It enforces the limits in 01 and never reuses a retained game's PIN.
- Allow initial create/join/resume/recover only on an unattached socket. Then attach exactly one host or player role in `socket.data`; never trust a supplied game identity without checking it against that attachment.
- Authenticate `host:create` and `host:resume` with `HOST_SECRET`. The most recently authenticated host socket replaces the prior host socket for that game. Every later host event requires current ownership and uses request-id/state-version deduplication.
- Validate payloads through 01 before handling them. Throttle malformed, create, join, and answer bursts without applying a tiny IP-wide limit that rejects a classroom on one router.
- Maintain `stateVersion` for transitions and a monotonically increasing `revision` for every emitted room, host, player, or snapshot view. Host transition commands compare only `expectedStateVersion`; clients order every view by `revision`.
- Host start snapshots the eligible player IDs. Start a server-controlled deadline, emit the contract's question view, emit host progress, and reveal exactly once when the deadline is reached. Clear pending timers on every state transition, abort, and purge.
- Joiners during QUESTION receive a watching snapshot with `eligible: false`; they participate from the next question. New joins are rejected after PODIUM. Do not reveal early when currently connected players have all answered.
- Implement idempotent `player:join` using `joinRequestId`, persistent recovery-code verification, token revocation/replacement, and authenticated `game:resync` exactly as defined by Task 01. Only accept a first answer from an eligible authenticated player while `receivedAtMs < endsAtMs`. Save it by question index and client request ID; repeat delivery returns `already-accepted` without changing the answer. Emit progress only to the host.
- On deadline, transition to REVEAL, calculate the question outcome once through the interface from 03, broadcast the safe reveal payload, and send each player their own result. Enter PODIUM only after all final-question scoring is complete.
- `host:abort` moves every active state to ENDED, records the reason, and asks 03's export layer to save partial results. Finished games remain downloadable for 30 minutes.

## Tests and smoke script

Write `node:test` coverage for transition authorization, PIN/game isolation, host replacement, payload rejection, answer ownership, stale host command, deadline enforcement, late joining, timer cleanup, answer-key non-disclosure, revision ordering, join retry, recovery retry, and resync views. The 03 scoring/export module may be imported through the documented interface only after that task lands; integrated full-game assertions belong in 03.

`scripts/smoke.js` must start an ephemeral server, create a game with fake Socket.IO clients, join three players, drive the sample quiz through every state, and print a sanitized final leaderboard. It must exercise direct room isolation for a second game and exit nonzero on a failed acknowledgement.

## Acceptance

- Core tests pass and a client cannot submit an answer for another game/player even with a known PIN.
- Expired, duplicate, ineligible, and stale-command requests leave game state unchanged.
- Direct loads of `/host` and `/play` receive the application HTML while `/healthz`, `/api/quizzes`, and Socket.IO remain reachable.
- Task 02 is accepted when its core unit boundary passes. Task 03 later upgrades the smoke script into the complete end-to-end server loop.
