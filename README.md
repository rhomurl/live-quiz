# Live Quiz

A reusable live quiz app for seminars and events. The first event is a blockchain seminar on September 25, 2026.

The app uses Node.js 24 LTS, Express, Socket.IO, React, Vite, JSON quiz files, and in-memory live game state. An active game is lost if the server restarts. Completed results are stored on a persistent volume.

## Current status

Planning is complete and Task 01 is the active implementation gate. The app scaffold, package manifest, and runnable commands do not exist yet. Follow the task pack in this order:

1. [Task 01 — Contract, Bootstrap, and Integration Gate](quiz-tasks/01-contracts.md)
2. [Task 02 — Server Core](quiz-tasks/02-server-core.md)
3. [Task 03 — Scoring and Results](quiz-tasks/03-scoring-results.md)
4. [Tasks 04–10](quiz-tasks/00-README.md)

Read [AGENTS.md](AGENTS.md) before contributing. The current decisions and constraints are in [Task 11](quiz-tasks/11-gaps-and-constraints.md).

## Planned commands after Task 01

```bash
npm install
npm run build
npm test
npm start
curl http://localhost:3000/healthz
```

The implementation must not claim these commands pass until Task 01 creates and verifies them.

## Event operations

Docker Compose on the VPS is the primary deployment. A laptop on a verified local network is a fallback that starts a new game; it cannot continue an in-progress VPS game. The deployment and seminar-day procedures are created in Task 09.

## Planning records

- [Revised task pack](quiz-tasks/00-README.md)
- [September 14 plan review](docs/plan-review-2026-09-14.md)
- [September 15 readiness check](docs/readiness-check-2026-09-15.md)
