# Deployment

The seminar deployment is one Node process in Docker Compose on the existing
VPS. Active games are in memory and end if the container restarts; completed
results live in the persistent `quiz-results` volume. Caddy terminates HTTPS
and proxies the site, `/api`, and Socket.IO to the same application service.

## Before the first deployment

Confirm whether Caddy runs on the VPS host or inside the Compose network. The
checked-in example uses host Caddy and binds Docker to `127.0.0.1:3000`; use
the `quiz:3000` block in [Caddyfile.example](../Caddyfile.example) only when
Caddy is a Compose service on the same network. Do not publish port 3000 on a
public interface.

Create the DNS record for `quiz.rhomuel.com` at the DNS authority, then wait
for it to resolve to the VPS. Create `/srv/live-quiz/.env` on the VPS with a
real secret (never commit it):

```dotenv
PORT=3000
NODE_ENV=production
HOST_SECRET=<long-random-secret>
PUBLIC_URL=https://quiz.rhomuel.com
RESULTS_DIR=/app/server/results
```

The application loads `.env` itself. Keep the file mode restricted to the
deployment operator. For a bind mounted results directory, create it and make
it writable by the container's UID 10001; an empty root-owned directory can
otherwise make exports fail silently:

```bash
sudo install -d -o 10001 -g 10001 -m 0750 /srv/live-quiz/results
```

The example Compose file uses a named volume, which is initialized with the
runtime user's ownership. A bind mount is acceptable when its ownership is
checked explicitly.

## Build and start

Copy the repository and the two example files to the VPS, rename
`compose.example.yml` to `compose.yml`, and install the selected Caddy site
from `Caddyfile.example`. Then run:

```bash
cd /srv/live-quiz
docker compose build --pull
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1:3000/healthz
curl -fsS https://quiz.rhomuel.com/healthz
```

The Dockerfile uses Node 24.8.0, installs from the committed lockfile, builds
the Vite client, installs production dependencies, and starts one unprivileged
Node process. The image and Compose service both expose a `/healthz`
healthcheck; wait for `docker compose ps` to show `healthy` before opening the
public URL. These commands require a Docker daemon and the checked-in build.

Verify in a browser on the public HTTPS URL that `/`, `/play`, and `/host`
load directly (including a fresh tab), and start a sample game. Caddy's
reverse proxy carries Socket.IO upgrade requests. Reload Caddy and confirm the
client reconnects and receives a current snapshot.

## Results and recreation check

After a host-authorized sample export, record the filename and verify it is
present in the mounted results volume. Recreate the container and check that
the result remains downloadable by the host. A recreation drops the old
Socket.IO connection, so resume the retained game from `/host` and request a
new download token before testing the browser download:

```bash
docker compose up -d --force-recreate quiz
docker compose exec quiz sh -c 'id && test -w /app/server/results && find /app/server/results -maxdepth 1 -type f -print'
```

The existing export files should still be listed. The resumed host session
should then download both the CSV and sanitized JSON export from the public
HTTPS URL.

Do not remove `quiz-results` during routine updates. A container restart ends
an active game by design, so schedule updates outside rehearsals and the event.

## HTTPS and DNS gate

Before the September 23 dry run, verify DNS resolution, a valid certificate,
and `curl -fsS https://quiz.rhomuel.com/healthz` from a phone on mobile data.
That phone must join and complete a sample game over the VPS route. If any of
these checks fail, use the fresh-game LAN fallback in the seminar runbook and
record the blocker for repair.
