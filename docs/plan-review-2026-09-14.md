# Live Quiz task-pack review — September 14, 2026

The architecture is suitable for this event, but the contract and task boundaries need correction before implementation branches start. Keep Node, React, Socket.IO, JSON quizzes, and in-memory live games. Prioritize reliable reconnect, truthful answer confirmation, and a tested venue fallback.

Rhomuel confirmed **20+ students, two hours per day, and unknown venue connectivity**. That gives approximately 18–20 hours of owner attention through September 23, depending on whether September 14 is still available. Agent implementation time can overlap; integration decisions and real-device testing still consume that budget. The complete original pack is too ambitious for that attention budget. A smaller version is plausible, conditional on an early working game and network rehearsal.

Reviewed all 12 files in `quiz-tasks/`. The workspace contains task documents, not an application scaffold: no package manifest, source implementation, or Git repository was present. The original `live-quiz-plan.md` and ZIP were not present. Findings below concern the supplied specifications, not observed application failures.

> **Revision applied September 14–15, 2026:** The 12 task files were updated from this review. They now use a shared browser-safe contract, Node 24 LTS, private resume tokens plus recovery codes, explicit snapshot/acknowledgement/export contracts, single-writer ownership lanes, Docker Compose as primary deployment, a fresh-game local fallback, accessible player guidance, and a 50-player validation target. This report remains the rationale and does not supersede those revised task instructions.

## Findings to resolve before parallel implementation

### 1. P1 — The countdown offset has the wrong sign

Evidence: [01-contracts.md:78](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:78).

With `offset = serverNow - Date.now()`, estimated server time is `Date.now() + offset`. Therefore:

```js
remainingMs = Math.max(0, endsAt - (Date.now() + offset));
```

The prescribed `endsAt + offset` moves the deadline in the wrong direction. A local arithmetic reproduction with the server clock five seconds ahead produced **30 seconds displayed instead of 20**. Define all wire timestamps as epoch milliseconds and durations explicitly as seconds or milliseconds. Use a request/response time sample to estimate offset and network delay; refresh it on resume/visibility return. Treat the display as approximate and server receipt as authoritative. Prefer a monotonic elapsed clock for server scoring and deadlines so wall-clock corrections cannot change an ongoing question's duration.

### 2. P1 — A public nickname is being used as a reconnect credential

Evidence: [07-reconnect-resilience.md:10](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/07-reconnect-resilience.md:10), [04-client-shell.md:14](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/04-client-shell.md:14).

Any participant who sees a nickname on the projector can claim that student's identity and score once the student disconnects. Also, a legitimate new socket can arrive before the old socket is marked disconnected and receive `NICKNAME_TAKEN`.

Keep PIN + nickname for initial joining, then issue an unpredictable per-player resume token. Reconnect must prove possession of that token. A valid resume replaces the old socket; the old socket's later disconnect handler must not disconnect the replacement. Bind answers to the authenticated socket's game/player identity. Never broadcast resume tokens or include them in analytics exports.

The sessionStorage-only constraint supports refresh, but cannot guarantee automatic recovery after closing a tab and opening a fresh one. Browser restoration behavior must not be relied on. [MDN documents the tab lifetime of sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).

Choose explicitly: preserve sessionStorage and offer a private recovery code for a newly opened tab, or revise the constraint to allow an expiring persistent credential while keeping game state server-side. The former preserves the current storage constraint. Cross-browser/in-app-browser recovery also needs this explicit flow.

### 3. P1 — The shared contract leaves required state and events undefined

Evidence: [01-contracts.md:19](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:19), [06-host-ui.md:11](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/06-host-ui.md:11), [07-reconnect-resilience.md:14](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/07-reconnect-resilience.md:14).

The contract is currently a task brief, not yet a complete integration interface:

| Required behavior | Missing agreement |
|---|---|
| Host resume | Success/error envelope differs from other acknowledgements; `snapshot` has no full schema. |
| Resume in every phase | Current question, reveal data, leaderboard, own result, podium, and terminal state need role-specific schemas. |
| Host lobby nickname grid | Specify when the full lobby roster is resent; a count event cannot update names. |
| Live “answered X / Y” | No question-progress event exists. Keep this host-only if added. |
| Player's rank after reconnect | Define own rank/score/result in snapshots, including during leaderboard and podium. |
| QR join link | Define whether `joinUrl` already includes `?pin=`; return one complete URL to avoid double-appending. |
| Kick | Only the outgoing `player:kicked` event exists; no host command or revoked-resume policy is defined. Defer it or specify the whole flow. |
| End/abort | The state diagram permits ENDED only after PODIUM, but the host-disconnect policy ends games in other phases. |

