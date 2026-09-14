# Live Quiz — Final pre-implementation check

Reviewed September 15, 2026, against all 12 revised task files and the earlier review.

**Verdict: ready to start Task 01 as contract/scaffold work; not yet ready to release independent implementation branches.** The pack has enough documents. Remaining work is to make the existing contract and ownership rules internally consistent, then prove the initial scaffold works.

The prior revision removed several original risks but introduced or retained the issues below. Its keyword checks did not establish behavioral consistency. These are specification findings, not failures observed in a running application.

> **Revision applied September 15, 2026:** The task pack now resolves the findings in this report. Task 01 has a complete revision/snapshot/credential contract and an independently verifiable bootstrap scope. Tasks 02–07 and 11 now follow it, and root `README.md` and `AGENTS.md` provide entry-point and contributor guidance. This report remains the review rationale.

## Resolve before the contract gate closes

### 1. P1 — The client would discard valid updates within the same phase

Evidence: [01-contracts.md:31](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:31), [04-client-shell.md:9](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/04-client-shell.md:9).

The contract increments `stateVersion` only when phase changes; the client applies only events with a newer version. After accepting QUESTION version 2, it would drop progress/count updates at version 2. After accepting REVEAL version 3, it would drop `player:result` at version 3. Most event payloads do not include a version at all.

**Required correction:** specify an envelope for every state event and distinguish phase identity from update ordering. One option is `stateVersion` for host transition preconditions plus a separate monotonic revision for updates and snapshots; define ordering of broadcast and player-specific messages as well. Test question → progress and reveal → private result, not only stale-phase rejection.

A local JavaScript simulation of the written rule dropped both updates. This demonstrates the specification conflict without claiming an application test passed or failed.

### 2. P1 — Snapshots and audience boundaries are still incomplete

Evidence: [01-contracts.md:47](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:47), [01-contracts.md:55](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:55), [05-player-ui.md:18](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/05-player-ui.md:18).

LOBBY has no full snapshot payload; `game:player-count` has no payload definition despite being described as defined below. Host resume lacks a defined source for the QR URL, current question context during reveal, progress, and export details. ENDED does not carry the player's own final score/rank, which the player page requires. `ownResult` and `own` appear alongside room-broadcast payloads, leaving an unsafe ambiguity about their recipients.

**Required correction:** define complete HostSnapshot and PlayerSnapshot variants for every phase, including empty and zero-player cases. Define common room events separately from single-player views. Make the snapshot sufficient to render a fresh page without a previously received event. Specify an authenticated resync operation or precisely reuse resume, including acknowledgement/snapshot ordering. Store corrected-answer information only for questions already revealed.

### 3. P1 — Host authentication rules conflict with the client and storage rules

Evidence: [04-client-shell.md:8](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/04-client-shell.md:8), [04-client-shell.md:10](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/04-client-shell.md:10), [11-gaps-and-constraints.md:12](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/11-gaps-and-constraints.md:12), [03-scoring-results.md:23](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/03-scoring-results.md:23).

Task 04 prohibits host commands before a player identity is attached; a host has its own role. Task 11 forbids storing secrets while Task 04 explicitly stores `hostSecret` in the host tab's sessionStorage. Task 03 also prohibits putting it in client state. The generic host-command rule would require `gameId` for create, even though create is what obtains that ID.

**Required correction:** initial create/join and authentication operations must work on a connected, unattached socket. Gate later host and player operations on their own authenticated roles. State the intended exception explicitly: hostSecret may exist in host-only form/tab session state, but never player state, bundle constants, URLs, exports, or logs. Apply `expectedStateVersion` only to the transition commands documented in the table.

### 4. P1 — Initial join and one-time recovery can lose access after an acknowledgement is lost

Evidence: [01-contracts.md:43](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:43), [07-reconnect-resilience.md:11](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/07-reconnect-resilience.md:11).

`player:join` has no retry identity. If the server creates a player but the acknowledgement is lost, the client has neither token nor recovery code, and retry can produce `NICKNAME_TAKEN`. Recovery invalidates the code and changes the token before knowing the response reached the client. Losing that response can strand the player with an invalid code and no new token. After one successful recovery there is also no replacement recovery-code policy.

**Required correction:** define idempotent, bounded retries for join and recovery, with private operation identifiers that return the same credential outcome only to the original operation. Define whether recovery issues a replacement code or is intentionally available once per game; expose that rule in the UI. Specify credential generation, expiry, replacement, and invalid-attempt limits. Verify the old token is revoked on recovery and that stale sockets leave private rooms when replaced.

Also restore the nickname rule Task 05 references: trimming, 2–16 characters, allowed alphabet, case-insensitive uniqueness, and normalization order. The revised Task 01 currently omits it. Without that rule, separate agents can implement different joining and recovery identities.

### 5. P1 — Task 01 cannot currently satisfy its own blocking gate independently

Evidence: [01-contracts.md:5](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:5), [01-contracts.md:116](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:116), [02-server-core.md:32](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/02-server-core.md:32).

The gate calls for a runnable scaffold but assigns entry-point source files to later tasks. It names a sample quiz and validator supplied by Task 08, which itself waits for the gate. Task 01's behavioral tests for resume and host transitions also require a server that Task 02 has not implemented. Tasks 02 and 03 retain an integrated-acceptance dependency despite the sequential scheduling.

