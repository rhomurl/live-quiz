# Live Quiz

A reusable live quiz app for seminars and events. The first event is a blockchain seminar on September 25, 2026.

The app uses Node.js 24 LTS, Express, Socket.IO, React, Vite, JSON quiz files, and in-memory live game state. Hosts can author validated quizzes from `/host`; those editor-created quizzes last for the current server session. An active game is lost if the server restarts. Completed results are stored on a persistent volume.

## Current status

The seminar-scope implementation is integrated and locally verified. The app supports the host and player flows, secure resume/recovery, server-authoritative scoring, result exports, Docker deployment examples, and a LAN fallback. The September 23 dry run and real-device/network checks are still required before the September 25 event release.

The task pack remains the source of truth for contract details and ownership:

1. [Task 01 — Contract, Bootstrap, and Integration Gate](quiz-tasks/01-contracts.md)
2. [Task 02 — Server Core](quiz-tasks/02-server-core.md)
3. [Task 03 — Scoring and Results](quiz-tasks/03-scoring-results.md)
4. [Tasks 04–10](quiz-tasks/00-README.md)

Read [AGENTS.md](AGENTS.md) before contributing. The current decisions and constraints are in [Task 11](quiz-tasks/11-gaps-and-constraints.md).

## Local development

```bash
npm install
npm run build
npm test
npm start
curl http://localhost:3000/healthz
```

`npm test` runs the server and contract suites. The client resilience checks can be run with `node --test client/src/lib/reconnect.test.js`; `npm run validate:contract` validates the shared fixtures and contract quiz; `node scripts/validate-quiz.js server/quizzes/sample-test.json server/quizzes/blockchain-101.json` validates the event quizzes; `npm run smoke` exercises a complete in-memory game and authorized result download. Use Node 24 as declared by `package.json`.

The local verification record is in [docs/implementation-status-2026-09-15.md](docs/implementation-status-2026-09-15.md). A deployed 50-player capacity result, venue network test, and real-device dry-run evidence still need to be recorded in the QA documents.

## Event operations

Docker Compose on the VPS is the primary deployment. A laptop on a verified local network is a fallback that starts a new game; it cannot continue an in-progress VPS game. The deployment and seminar-day procedures are created in Task 09.

## Planning records

- [Revised task pack](quiz-tasks/00-README.md)
- [September 14 plan review](docs/plan-review-2026-09-14.md)
- [September 15 readiness check](docs/readiness-check-2026-09-15.md)
