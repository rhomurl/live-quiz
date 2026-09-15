# Pin the Node 24 LTS toolchain for reproducible seminar builds.
FROM node:24.8.0-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24.8.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Keep the process unprivileged. The results directory is owned here so an
# empty Docker volume is writable when it is first initialized.
RUN groupadd --system --gid 10001 quizapp \
  && useradd --system --uid 10001 --gid 10001 --home-dir /app --shell /usr/sbin/nologin quizapp \
  && mkdir -p /app/server/results \
  && chown -R quizapp:quizapp /app

COPY --from=build --chown=quizapp:quizapp /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=quizapp:quizapp /app/server ./server
COPY --from=build --chown=quizapp:quizapp /app/shared ./shared
COPY --from=build --chown=quizapp:quizapp /app/dist ./dist

USER quizapp
EXPOSE 3000
VOLUME ["/app/server/results"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["npm", "start"]
