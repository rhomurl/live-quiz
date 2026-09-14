# Task 07 — Resilience Integration and Recovery Evidence

Depends on: 02, 03, 04, 05, and 06. **Owns:** `server/test/resilience.test.js`, `client/src/lib/reconnect.test.js`, this manual test procedure, and recorded evidence. The Backend owner changes server files; the Client Foundation owner changes shared client files. Do not create a third concurrent editor for those source files.

## Integration requirements

- On every Socket.IO `connect`, a saved player session calls `player:resume`; on a valid response, replace local state with `game:snapshot`. If the game is gone, clear the session and return to join. A reconnect without a valid token must never reclaim a player by nickname.
- On visibility return, request a fresh snapshot through the same authenticated path even when Socket.IO did not reconnect. Recalculate the countdown from `serverNowMs` and `endsAtMs`.
- If an old and new socket overlap, a successful resume binds the new socket first. The old socket's disconnect callback must compare its ID with the current ID before marking a player disconnected.
- A player who has answered sees the accepted option locked after resume. If a client timed out before acknowledgement, it resyncs first and accepts the server's answer record as final.
- `player:recover` resolves the retained game by PIN, requires its matching nickname, persistent recovery code, and retryable `recoveryRequestId`, revokes the prior resume token, issues a replacement token, and preserves score. Invalid attempts are throttled. The recovery code expires only when the game is purged.
- Host refresh resumes with the current host secret from tab session storage. Host disconnect does not stop a question timer. A game with no resumed host for 15 minutes is aborted and exports partial results.
- New players may observe a current question but cannot answer it. Existing players may resume to PODIUM/ENDED while their game remains retained. A server restart gives a controlled `GAME_NOT_FOUND` experience; recovery of active state is intentionally out of scope.

## Automated cases

Add server/client tests for: nickname-only impersonation rejection; valid token replacement; stale-socket disconnect safety; join/recovery acknowledgement retry; persistent recovery-code verification and expiry at purge; answer acknowledgement loss followed by snapshot reconciliation; hidden-page resync; same-state revision ordering; retained podium resume; and expired game cleanup. Assert that resume credentials never appear in a room event, snapshot for another player, raw result JSON, or server log fixture.

## Manual rehearsal cases

1. Answer question two, lock the phone for 30 seconds, and unlock during question three. Verify score, accepted answer state, and countdown are correct.
2. Refresh the tab during a question. Verify secure resume and no duplicate answer.
3. Open a fresh tab/device and recover with the saved recovery code. Verify the old session is superseded, the new token works, and a repeated recovery retry returns a usable credential outcome.
4. Put a phone in airplane mode for 10 seconds during a question. Verify the overlay, resync, and server-selected answer state.
5. Try the same nickname from a second phone without a token. Verify it cannot claim the first player's record.
6. Refresh the host in QUESTION and LEADERBOARD. Verify controls use current state version and do not double advance.
7. Restart the server mid-game. Verify no white screen, clear game-ended messaging, and no false promise of recovery.

## Acceptance

- All automated resilience tests pass against the integrated server/client build.
- The manual cases are dated in `docs/dry-run-checklist.md` with device/browser results.
- A resumed player retains only their own score and never receives another player's result, token, or unrevealed answer.
