# DoB Innovation & Learning Hub — production image (Railway).
# Includes ffmpeg (live-class recordings → MP4) and pg_dump 18 (nightly backups).
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg openssl ffmpeg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-18 \
 && apt-get purge -y gnupg && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first for layer caching (.npmrc keeps dev deps: prisma CLI and tsx run the scripts).
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN NODE_ENV=production npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_DIR=/data/storage
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
