# Seminar-day runbook

Use the rehearsed VPS build for the event. Keep one host laptop, its charger,
and a second person who can read the health check and PIN aloud. Run a short
practice game before scores matter so participants know the join URL/PIN,
speed scoring, and point weighting.

## VPS start-of-day check

1. Confirm the VPS container is up and the host laptop can open
   `https://quiz.rhomuel.com/healthz`.
2. Open `/host`, resume the existing host session with the configured secret,
   and verify the quiz title and question count.
3. Open `/host` on the host laptop, create a practice game, and join it from
   three phones using the displayed QR code or `/?pin=...`. Confirm a
   question, reveal, leaderboard, podium, and host-authorized results
   download.
4. End the practice game and create the actual game from `/host`. Display its
   new PIN/QR.

Never deploy a dependency or feature change on event day. A restart ends the
active in-memory game. If the VPS route becomes unavailable, announce that
the fallback starts a new game: players must scan a new QR or enter a new PIN
and rejoin; an in-progress VPS game cannot be continued on the laptop.

## LAN fallback (fresh game)

Prepare this before the event, then use it only when the VPS game cannot run:

```bash
# Replace 192.168.1.42 with the laptop's verified LAN address.
export HOST_SECRET='<long-random-secret>'
export PUBLIC_URL='http://192.168.1.42:3000'
export PORT=3000
export NODE_ENV=production
export RESULTS_DIR='./server/results'
npm start
```

The current server listens on the all-interfaces address when no host is
provided, which makes it reachable from phones on the LAN. Verify that before
the event with `ss -ltn | grep ':3000'` (or the equivalent command for the
laptop OS); do not rely on the laptop's `localhost` address. Allow TCP 3000 in
the laptop firewall for the private network only. Open the laptop's verified
LAN URL from the laptop and a phone, then generate a new QR/PIN from a new host
game.

Before event day, prebuild dependencies and client assets, test this flow with
the internet disconnected, and complete a sample game on three real phones in
under ten minutes. Verify peer-to-peer access rather than inferring it from a
shared SSID: venue Wi-Fi may use client isolation or a captive portal. Check
the venue's client limit or use a tested hotspot with enough capacity.

Keep the laptop plugged in, disable sleep, and use a tested charger. Plain
HTTP does not provide a dependable wake lock. If both the VPS and LAN fail,
continue with the prepared offline teaching slides and explain that scores
cannot be recorded.

## After the game

From `/host`, request the results download and save both CSV and sanitized JSON
exports to the approved operator location. Confirm the download completes
before closing the host tab. Do not copy `.env`, host secrets, resume tokens,
recovery codes, or generated download tokens into slides, chat, or exports.
