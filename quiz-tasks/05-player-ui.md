# Task 05 — Player UI

Depends on: 01 and 04. **Owns:** `client/src/pages/Join.jsx`, `client/src/pages/Play.jsx`, and page-specific player styles/tests.

## Join and recovery

- `/` accepts a six-digit numeric PIN and a 2–16 character nickname under the 01 rules. Pre-fill the PIN from the full QR join URL query parameter.
- Before `player:join`, create and save a random `joinRequestId`; retry the same request ID after an acknowledgement timeout rather than creating a second player. On success, persist only the session fields allowed by 04, navigate to `/play`, and show the recovery code once with clear copy/save wording. Do not show it in the public lobby or reuse it as a nickname.
- Provide a “Recover a session” path that accepts PIN, matching nickname, and recovery code, then creates and saves a `recoveryRequestId` before calling `player:recover`. Retry the same request ID after a timeout. The recovery code remains valid until the game is purged, while successful recovery revokes the prior resume token. This is the supported flow for a fresh tab/device; it must not claim a closed-tab `sessionStorage` session will survive.
- Render every documented error as plain language, including full game, bad code, invalid nickname, and server capacity. Render nicknames as ordinary text nodes.

## Play states

- `LOBBY`: confirm the player is joined and show the connected count.
- `QUESTION`: show readable question text, four labelled answer buttons, countdown, and whether the player is eligible. A player who joined after question start sees “You join from the next question” and cannot answer.
- On tap, show “Sending answer…” and disable the selected action. Show “Answer locked” only after an accepted or already-accepted acknowledgement identifies the server-selected option. On timeout, resync before re-enabling any answer; never assume an unacknowledged tap failed.
- `REVEAL`: show explicit Correct/Incorrect text, score gained, total score, rank, and the answer explanation when the server has revealed it.
- `LEADERBOARD`, `PODIUM`, and `ENDED`: show the player's own known rank/score, with a plain end screen. Do not add confetti before the seminar.
- Show the reconnect overlay only after a brief disconnection delay. When recovery completes, replace the display from the snapshot; an already answered question must remain locked.

## Acceptance

- On iPhone-sized 320 px and 390 px viewports, maximum contract text and zoomed text remain readable without horizontal scrolling.
- Keyboard navigation and visible focus select and report an answer correctly.
- A lost answer acknowledgement followed by snapshot recovery leaves the UI showing the option accepted by the server.
- A player can refresh during a question and resume with their score and the correct remaining time; a second device with only the nickname cannot do so; a timed-out join/recovery acknowledgement succeeds safely on retry.
