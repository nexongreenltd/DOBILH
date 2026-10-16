#!/usr/bin/env bash
# Self-contained PostgreSQL cluster for local development (port 5433).
# Use your own server instead by pointing DATABASE_URL in .env elsewhere.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/.dev-db"
PORT="${DEV_DB_PORT:-5433}"
PGBIN="$(dirname "$(command -v pg_ctl)")"

case "${1:-start}" in
  init)
    if [ ! -d "$DIR/data" ]; then
      mkdir -p "$DIR"
      "$PGBIN/initdb" -D "$DIR/data" -U dob --auth=trust >/dev/null
      echo "Initialized cluster at $DIR/data"
    fi
    "$0" start
    "$PGBIN/createdb" -h localhost -p "$PORT" -U dob dob_lms 2>/dev/null || true
    echo "Database ready: postgresql://dob@localhost:$PORT/dob_lms"
    ;;
  start)
    "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k /tmp" -l "$DIR/postgres.log" status >/dev/null 2>&1 \
      || "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k /tmp" -l "$DIR/postgres.log" -w start
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$DIR/data" stop
    ;;
esac
