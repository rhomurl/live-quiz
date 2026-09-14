# Task 11 — Constraints and Decisions Log

Read this before starting a task. The original gap analysis is superseded by the decisions below; these are the build constraints agents must follow.

## Hard constraints

- Node.js 24 LTS, ESM, Express, Socket.IO 4, React 18, and Vite. Commit the lockfile; no Node 20 runtime.
- Server-only authority for deadlines, answers, correctness, score, transitions, and export status. Clients render server views.
- A pre-reveal player payload contains no correct option or explanation. Views are explicit allowlists, never serialized game/quiz objects.
- No database, Redis adapter, sticky sessions, or multiple server replicas in v1. Live state is in memory; restart ends active games.
- Initial join is PIN + nickname plus a private join request ID; secure resume requires a private token; fresh-tab/device recovery requires a saved persistent recovery code plus a private retry ID. Nickname alone never restores a record.
- Player `sessionStorage` may hold resume data and pending operation IDs only; it must not hold recovery codes, host secrets, answer keys, or full game state. Host-only tab session storage may hold the host secret for resume. A closed tab is not guaranteed to retain either session.
- Question timers always run to their server deadline. Do not implement early reveal or a post-deadline grace interval.
- One active event game should be used operationally. Maximum supported test target is 50 players in one game until evidence supports a higher declared limit.
- Docker Compose on the existing VPS is the primary production path; a LAN-accessible laptop process is a separately tested fresh-game fallback. PM2 is out of scope.
- Persistent results storage and host-authorized download are required. Exports accurately report `pending`, `saved`, or `failed`.
- Feature freeze follows the September 23 dry run. Only a reproduced blocker with a fresh test and build may change the release afterwards.

## Decisions resolved from the original pack

| Topic | Decision |
|---|---|
| Shared code location | `shared/` is imported by server and client. |
| CSS | Plain CSS and design tokens; no UI framework. |
| Quiz explanations | Optional schema field, sent only with REVEAL. |
| Question images | Out before the seminar. |
| Kicking players | Out before the seminar. Nickname validation and host awareness are sufficient for this event. |
| Scoring | Kahoot-like with full score through 500 ms; disclose speed scoring in the practice round. |
| Accessibility | A–D labels, shape, color, text status, keyboard focus, zoom, and reduced motion. |
| Update ordering | Monotonic revision on every emitted view; state version only protects host transitions. |
| Host commands | Request IDs plus expected state version; resync after timeout/stale response. |
| Late join | Watch the current question; participate next question. |
| Results | CSV plus sanitized versioned JSON, atomic writes, retry during 30-minute retention. |
| Local failover | It starts a new game and cannot continue VPS in-memory state. |

## Seminar UX and content guardrails

- Run a short practice game before scores matter. Explain the join domain/PIN, answer speed scoring, and any point weighting.
- Keep individual wrong answers off the projector. Allow aliases and one shared device entry where needed.
- Use REVEAL explanations for learning discussion. Avoid presenting the quiz as on-chain; no wallet, seed phrase, payment, or blockchain transaction is required.
- The “why not on-chain?” question can be answered directly: transaction latency and cost do not help a short live quiz. A future leaderboard hash could prove a file has not changed after publication, but would not prove fair scoring.

## Remaining prerequisites to verify

- Actual maximum audience count and available rehearsal participants.
- VPS architecture, Docker/Caddy topology, DNS authority, and results-volume path.
- Venue Wi-Fi/mobile-data reliability, client isolation, captive portal behavior, and hotspot capacity.
- Browser behavior for the actual student messaging/in-app-browser path.

These are verification items, not reasons to expand scope before the September 23 dry run.
