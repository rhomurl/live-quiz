# Task 06 — Host UI

Depends on: 01 and 04. **Owns:** `client/src/pages/Host.jsx`, `client/src/components/host/**`, and host-specific styles/tests.

## Required behavior

- `/host` first attempts `host:resume` from the tab-only host session. If the game is retained, replace state from its complete host snapshot; if not, clear the session and show the create form. On visibility return, use authenticated `game:resync`.
- The create form requests the host secret, fetches validated quiz metadata, and calls `host:create`. Never send the secret to a player route, analytics event, URL, or QR code.
- In the lobby, show a large PIN, the full `joinUrl` QR code, host-only nickname roster, connected/total count, and Start. The host roster updates from `host:lobby`, not only a count event.
- In question state, show the question number, question and options, countdown, and host-only `answered / eligible` progress. Correct answer/explanation must not render before `REVEAL`.
- In reveal state, show the correct option, explanation, and a four-bar distribution made with semantic text plus divs. In leaderboard and podium states, show contract rank/score data and ordinary Next/End controls.
- Every transition command uses the current `gameId`, `stateVersion`, and a generated `requestId`; create and results-download use the payloads defined in Task 01. Apply incoming host views by revision. Disable the initiating control while pending. On an acknowledgement timeout or `STALE_COMMAND`, resync and render the server state rather than issuing another blind transition.
- `host:abort` requires an explicit in-page confirmation and reports that a partial result export is being attempted. End/abort may display the podium/end screen while `host:export-status` is pending. Show a real download action only after `saved`; show retry and a clear error after `failed`.
- Provide fullscreen and keyboard shortcuts only when focus is not in an input. Space/Right Arrow trigger the same guarded command as the visible control. Support 1920×1080 and 1280×720 without hiding controls.

## Acceptance

- Refreshing host during LOBBY, QUESTION, REVEAL, LEADERBOARD, PODIUM, and ENDED loads the corresponding host snapshot without leaking unrevealed data.
- A delayed duplicate Next command cannot skip a state.
- Successful and failed exports are visually distinct; results download is unavailable to an unauthenticated player.
- A full sample game can be controlled with a laptop and three phones after task 07 integrates resume behavior.
