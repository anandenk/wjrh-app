#!/usr/bin/env bash
# Run the API locally against the REAL WJRH stream, now-playing feed and calendar.
# Read-only: it only fetches from the station. Archives are off, as in production.
#
#   API  http://127.0.0.1:8797   (a different port from dev.sh, so both can run at once)
#
# For a physical phone on the same Wi-Fi:  API_HOST=0.0.0.0 backend/scripts/dev-real.sh  and use
# http://<this computer's LAN IP>:8797. The stream URL it hands out is the real HTTPS one, so the phone's
# audio, lock screen and reminders can be tested against live station data.
#
# Uses its own local database in backend/.dev-state/real, separate from dev.sh.
# Ctrl-C stops it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$ROOT/backend/.dev-state/real"
PORT="${PORT:-8797}"
B="http://127.0.0.1:$PORT"
mkdir -p "$STATE"

if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
  echo "!! port $PORT is already in use. Find it with: lsof -i :$PORT" >&2
  exit 1
fi

cd "$ROOT/backend/api"
[[ -d node_modules ]] || npm ci
[[ -f .dev.vars ]] || cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply wjrh --local --env real --persist-to "$STATE" >"$STATE/migrate.log" 2>&1

set -m
npx wrangler dev --env real --test-scheduled --persist-to "$STATE" --ip "${API_HOST:-127.0.0.1}" --port "$PORT" >"$STATE/api.log" 2>&1 &
API_PID=$!
trap 'kill -TERM -- "-$API_PID" 2>/dev/null || true' EXIT
trap 'exit 130' INT TERM

for _ in $(seq 1 60); do curl -fsS -o /dev/null "$B/" 2>/dev/null && break; sleep 1; done
for cron in '*/15+*+*+*+*' '*/5+*+*+*+*' '*+*+*+*+*'; do
  curl -fsS -o /dev/null "$B/__scheduled?cron=$cron"
done

cat <<INFO

WJRH API is up against the real station.
  Health        $B/v1/health
  Now playing   $B/v1/now-playing
  Log           $STATE/api.log
Ctrl-C to stop.
INFO

# Tick the cron jobs roughly like production would.
tick=0
while true; do
  sleep 60 & wait $!
  tick=$((tick + 1))
  curl -fsS -o /dev/null "$B/__scheduled?cron=*+*+*+*+*" || true
  (( tick % 5 == 0 ))  && curl -fsS -o /dev/null "$B/__scheduled?cron=*/5+*+*+*+*" || true
  (( tick % 15 == 0 )) && curl -fsS -o /dev/null "$B/__scheduled?cron=*/15+*+*+*+*" || true
done
