# Task 04 — Client Foundation, State Synchronization, and Accessible Components

Depends on: 01. **Owns:** `client/` except the named page files in 05 and 06; specifically `src/lib/**`, `src/components/**` other than `components/host/**`, `src/styles/**`, `src/App.jsx`, `src/main.jsx`, `vite.config.js`, and client tests.

## Required behavior

- Use React 18, React Router, and Vite. Routes are `/` (Join), `/play` (Play), `/host` (Host), with unknown paths redirecting to `/`. Configure `/api` and `/socket.io` Vite proxies with WebSocket support.
- Export one Socket.IO instance configured for reconnect. Initial create/join/resume/recover may run on a connected unattached socket. Do not emit answers, transition commands, exports, or resync while disconnected or before the corresponding host/player role is authenticated.
- Implement a `useGameSnapshot` store that replaces local game state from `game:snapshot` and applies room/host/player events only when their monotonic `revision` is newer than the last applied revision for the same game. `stateVersion` is only for host command preconditions. It must correctly hydrate every role/state fixture from 01.
- Implement `session.js` for player `gameId`, PIN, player ID, resume token, nickname, pending `joinRequestId`, and pending `recoveryRequestId` in `sessionStorage`; never store recovery codes, answer keys, or full game state. Implement a separate `hostSession.js` that retains `{ gameId, pin, hostSecret }` only in the current host browser tab. The host secret is permitted only in this isolated host session and form state.
- Implement `useServerClock`. On every envelope, record `offsetMs = serverNowMs - Date.now()` and render `max(0, endsAtMs - (Date.now() + offsetMs))`. On browser visibility return, call authenticated `game:resync`; do not assume a Socket.IO reconnect event occurred.
- Implement a single `emitWithAck` helper with a bounded timeout. It never leaves stale answer events queued while offline. Its caller can reconcile from a snapshot after a timeout.
- Provide `AnswerButton` with A–D text labels, distinct shapes, color, keyboard focus, and accessible names. Provide `Countdown`, `Leaderboard`, `Podium`, `QRCode`, `FullscreenButton`, and a status/reconnect overlay. Use plain CSS with tokens; no UI framework or chart library.
- Keep the normal responsive viewport meta tag. Do not disable user zoom. Use safe-area padding, visible focus styles, contrast-tested colors, `prefers-reduced-motion`, and layouts that remain usable with the schema's maximum text length at 320 px and browser zoom.
- Wake lock is optional and progressive: request only in a visible play page over HTTPS, release on exit, and reacquire only if still useful after visibility returns. The app remains fully functional when unsupported or unavailable.

## Tests and acceptance

- Unit tests cover the correct clock-sign calculation, revision ordering within one state, stale revision rejection, state-version use only for host transitions, player/host session allowlists, offline command suppression, and role/state fixture rendering.
- `npm run build` produces the production client. Development proxy tests establish that API and Socket.IO traffic reach the server.
- Shared components expose explicit text for correct/incorrect state and work with keyboard navigation. They do not rely on color, animation, or a wake lock.
- Page tasks receive documented hooks and fixture props; their independent acceptance does not claim a complete server integration until 07/10.
