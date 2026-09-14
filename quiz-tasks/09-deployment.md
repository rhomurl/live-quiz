# Task 09 — Deployment and Seminar-Day Fallback

Depends on: 01; finalize after the integrated build exists. **Owns:** `Dockerfile`, `compose.example.yml`, `.dockerignore`, `Caddyfile.example`, `docs/deploy.md`, and `docs/seminar-day-runbook.md`.

## Primary deployment: existing VPS Docker Compose stack

- Use a pinned Node 24 LTS image for build and runtime. Build the Vite client, install production dependencies deterministically from the lockfile, run one Node replica, and run the process as a non-root user.
- Mount a writable persistent host/volume path at `/app/server/results`. Test export permissions as the runtime user; a mounted root-owned empty directory must not silently break exports.
- Use `.env` on the VPS, never commit it. Include `PORT`, `NODE_ENV=production`, a non-placeholder `HOST_SECRET`, `PUBLIC_URL=https://quiz.rhomuel.com`, and an explicit results directory. The app itself loads `.env`; do not rely on undocumented process-manager options.
- Determine the actual Caddy topology before writing live commands. If Caddy runs in the Compose network, proxy to the service name and internal port. If Caddy runs on the host, publish the app only to `127.0.0.1` and proxy there. Do not expose port 3000 publicly.
- Caddy must proxy the normal site, API, and Socket.IO; its reverse proxy supports WebSocket upgrades. Confirm direct `/host` and `/play` browser loads use the application's HTML fallback.
- Create the DNS record for `quiz.rhomuel.com` immediately and verify HTTPS before the dry run. Verify a phone on mobile data completes a sample game against the VPS.

## Local fallback

- The local fallback is a fresh standalone game, not failover for an in-progress VPS game. Switching means a new PIN/QR and rejoining; communicate this to the host in the runbook.
- Bind the local server to a LAN-accessible interface, set `PUBLIC_URL` to the laptop's reachable `http://<LAN-IP>:3000` address, allow the port through the laptop firewall, and generate a new QR.
- Before event day, test three phones against the laptop with the internet disconnected. Verify the chosen venue Wi-Fi/hotspot allows peer access and has enough client capacity; shared SSID alone is not evidence.
- Prebuild dependencies/assets, plug in the laptop, disable sleep, carry a charger, and prepare slides that allow the seminar to continue if both the VPS and local network are unavailable. Wake lock is not dependable for plain HTTP fallback.

## Acceptance

- `docker compose up` runs the same built artifact locally and on the VPS; `curl https://quiz.rhomuel.com/healthz` succeeds over HTTPS.
- Direct browser loads of `/`, `/play`, and `/host` work through Caddy; Socket.IO reconnects after a Caddy reload according to the app's snapshot logic.
- A results file survives container recreation and can be downloaded by the authenticated host.
- A person following the runbook can start the local fallback and complete a sample game on three real phones without internet in ten minutes.
