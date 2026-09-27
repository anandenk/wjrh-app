#!/usr/bin/env bash
# Start the whole local WJRH stack:
#
#   fake station  stream :8801  now-playing :8802  calendar :8803
#   S3 storage    :9000  (moto by default; S3_BACKEND=minio uses Docker)
#   API           :8787  (wrangler dev, local D1)
#   PWA           :8765  → open http://127.0.0.1:8765/?api=http://127.0.0.1:8787
#   dev tools     :8790  → archive test bench
#
# Options:  --with-recorder   also run the archive recorder for every show
# Ctrl-C stops everything.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/backend"
STATE="$BACKEND/.dev-state"
LOGS="$STATE/logs"
mkdir -p "$LOGS"
WITH_RECORDER=0
[[ "${1:-}" == "--with-recorder" ]] && WITH_RECORDER=1

PIDS=()
cleanup() {
  echo; echo "stopping…"
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  if [[ "${S3_BACKEND:-moto}" == "minio" ]]; then docker compose -f "$BACKEND/mocks/docker-compose.yml" stop minio >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM

wait_for() { # url, name
  for _ in $(seq 1 60); do curl -fsS -o /dev/null "$1" 2>/dev/null && return 0; sleep 1; done
  echo "!! $2 did not start; see $LOGS" >&2; exit 1
}

echo "== Python tools"
if [[ ! -x "$STATE/venv/bin/python" ]]; then
  python3 -m venv "$STATE/venv"
  "$STATE/venv/bin/pip" install -q -r "$BACKEND/requirements-dev.txt"
fi
PY="$STATE/venv/bin/python"

echo "== fake station"
"$PY" "$BACKEND/mocks/fake_station.py" >"$LOGS/fake-station.log" 2>&1 & PIDS+=($!)
wait_for http://127.0.0.1:8802/_scenario "fake station"

echo "== archive storage (${S3_BACKEND:-moto})"
if [[ "${S3_BACKEND:-moto}" == "minio" ]]; then
  docker compose -f "$BACKEND/mocks/docker-compose.yml" up -d minio minio-init >/dev/null
  wait_for http://127.0.0.1:9000/minio/health/live "MinIO"
else
  "$STATE/venv/bin/moto_server" -H 127.0.0.1 -p 9000 >"$LOGS/s3.log" 2>&1 & PIDS+=($!)
  wait_for http://127.0.0.1:9000/ "S3 emulator"
  curl -fsS -X PUT http://127.0.0.1:9000/wjrh-archive -o /dev/null
  # Listeners fetch archive media directly, like an R2 public bucket.
  curl -fsS -X PUT 'http://127.0.0.1:9000/wjrh-archive?policy' -o /dev/null -H 'Content-Type: application/json' --data-binary \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::wjrh-archive/*"]}]}'
fi

echo "== API"
cd "$BACKEND/api"
[[ -d node_modules ]] || npm ci
[[ -f .dev.vars ]] || cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply wjrh --local --env dev --persist-to "$STATE/wrangler" >"$LOGS/migrate.log" 2>&1
npx wrangler dev --env dev --test-scheduled --persist-to "$STATE/wrangler" --ip 127.0.0.1 --port 8787 >"$LOGS/api.log" 2>&1 & PIDS+=($!)
wait_for http://127.0.0.1:8787/ "API"
for cron in '*/15+*+*+*+*' '*/5+*+*+*+*' '*+*+*+*+*'; do
  curl -fsS -o /dev/null "http://127.0.0.1:8787/__scheduled?cron=$cron"
done
cd "$ROOT"

echo "== PWA and dev tools"
python3 -m http.server 8765 --bind 127.0.0.1 --directory "$ROOT/wjrh-app" >"$LOGS/pwa.log" 2>&1 & PIDS+=($!)
python3 -m http.server 8790 --bind 127.0.0.1 --directory "$BACKEND/devtools" >"$LOGS/devtools.log" 2>&1 & PIDS+=($!)

if [[ $WITH_RECORDER == 1 ]]; then
  echo "== recorder"
  "$PY" "$BACKEND/recorder/recorder.py" --shows all >"$LOGS/recorder.log" 2>&1 & PIDS+=($!)
fi

cat <<INFO

WJRH local stack is up.
  PWA on the API     http://127.0.0.1:8765/?api=http://127.0.0.1:8787   (?api=off to go back)
  API                http://127.0.0.1:8787/v1/health
  Archive test bench http://127.0.0.1:8790/archive-player.html
  Logs               $LOGS

This script ticks the cron jobs every 1/5/15 minutes. Trigger one immediately with:
  curl 'http://127.0.0.1:8787/__scheduled?cron=*+*+*+*+*'      now-playing collector
  curl 'http://127.0.0.1:8787/__scheduled?cron=*/15+*+*+*+*'   schedule refresh
Change what the fake station does:
  curl -X POST 'http://127.0.0.1:8802/_scenario?name=Null'      (see backend/README.md)
Ctrl-C to stop.
INFO

# Tick the cron jobs roughly like production would.
tick=0
while true; do
  sleep 60
  tick=$((tick + 1))
  curl -fsS -o /dev/null 'http://127.0.0.1:8787/__scheduled?cron=*+*+*+*+*' || true
  (( tick % 5 == 0 ))  && curl -fsS -o /dev/null 'http://127.0.0.1:8787/__scheduled?cron=*/5+*+*+*+*' || true
  (( tick % 15 == 0 )) && curl -fsS -o /dev/null 'http://127.0.0.1:8787/__scheduled?cron=*/15+*+*+*+*' || true
done
