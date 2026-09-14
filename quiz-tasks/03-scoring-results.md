# Task 03 — Scoring, Durable Results, and Integrated Server Smoke

Depends on: 01 and 02. **Owns:** `server/scoring.js`, `server/results.js`, `server/test/scoring-results.test.js`, `server/results/.gitkeep`, and integrated updates to `scripts/smoke.js`.

## Interfaces

- `scoreAnswer({ correct, points, timeLimitSeconds, responseMs }) -> number`
- `buildLeaderboard(players) -> [{ playerId, nickname, score, delta, rank }]`
- `rankOf(playerId, leaderboard) -> number`
- `writeResults(game, { status: 'completed'|'aborted' }) -> Promise<{ status: 'saved', filename, jsonFilename } | { status: 'failed', message }>`
- `issueDownloadToken(game, currentHostSocket, filename) -> { url, expiresAtMs } | null`

The Game object calls only these interfaces. `writeResults` receives an explicit export view with arrays, never a raw `Map` or socket objects.

## Required behavior

- Implement exactly the contract score formula, including full points at 500 ms or less, zero for wrong/unanswered answers, and clamping.
- Rank deterministically by score, correct-answer response-time total, and normalized nickname. `delta` is the score earned in the just-revealed question, not an inferred difference after sorting.
- Export CSV as UTF-8 BOM, with safe CSV escaping and stable fields: `rank,nickname,score,correct_count,q1_answer,q1_correct,q1_ms,...`. Blank answer cells mean unanswered. Use Asia/Manila timestamps only in filenames and display metadata, not as a substitute for stored epoch receipt times.
- Write a versioned JSON sibling with plain arrays/objects: quiz ID/title, game ID, PIN, status, started/ended timestamps, player results, selected options, correctness, receipt times, final scores, and ranks. Zero-answer games and players who watched without eligibility have explicit zero/blank result fields. Exclude host secret, resume token, recovery code, socket IDs, timers, and request IDs.
- Generate safe filenames from a validated quiz ID, timestamp, and PIN. Write to a temporary file and atomically rename it. Return an explicit failure status on disk errors.
- Export `completed` results once on PODIUM entry. Export `aborted` results once when aborting an active state: score accepted current-question answers, mark the remaining answers unanswered, and retain that status. Aborting PODIUM never overwrites a completed export. A repeated command returns the cached outcome. `host:retry-export` retries only a failed export while the game is retained and requires a new request ID.
- Implement the exact Task 01 protocol: `host:result-download` issues one opaque token bound to the current host socket, game, and filename for five minutes; `GET /api/games/:gameId/results/:filename?token=<opaque-token>` consumes it and returns 401/404 without filename disclosure when invalid. Do not put `HOST_SECRET` in the URL, logs, client state, or CSV. `host:result-download` returns `EXPORT_UNAVAILABLE` while an export is pending or failed.
- Host UI receives `host:export-status` for `pending`, `saved`, or `failed`; it must never report a saved filename when the write failed.

## Tests and integrated smoke

Test 0 ms, 500 ms, normal, deadline-clamped, wrong, unanswered, and observer scores; all tie-break dimensions; CSV quoting; JSON shape with a `Map`-backed source; atomic-write failure; download authorization/expiry/one-time consumption; completed versus aborted export; retention-cap eviction; PODIUM auto-end; and disk cleanup. Update the smoke script to play two questions in two isolated games, reach the podium, wait for a saved export, and download it through the authorized host flow.

## Acceptance

- `npm test` proves final ranks and each player's result are computed after the final question before podium emission.
- A read-only or invalid results target reports `failed` and leaves the podium available.
- The generated CSV opens in Excel/Google Sheets with three fake players and all answer columns intact.
- The integrated smoke script passes without exposing a resume credential or an unrevealed answer key.