Distinguish **new join** from **resume**: reject new entrants after the game finishes, but allow existing players to recover the podium during the retention window. Task 07 currently rejects both at PODIUM/ENDED.

Use explicit outgoing field allowlists. Never serialize the internal Game object into any snapshot: it contains the full quiz and answer keys. Tests should inspect nested payloads for unrevealed answers, not just grep for a field named `correct`.

### 4. P1 — Lost acknowledgements and duplicate commands have no safe reconciliation

Evidence: [05-player-ui.md:18](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/05-player-ui.md:18), [07-reconnect-resilience.md:17](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/07-reconnect-resilience.md:17), [01-contracts.md:22](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:22).

A tap is currently shown as “Answer locked” before acknowledgement. If the server accepts it but the acknowledgement is lost, Task 07 re-enables the buttons; another tap can receive `ALREADY_ANSWERED` while the UI displays the wrong selection. A delayed duplicate `host:next` can advance REVEAL → LEADERBOARD → QUESTION twice.

Return the accepted option and receipt status on answer acknowledgement/retry. Use “Sending…” until confirmed, then reconcile from the server on timeout. Give host commands a request ID and expected phase/version; duplicate requests return the original outcome, and stale requests cannot advance state. Add a unique game instance ID so old sessions cannot target a newly reused PIN.

