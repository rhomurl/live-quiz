# Live Quiz App — Revised Task Pack

Target event: blockchain seminar, September 25, 2026. Feature freeze: September 23 after a timed human dry run. The expected event is 20+ students; the initial supported target is 50 players in one game.

Stack: Node.js 24 LTS, ESM, Express, Socket.IO 4, React 18, Vite, JSON quiz files, and in-memory active game state. A server restart intentionally ends active games. Completed results are written to a persistent volume.

## Scope for the seminar build

Ship one active game at a time operationally, four-option text questions, a host-controlled lobby/question/reveal/leaderboard/podium flow, secure resume, JSON quiz loading, and host-authorized results download. The server alone decides question deadlines, correctness, and score.

Do not add a database, Redis, teams, images, sound, on-chain features, kick controls, confetti, early reveal, PM2 support, a component gallery, or a hard Lighthouse threshold before the seminar. The lightweight host quiz editor is included: it validates and keeps new quizzes in memory for the current server session. Persistent quiz authoring remains a post-event idea.

## Ownership and dependencies

`01-contracts.md` is the blocking contract and scaffold gate. It must be implemented, reviewed, and merged before feature branches begin. Contract changes require the integration owner to update the contract, fixtures, and affected acceptance checks in the same change.

| Lane | Tasks | Source ownership | When it runs |
|---|---|---|---|
| Integration | 01 | Bootstrap files, `shared/**`, contract fixtures, `_contract-sample.json`, test setup; hands server/client entries to their final owners | September 15 |
| Backend | 02, 03 | `server/index.js`, `server/game.js`, `server/scoring.js`, `server/results.js`, `server/test/**`, `scripts/smoke.js` | After 01; 03 follows 02 |
| Client foundation | 04 | Client entries after handoff, `client/src/lib/**`, shared components/styles, client test setup | After 01 |
| Page UI | 05 and 06 | Named page files and their page-specific styles/tests | After 04 interfaces are available |
| Resilience integration | 07 | Named resilience tests and manual evidence; backend/client owners make their respective source edits | After 02–06 |
| Content | 08 | `blockchain-101.json`, `sample-test.json`, authoring guide, quiz validator | After 01 |
| Operations | 09 | Docker, deployment documents, runbook | Starts after 01; finalizes against the integrated build |
| QA | 10 | Load test, checklists, test evidence | Starts with the first integrated sample game; final gate after 07–09 |

One agent owns each source file. Task 01 owns bootstrap entries only until the documented handoff; it does not retain ownership after the gate. Task 07 is an integration and evidence task, not a third owner of `server/game.js` or client session code. Treat the Backend and Client Foundation lanes as sequential work by their respective owners when their files must change together.

## Dependency graph

```text
01 contracts + scaffold
├── 02 server core ──> 03 scoring, exports, integrated server smoke
├── 04 client foundation ──> 05 player UI
│                            └── 06 host UI
├── 08 content
└── 09 deployment preparation

02 + 03 + 04 + 05 + 06 ──> 07 resilience integration ──> 10 QA and dry run
08 + 09 ────────────────────────────────────────────────────┘
```

## Repository layout

```text
/quiz-app
  package.json, package-lock.json, .gitignore, .env.example
  /shared/contracts.js, /shared/fixtures/
  /server/index.js, game.js, scoring.js, results.js
  /server/quizzes/_contract-sample.json, sample-test.json, blockchain-101.json
  /server/results/                                 # results ignored by Git
  /server/test/*.test.js
  /client/src/lib/, components/, pages/, styles/
  /scripts/smoke.js, load-test.js, validate-quiz.js
  Dockerfile, compose.example.yml, .dockerignore, Caddyfile.example
  /docs/deploy.md, seminar-day-runbook.md, dry-run-checklist.md
```

## Delivery schedule

| Date | Required outcome |
|---|---|
| Sept 15 | Contract, scaffold, Node 24 lockfile, root guides, and deployment/DNS prerequisites are ready. |
| Sept 16–18 | A sample quiz runs from join through host-authorized results download on a real phone and the VPS. |
| Sept 19–20 | Resume, retry, host abort, accessible player/host UI, and local no-internet fallback are tested. |
| Sept 21 | Feature-complete seminar scope; reviewed quiz content; multi-phone rehearsal and 50-player synthetic test. |
| Sept 22 | Fix reproduced issues and verify exports, device behavior, VPS route, and local fallback. |
| Sept 23 | Timed human dry run, then tag `v1.0.0-seminar`; only reproducible blockers after this point. |
| Sept 24 | Buffer for a verified blocker fix only; prepare offline teaching slides. |
| Sept 25 | Run the rehearsed build. Do not upgrade dependencies or deploy a new feature live. |

If a full sample game is not demonstrably working by September 18, remove remaining polish and preserve the rehearsal window.

## Whole-project definition of done

- `npm run build`, `npm test`, and the server smoke script pass on Node 24.
- A sample game works end-to-end on at least three real phones and one host laptop.
- A student can refresh and securely resume without score loss; a new device cannot impersonate a disconnected student.
- Results save to the persistent volume and the host can download them after the game.
- The deployed VPS build works over HTTPS and the local fallback works with the laptop and phones on one verified local network without internet.
- The September 23 dry run has a dated checklist and the exact release artifact is tagged.