**Required correction:** give Task 01 explicit temporary ownership of a minimal server entry, client entry, test setup, and an internal quiz fixture, with a handoff of those files to their final owners after the gate. Its acceptance should be a clean install, minimal build/start, shared imports, and actual contract/schema validation. Put server behavior tests in 02/03. Accept 02's core unit boundary before 03, then run complete-game smoke after 03. Do not let a missing later task hold the initial gate open.

The current workspace has no Git repository, package manifest, or application source. Repository initialization and the first reviewed commit are scaffold steps, not missing design documents.

### 6. P2 — Ownership and examples still need a small cleanup

Evidence: [00-README.md:21](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/00-README.md:21), [04-client-shell.md:3](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/04-client-shell.md:3), [07-reconnect-resilience.md:3](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/07-reconnect-resilience.md:3), [01-contracts.md:93](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:93).

`server/**` in the ownership table overlaps quiz content, schema, and resilience test ownership. Client-wide ownership overlaps page styles/tests and Task 07's test file. Scaffold test wiring overlaps client test setup. These can be resolved with named exceptions and explicit sequential handoffs, without more agent lanes.

The JSON example contains one option string although the schema requires four. Replace it with a real valid four-option fixture. Escape the union pipe in the `player:answer` Markdown table cell; it currently splits a three-column row into four columns. Use properly declared types or clearly labeled shape notation instead of presenting type unions as executable JavaScript.

### 7. P2 — Finalization, download, and retention policies need precise outcomes

Evidence: [03-scoring-results.md:10](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/03-scoring-results.md:10), [03-scoring-results.md:22](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/03-scoring-results.md:22), [01-contracts.md:112](/Users/rhomuel/Dev/projects/personal/live-quiz/quiz-tasks/01-contracts.md:112).

Exports are saved on PODIUM but the state machine also allows abort from PODIUM. Specify whether a completed result remains completed; otherwise repeated operations can disagree about its status. Define what happens to accepted but unscored answers when abort occurs mid-question. A zero-answer game and a player who only observed a question also need clear result fields.

Choose one download protocol, route, expiry, authorization mechanism, and error response; “short-lived URL or equivalent” leaves separate backend/UI owners making incompatible choices. Distinguish retrying a failed export operation from returning a cached failure for the same request ID.

Define how the ten-ended-game cap interacts with promised 30-minute retention, when PODIUM expires without an End click, and who cleans old disk exports. The old review recommended disk retention, but the revised pack only specifies memory retention. Keep expiry rules small and deterministic.

## Which Markdown files are actually needed?

**No additional large design document is required before starting Task 01.** The existing README, contract, page tasks, and decisions file already cover the needed planning categories. Keep corrections in those files so there is one source of truth.

| File | When to create or update | Owner / purpose |
|---|---|---|
| Existing `quiz-tasks/01-contracts.md` | Before its implementation gate closes | Integration owner: resolve findings 1–5 and fully define views/events. |
| Existing `quiz-tasks/00-README.md`, tasks 02–07, and task 11 | With the contract corrections | Align ownership, source handoffs, acceptance, credentials, and lifecycle. |
| Root `README.md` | During Task 01 scaffold | Recommended: one entry point with actual setup commands, links to tasks, current status, and restart limitation. Avoid duplicating contract definitions. |
| Root `AGENTS.md` | During Task 01, before concurrent contributors | Recommended: reading order, one-writer ownership/handoffs, shared contract rule, actual verification commands, and no secret commits. It is coordination guidance, not a prerequisite to doing the contract work. |
| `docs/quiz-authoring.md` | Task 08 | Schema usage, validation commands, sources and human content-review evidence. |
| `docs/deploy.md` | Task 09, once topology is verified | Exact deployment and results-volume instructions for the actual VPS. |
| `docs/seminar-day-runbook.md` | Task 09; ready before rehearsal | Host startup, network checks, fresh-game fallback, and offline teaching procedure. |
| `docs/dry-run-checklist.md` | QA begins; completed on September 23 | Blank checks can be prepared early. Mark them passed only with real evidence. |
| `docs/load-test-results.md` | After Task 10 actually runs tests | Measured capacity/latency, environment and build identity. |
| `docs/known-issues.md` | As implementation/testing finds issues | Symptoms, severity, and tested host workarounds. |

A separate PRD, architecture document, additional task pack, or collection of empty test reports would duplicate the current plan. A progress tracker is optional; task checkboxes in the existing README are enough.

## Proceeding from today

1. Resolve the contract findings in the existing pack. Task 01 is the correct place to do this work.
2. Create the minimal scaffold and the two short root guides while establishing actual commands and ownership handoffs.
3. Verify Task 01 on its own, then release backend, client foundation, content, and deployment preparation according to the revised dependencies.
4. Preserve the September 18 complete-sample-game milestone and September 23 dry run. Venue access and the actual upper headcount can be verified alongside local implementation; they must be settled before claiming the event setup is ready.

## Verification limits

All 12 task files were re-read. Local checks reproduced the same-phase update loss implied by the client rule, counted the invalid example's one option, and identified the unescaped table separator. Source and line references in this report were checked against the current files. Application tests, dependency installation, deployment, real-device trials, and network validation were not performed because this request is a readiness review and the application is not implemented yet.

The September 14 review describes an earlier version of the task files; its old source line numbers should be treated as historical. Use this report's references for the current remaining findings.