Socket.IO preserves event order but defaults to at-most-once arrival; missed server events are not automatically replayed. Its recovery feature can help, but does not replace snapshot synchronization. [Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/), [connection state recovery](https://socket.io/docs/v4/connection-state-recovery/).

Do not queue gameplay commands while disconnected or before resume completes. Socket.IO buffers disconnected client emits by default. Request a fresh snapshot when a page becomes visible even if no new `connect` event fires. [Offline behavior](https://socket.io/docs/v4/client-offline-behavior/).

### 5. P1 — Reveal, grace, and participant eligibility conflict

Evidence: [01-contracts.md:13](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:13), [01-contracts.md:75](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:75), [02-server-core.md:17](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/02-server-core.md:17).

The contract says reveal at timer expiry, but the server task waits another 500 ms. Define `endsAt` as the visible deadline and, if retained, `acceptUntil = endsAt + 500` as the receipt cutoff. Specify the exact boundary comparison, close answers before revealing, and check receipt time in the handler even if the timeout callback is delayed. Never accept answers after exposing correctness.

“All connected players answered” means a temporary disconnect can shorten the question for someone still trying to answer. Late joins also change the denominator mid-question; zero connected players needs a rule. For this event, the simplest recommendation is **always wait for the deadline**, and let new late joiners participate starting with the next question. If early reveal remains, define a fixed eligible roster and deliberate disconnect semantics. Cancel stale timers on advance, abort, and deletion; score a question exactly once.

### 6. P1 — Root ownership and acceptance dependencies prevent independent completion

Evidence: [00-README.md:8](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/00-README.md:8), [02-server-core.md:18](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/02-server-core.md:18), [04-client-shell.md:4](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/04-client-shell.md:4), [07-reconnect-resilience.md:4](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/07-reconnect-resilience.md:4).

- 02's complete-game acceptance needs scoring from 03, but 03 is scheduled after 02. Move pure scoring alongside core work or agree on an interface before either starts.
- 02 and 07 both edit `server/game.js`; 04's broad ownership overlaps 06's host components and 07's client hooks. Assign one writer per file and explicit integration points.
- Root scripts, lockfiles, `.gitignore`, test configuration, and build integration need an owner. Smoke tests, quiz validation, screenshots, and test evidence appear in deliverables outside some ownership lists.
- 01 owns the quiz schema, but 08 later proposes changing it. Decide `explanation` before freezing the schema.
- 04 cannot satisfy integrated `npm start` acceptance independently of 02. Distinguish component acceptance from later integration acceptance.

Keep the task documents as work packages; do not interpret them as ten simultaneously independent agents. Make contracts plus a minimal build scaffold the initial gate. A browser-safe shared module must have an explicit import/build arrangement; its current location under `server/` alone does not establish one.

## Findings to resolve before the dry run

### 7. P1 — Node 20 and the deployment recommendation need updating

Evidence: [09-deployment.md:7](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/09-deployment.md:7), [09-deployment.md:20](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/09-deployment.md:20).

Node 20 is end-of-life as of this review. Pin a supported **Node 24 LTS** release consistently for development, build, and runtime; commit compatible dependency lockfiles. “Node 20+” also omits patch-level requirements of current Vite. [Node release schedule](https://github.com/nodejs/Release), [Vite requirements](https://vite.dev/guide/).

Use **Docker Compose on the existing VPS stack** as the primary recommendation, and `npm start` on the laptop as fallback. PM2 adds an unnecessary third operational path for this deadline. The task's ARM64/Ubuntu assertion is not established by the supplied user context and should be verified before choosing images or commands.

If PM2 remains, do not depend on `env_file` without verification: it is absent from the documented ecosystem attributes. Task 02 already requires application-level `.env` loading; make that explicit. The memory-triggered restart in the proposed PM2 configuration would also discard a live game. [PM2 ecosystem attributes](https://pm2.keymetrics.io/docs/usage/application-declaration/).

For Docker, specify production dependency installation, built client files, writable results-volume permissions for `USER node`, and one replica. If Caddy runs in Docker, proxy to the service on its network; `localhost:3000` refers to that container. If Caddy runs on the VPS host, use an appropriate loopback-bound published port. Verify actual exposure rather than relying only on a firewall note. Define an HTML fallback for direct loads of `/host` and `/play`, while preserving API and Socket.IO routing; serving static assets alone does not establish refresh support.

### 8. P1 — The local fallback has no verified network or failover procedure

Evidence: [09-deployment.md:40](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/09-deployment.md:40), [10-testing-qa.md:21](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/10-testing-qa.md:21).

Phones cannot access the laptop's `localhost`. The server must listen on a LAN-accessible interface, devices must be able to reach each other, and the laptop firewall must allow the connection. A shared SSID or phone hotspot does not prove those conditions or sufficient client capacity. Venue client isolation, captive portals, and device limits remain unverified risks.

Arrange a network preflight before September 23: test a phone-to-laptop game with internet disconnected, and test venue access to the VPS. Prebuild assets, install dependencies, keep quiz files local, and avoid runtime CDN requirements. Do not count on phone wake lock for plain-HTTP LAN access; manual sleep settings remain part of the runbook. [MDN documents the secure-context requirement](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

The idle laptop server does **not** share the VPS's in-memory game. Switching origins means a fresh game, new PIN/QR, rejoining, and lost live progress. Write that into the host procedure, including how to resume the teaching activity or use prepared slides if neither network works. A database would not by itself solve this network failover.

### 9. P1 — Results can be missing while the host sees a success message

Evidence: [03-scoring-results.md:18](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/03-scoring-results.md:18), [06-host-ui.md:15](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/06-host-ui.md:15), [02-server-core.md:24](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/02-server-core.md:24).

The export may return `null`, but the host flow only describes “Results saved.” The server retains games for downloading, yet no protected download API is specified. Define export states (`pending`, `saved`, `failed`), a host-authorized download route, and a retry while the game is retained. Show failure accurately without blocking the podium. Save on entering PODIUM and on deliberate abort, not only after a final button press.

Replace “full raw game object” with a versioned results data structure: player arrays, selected options, correctness, receipt times, final scores, quiz identity/version, and completion/abort status. Explicitly exclude secrets, resume tokens, sockets, and timers. A local Node reproduction confirms JSON serialization of a Map produces `{}`, losing the player entries unless converted. Use safe generated filenames, atomic writes, and a disk-retention policy separate from in-memory purge. Define unanswered CSV cells and stable rank/delta calculation; compute all final question scores before emitting ranks.

### 10. P1 — Input authorization and abuse limits need concrete acceptance cases

Evidence: [02-server-core.md:20](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/02-server-core.md:20), [01-contracts.md:48](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:48).

The host-secret approach is reasonable for one trusted operator, provided startup rejects a missing/placeholder secret and secrets never enter the client bundle or logs. Define whether a new authenticated host replaces the previous host; all subsequent host commands must check current ownership. CORS is not a substitute for command authorization.

Validate every incoming payload, including integer `optionIndex` in 0..3, question identity, game membership, PIN shape, string sizes, and socket role. A socket knowing another game's PIN must not answer there. Add errors for malformed input, unauthorized membership, invalid resume credentials, server capacity, and throttling. Bound create/join/answer traffic without a small shared-IP limit that rejects an entire classroom behind one router. These are targeted requirements for this public quiz protocol, not an account system.

### 11. P2 — Accessibility requirements contradict the phone UI instructions

Evidence: [04-client-shell.md:17](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/04-client-shell.md:17), [05-player-ui.md:18](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/05-player-ui.md:18).

Remove zoom suppression. It prevents some low-vision users from reading content and is not consistently honored by browsers. [MDN viewport guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport).

Keep question text comfortably readable on phones. Use A–D labels plus shapes and color, explicit “Correct”/“Incorrect” text, visible focus, and reduced-motion support. Four buttons each at 25% viewport height leave no room for the question or timer; size the available answer area instead. Test long allowed question/option text at 320 px and browser zoom. For projector readability, verify the actual room rather than assuming a dark theme always wins.

### 12. P2 — Load testing and the schedule do not match the limits

Evidence: [10-testing-qa.md:3](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/10-testing-qa.md:3), [10-testing-qa.md:8](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/10-testing-qa.md:8), [01-contracts.md:84](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:84).

A 150-player test in one game with a 100-player cap measures rejection, not the server ceiling. A 50-player success test does not establish support for the advertised 100. Also, 20 games × 100 players permits 2,000 players, inconsistent with the pack's “under ~500 sockets” justification.

For the expected event, provisionally target and test 50 players, subject to confirming the actual headcount. If the contract continues promising 100, test 100 successfully and assert `GAME_FULL` beyond that. Test simultaneous join/answer bursts, acknowledgement loss, reconnect bursts, and isolation between games. Measure on the deployed build; synthetic clients do not validate venue Wi-Fi. Start QA with the first integrated game, not Wave 3.

## Minimum revised contract gate

Before other implementation branches start, the contract owner should deliver:

1. Browser-safe constants, runtime payload validation, and fixtures for every role/phase snapshot.
2. Consistent acknowledgements: success with defined data, failure with a documented error code; no ellipses in podium types.
3. Game instance identity, stable player identity, private resume credentials, and current socket ownership rules.
4. Exact transition table, including authorized abort, duplicate commands, all-player disconnect, late join, and terminal resume.
5. Explicit time units, visible/acceptance deadlines, receipt boundary, and answer eligibility policy.
6. Answer confirmation/retry semantics, command deduplication, snapshot versions, and reconnect/visibility synchronization.
7. Lobby/progress/result updates required by the UIs, complete join URL semantics, and protected export status/download contracts.
8. Example tests for no unrevealed-answer leakage, spoofed membership, skewed clocks, stale timers, lost acknowledgements, and resume replacing a stale socket.

This is more than a constants file and should not be constrained to “half a day max” regardless of unresolved decisions.

## No database in v1

**Keep this decision for 20+ students.** A single process with in-memory state is a reasonable design to benchmark at the proposed 50-player event target. A database is not needed merely because the app will be reused: new JSON quizzes and saved result files already support future seminars.

The material tradeoff is durability: a crash, deployment, or automatic restart destroys ongoing scores. Completed result files need a persistent volume and verified download. Avoid deployments during a live game, document restart behavior, and keep the seminar low-stakes. If surviving restart becomes a requirement, add deliberate persisted game snapshots/event recovery; simply adding Postgres does not provide it. Do not spend the current budget integrating the existing Redis, Postgres, or n8n services.

## Better task grouping

Retain the numbered files as checklists, with these ownership groups:

| Group | Scope and sequencing |
|---|---|
| Contract/integration owner | 01 plus initial root scaffold, lockfiles, shared types, fixtures, and merge verification. Gate first; remain available for contract changes. |
| Backend owner | 02 + 03 + server portion of 07. One writer for the state machine, identity, timers, scoring, and exports. |
| Client foundation | 04 + client reconnect/session logic from 07. Define the state store and page interfaces before page work. |
| Player and host pages | 05 and 06 can run independently after the client interfaces stabilize; use contract fixtures early. |
| Content | 08 after schema agreement, with independent human ambiguity review. |
| Deployment | 09 alongside early implementation, finalized against the actual build. |
| QA/integration | 10 continuously, with specific tests added as features land. |

At most three or four active implementation streams are likely easier to integrate with two hours of daily owner attention. Keep a single integrator and daily complete-game smoke check. Reconnect still deserves a dedicated checklist, but splitting ownership of `game.js` makes it harder to implement coherently.

## Scope and schedule for the available time

Ship one event game at a time operationally, text questions, one correct answer, basic lobby/question/reveal/leaderboard/podium, secure resume, and host results download. Keep reusable quiz loading and the per-game model. Defer animations/confetti, the component demo route, exhaustive screenshot deliverables, a hard Lighthouse score gate, PM2 support, kick unless required, and early reveal. Retain real-device accessibility checks and meaningful protocol tests.

| Date | Outcome to verify |
|---|---|
| Sept 14–15 | Corrected contracts and ownership; runnable minimal scaffold; establish DNS/deployment prerequisites and arrange venue network access. |
| Sept 16–18 | Full sample game from join through downloadable results; test on at least one real phone and deploy early to the VPS. |
| Sept 19–20 | Resume/retry/abort behavior; basic host/player UX; confirm local game works without internet. |
| Sept 21 | Feature complete; content reviewed; rehearsal on several phones; synthetic load at agreed capacity. |
| Sept 22 | Fix reproduced problems; verify protected exports, device matrix, and fallback procedure. |
| Sept 23 | Mandatory timed human dry run, then freeze and tag the verified artifact. |
| Sept 24 | Buffer for reproducible blocker fixes only, with re-verification; prepare offline teaching materials. |
| Sept 25 | Use the rehearsed build and network; no live upgrades. |

This is a proposed sequence, not an estimate of guaranteed completion. If the complete sample game is not working by September 18, remove remaining polish and protect rehearsal time. Do not spend all of September 23 finishing features and call that a dry run.

## Blockchain seminar considerations

- Include one clearly identified practice question/game before scores matter. Explain the speed bonus and whether the final two questions are worth double; surprise weighting undermines trust.
- The formula is Kahoot-like, but not exactly Kahoot's documented scoring: correct responses below 0.5 seconds receive full points there. At 250 ms on a 20-second, 1,000-point question, this plan gives 994; Kahoot documents 1,000. Either implement that exception or describe the formula as your own. [Kahoot scoring documentation](https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work).
- For a seminar, prioritize learning over reaction speed. Network latency affects server-receipt scoring; longer reasoning windows and low-stakes ranking help. Keep all questions at 1,000 points unless double weighting serves a clear teaching purpose.
- Include `explanation` in the initial schema and reveal payload, then show a short explanation on the projector or in prepared speaker notes. Reuse the existing REVEAL pause for discussion; no extra pause state is necessary.
- Questions should identify the chain/context when answers depend on it. Have a reviewer check claims about consensus, fees, finality, wallets, keys, and L2s against appropriate primary sources during content authoring. No actual quiz content is present to fact-check yet.
- No wallet connection, seed-phrase entry, purchases, or on-chain activity is needed to participate. Keep fake examples clearly labeled and use one recognizable join domain plus a typed PIN option.
- The “why isn't this on-chain?” discussion is useful. A leaderboard hash would only show whether a later file matches an earlier commitment; it would not prove fair scoring or correct answers. Testnet anchoring remains optional backlog, not a uniquely necessary blockchain feature.
- Allow aliases, keep individual wrong answers off the projector, and offer shared-phone participation for students without a working device. This can use one ordinary player entry without building team mode.

## Verification and remaining unknowns

Completed: read all 12 task documents; checked current primary documentation for runtime support, Socket.IO behavior, browser storage/zoom, PM2, Vite, and scoring; ran local Node examples reproducing the clock-sign error, scoring difference, and Map serialization loss. Reviewed the written report and its local links.

Not performed: application tests, deployment, VPS inspection, load tests, real-device tests, or venue-network validation. No application implementation exists in this workspace yet. Actual upper headcount, VPS/Caddy topology, and venue network remain unknown. These limit confidence in capacity and dates; they do not justify adding a database now.
