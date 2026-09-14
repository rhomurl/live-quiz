# Task 10 — Continuous QA, Capacity Test, and Dry Run

Depends on the first integrated sample game; final gate depends on 07–09. **Owns:** `scripts/load-test.js`, `docs/dry-run-checklist.md`, `docs/load-test-results.md`, and `docs/known-issues.md`.

## Automated and synthetic testing

- Run the contract, server, scoring/export, client state, and resilience tests whenever their lane merges. The final command is `npm run build && npm test && node scripts/smoke.js`.
- `scripts/load-test.js N` connects N authenticated Socket.IO clients to a running deployed build, joins one sample game, produces simultaneous join and answer bursts, has 10% disconnect/rejoin with valid tokens, and records join success plus answer acknowledgement p50/p95. It must fail on unexpected server errors or leaked events.
- Run at N=50, the stated seminar target. Pass requires 100% valid joins, zero unexpected server errors, and p95 answer acknowledgement under 500 ms under the test network. If the contract later advertises a larger limit, test that advertised limit successfully and separately assert `GAME_FULL` for the next player; do not call an over-limit rejection test a capacity test.
- Record deployed-build results and environment details. Synthetic clients test the app, not venue Wi-Fi.

## Real-device and network checks

| Device | Browser | Required check |
|---|---|---|
| Android mid-range | Chrome | Full sample game, lock/unlock resume, zoomed text |
| iPhone | Safari | Full sample game, background/resume, recovery code path |
| In-app browser | Messenger/Facebook or actual seminar link path | Join and answer; use the normal browser if unsupported |
| Laptop | Chrome | Host refresh, fullscreen, guarded keyboard controls |

Before September 23, test both the VPS from venue-like mobile data/Wi-Fi and the local fallback with no internet. Capture access failures such as captive portals or client isolation in `known-issues.md` with a host workaround.

## September 23 dry run

- Use five real people and phones. First run `sample-test`, then run the real quiz once if content timing permits.
- Start the VPS build and the separately verified local fallback. Confirm that switching would mean a fresh game, not automatic continuity.
- Deliberately test duplicate nickname impersonation, valid recovery code, invalid/throttled recovery code, join/recovery acknowledgement retry, late join observer behavior, answer acknowledgement loss, lock/background, host refresh, revision-ordered updates, and export download/failure messaging.
- Time the full flow. A 15-question game should fit the seminar agenda with planned explanation pauses; document actual duration rather than assuming 12–18 minutes.
- Sign and date the checklist. After the dry run, merge only a reproducible blocker fix, rerun its test plus the final command, update `known-issues.md`, and retag only the verified artifact.

## Acceptance

- Load-test output, device matrix, network tests, and dry-run result are committed in the named documents.
- Every known issue has a severity, host-visible symptom, and concrete workaround.
- The seminar release tag corresponds to the build used in the dry run or a later blocker-only build with fresh evidence.
