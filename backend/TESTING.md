# Running and testing the WJRH backend locally

A hands-on walkthrough for macOS or Linux. On Windows, use WSL (Ubuntu). Everything runs
on your machine against a **fake station**, so nothing touches WJRH's real stream, feed or
calendar. The whole guide takes about 20 minutes.

For how the pieces fit together, see [`README.md`](README.md).

## 0. What you need (once)

- **Node 24** (also used in CI) and **Python 3.10+**. Check with `node -v` and `python3 --version`.
  - On a Mac, install missing tools with `brew install node@24` and `brew install python`; follow Homebrew's
    PATH instructions so `node -v` selects Node 24.
- **git**.
- Docker is **not** needed.
- The first run downloads npm packages and a small Python S3 emulator, so you need internet once.

## 1. Get the code

```bash
cd wjrh-app                       # your clone
git fetch origin
git switch -c codex/backend-walkthrough origin/main
```

## 2. Automated tests (about 1 minute; no servers needed)

```bash
cd backend/api
npm ci                            # installs wrangler, vitest, the Workers runtime
npm test                          # all tests must pass (51 passed in PR #26)
npm run typecheck                 # expect: no errors
cd ../..
```

The tests run inside Cloudflare's actual runtime (workerd) with a throwaway database. They cover:
- every endpoint checked against its JSON Schema in `schemas/`;
- calendar edge cases: cancelled, moved and skipped shows, and the daylight-saving switch;
- the new schedule endpoint reproducing the legacy snapshot exactly (`mocks/fixtures/schedule-snapshot.json`, the frozen
  snapshot that matches the fixture calendar; `tools/schedule-snapshot.json` tracks the real calendar and is not used here);
- bad metadata (`Null`, URL-encoded values, feed outages);
- de-duplication of the play history;
- the audio health probe;
- join rate limits;
- the full archive review workflow, for self-hosted and Mixcloud episodes.

## 3. Start the local station (Terminal 1)

```bash
backend/scripts/dev.sh
```

The first run takes under a minute. It prints **"WJRH local stack is up."** and the URLs below.
Leave it running. **Ctrl-C** stops everything.

| Port | What |
|---|---|
| 8801 | Fake audio stream (a test tone, not music) |
| 8802 | Fake now-playing feed (fictional tracks, a new one every 90 s) |
| 8803 | Fake Google Calendar (the current WJRH schedule) |
| 8804 | Fake Mixcloud (upload API, cloudcast lookup, a stand-in player) |
| 9000 | S3 storage for archive audio (stand-in for Cloudflare R2) |
| 8787 | **The API** |
| 8790 | Archive test bench |

If it says `port … is already in use`, an earlier run is still going. `lsof -i :<port>` shows you
what it is.

## 4. One-shot end-to-end check (Terminal 2)

```bash
python3 backend/scripts/e2e.py --quick    # ~1 min: 7 checks
python3 backend/scripts/e2e.py            # ~7 min: also records two episodes (own storage, then Mixcloud)
```

Expect `all 7 checks passed` with `--quick`, or `all 9 checks passed` for the full run.
The script resets the fake station afterwards.

## 5. Hands-on tour

### 5a. Look at the API

Open these in a browser:
- http://127.0.0.1:8787/v1/health: `"status": "ok"`, with stream, metadata, schedule and archives
  all `"ok"`.
- http://127.0.0.1:8787/v1/now-playing: the current fictional track and the next live show.
- http://127.0.0.1:8787/v1/schedule: dated shows for the next 7 days.
- http://127.0.0.1:8787/v1/recent: station-wide history.
- `/v1/shows` and `/v1/station`.

### 5b. Pointing a frontend at the API

The native app already reads the API: follow [`../apps/mobile/README.md`](../apps/mobile/README.md) and set
`EXPO_PUBLIC_API_BASE=http://127.0.0.1:8787` for the iOS simulator (`http://10.0.2.2:8787` for the Android emulator).
CORS is open in dev. The HTML design remains on demo data; its earlier API wiring (`?api=` switches) is preserved
at tag `archive/api-wired-design` (commit `37cf17c`).

### 5c. Break the station on purpose

Run these in Terminal 2. Jobs normally run on a timer. To see a change immediately, trigger the
matching job:

```bash
curl 'http://127.0.0.1:8787/__scheduled?cron=*+*+*+*+*'       # collector (history)
curl 'http://127.0.0.1:8787/__scheduled?cron=*/5+*+*+*+*'     # health probes
curl 'http://127.0.0.1:8787/__scheduled?cron=*/15+*+*+*+*'    # schedule refresh
```

| Simulate | Command | What you'll see |
|---|---|---|
| A DJ streaming from a laptop (feed says `Null`) | `curl -X POST 'http://127.0.0.1:8802/_scenario?name=Null'` | The native app shows **Waiting for track information** after the next successful poll (about 15 s). `/v1/now-playing` has `"track": null`; the LIVE/AUTOMATED pill still follows the schedule. `/v1/recent` gains no junk entries |
| Metadata feed down | `curl -X POST 'http://127.0.0.1:8802/_scenario?name=error'` | `/v1/now-playing` keeps the last track, with `"stale": true` |
| Stream connected but silent | `curl -X POST 'http://127.0.0.1:8801/_scenario?name=silent'`, then the health job | `/v1/health`: stream `"down"`. The probe checks for real audio bytes, not just a 200 |
| Schedule changes this week | `curl -X POST 'http://127.0.0.1:8803/_scenario?name=cancelled'`, then the schedule job | `/v1/schedule`: at their next occurrence, Monday's **The Rodeo** is gone, Friday's **Supercut** is `"cancelled": true`, and Wednesday's **Basement Jams** has moved to 8 PM. If today is one of those weekdays, the change is a week out, so widen the range with `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Calendar returns garbage | `curl -X POST 'http://127.0.0.1:8803/_scenario?name=malformed'`, then the schedule job | `/v1/schedule` still serves the last good schedule. `/v1/health` shows `lastError` |

Put everything back:

```bash
curl -X POST 'http://127.0.0.1:8801/_scenario?name=ok'
curl -X POST 'http://127.0.0.1:8802/_scenario?name=rotating'
curl -X POST 'http://127.0.0.1:8803/_scenario?name=snapshot'
curl 'http://127.0.0.1:8787/__scheduled?cron=*/15+*+*+*+*'
curl 'http://127.0.0.1:8787/__scheduled?cron=*/5+*+*+*+*'
```

`curl http://127.0.0.1:8802/_scenario` lists every scenario. Replace 8802 with 8801 or 8803 for the
other mocks.

### 5d. Record, review, publish and play an archive episode

1. Make the fake calendar schedule a 2-minute show starting next minute:
   ```bash
   curl -X POST 'http://127.0.0.1:8803/_scenario?name=demo-now'
   curl 'http://127.0.0.1:8787/__scheduled?cron=*/15+*+*+*+*'
   ```
2. Run the recorder, which in production runs on a small always-on cloud server:
   ```bash
   python3 backend/recorder/recorder.py --shows amber-on-audio
   ```
   - It logs `waiting …`, then `recording …`.
   - About 2 minutes later it logs
     `uploaded … as episode … (1933312 bytes, 121s, 0 gaps) — awaiting staff review`.
   - Then press Ctrl-C.
3. Open **http://127.0.0.1:8790/archive-player.html** (the staff test bench) and choose
   **Load queue**. The episode shows `PENDING_REVIEW`. Nothing is public yet. Choose
   **Mark published**.
4. `curl http://127.0.0.1:8787/v1/shows/amber-on-audio/archives` now lists the episode. In the test
   bench, **Load archive → Load → Play** plays it and shows "Range probe: HTTP 206 (seekable)". That
   confirms the storage supports seeking, as R2 will.
5. In the test bench choose **Mark unpublished**. The episode disappears from the public list.
   The full history (who registered, reviewed, published and unpublished it) is kept:
   ```bash
   curl -H 'Authorization: Bearer dev-admin-token' 'http://127.0.0.1:8787/v1/admin/audit'
   ```
6. Reset the calendar with `curl -X POST 'http://127.0.0.1:8803/_scenario?name=snapshot'`.

### 5d′. The same, through Mixcloud

Decision 002 recommends Mixcloud for per-show music archives. Locally, the fake Mixcloud on :8804
stands in for it, so no account is needed.

1. Repeat step 1 above (`demo-now`, then the schedule cron).
2. Record to Mixcloud instead of our storage:
   ```bash
   python3 backend/recorder/recorder.py --shows amber-on-audio --archive-to mixcloud
   ```
   It uploads the recording **unlisted**, with a tracklist taken from `/v1/recent`, then registers the
   Mixcloud key with the API. The log ends `uploaded … to Mixcloud as /wjrh/… — awaiting staff review`.
3. Publish it from the test bench as in step 3. `/v1/shows/amber-on-audio/archives` now returns
   `"provider": "mixcloud"`, `"audioUrl": null`, and a `mixcloud.widgetUrl`. A frontend embeds that URL
   (an iframe on the web, a WebView in a native app) rather than playing audio itself.
4. `curl http://127.0.0.1:8804/wjrh/cloudcasts/` shows what "Mixcloud" holds. Like the free tier, the
   fake account refuses an 11th upload.

With a real account the only changes are the recorder's `MIXCLOUD_UPLOAD_URL`
(`https://api.mixcloud.com/upload/`) and `MIXCLOUD_ACCESS_TOKEN`, and the API's `MIXCLOUD_API_BASE`
and `MIXCLOUD_WIDGET_URL` (already set to the real ones outside `[env.dev]`).

### 5e. The interest form

The design sends people to GroupMe and email rather than a form, so nothing calls `/v1/join` yet. To
try it:

```bash
curl -X POST http://127.0.0.1:8787/v1/join -H 'Content-Type: application/json' \
  -d '{"email": "listener@example.edu", "source": "listener-app"}'
cd backend/api
npx wrangler d1 execute wjrh --local --env dev --persist-to ../.dev-state/wrangler --json \
  --command "SELECT email, created_at FROM join_outbox"
cd ../..
```

### 5f. Editing show content, as the station would

1. In `backend/content/shows.json`, find `"id": "supercut"`.
2. Fill in:
   - `"description"`: one or two sentences, at most 200 characters;
   - `"hostBio"`: one sentence, at most 140 characters.
3. Save. The API reloads by itself within a few seconds.
4. `curl http://127.0.0.1:8787/v1/shows/supercut` returns the new text.

This is how the answers to `docs/station-content-brief.md` get into the app. Revert the file
afterwards with `git checkout backend/content/shows.json` if it was only a test.

## 6. Stop and reset

- **Ctrl-C** in Terminal 1 stops every service.
- `rm -rf backend/.dev-state` wipes the local database, recordings, logs and Python tools. The next
  `dev.sh` rebuilds them.

## 7. Against the real station

This needs a network that can reach WJRH's services, such as campus Wi-Fi.

```bash
python3 tools/check_station_services.py   # real stream, feed and calendar (read-only)
```

To inspect a real capture while preserving the frozen parity fixtures, see "About the fixtures" in
[`README.md`](README.md).

To run the API itself against the real services (still read-only), use `backend/scripts/dev-real.sh` (port 8797).

### Reaching the API from a phone

Both `dev.sh` and `dev-real.sh` bind to `127.0.0.1`, which a phone cannot reach. Bind to the network instead, on a
Wi-Fi you trust: `API_HOST=0.0.0.0 backend/scripts/dev-real.sh`, then use `http://<this computer's LAN IP>:8797`
(`ipconfig getifaddr en0` on a Mac). With `dev.sh` the fake stream and feed stay on `127.0.0.1`, so a phone falls back
to the real stream URL. Steps for testing the app on a phone:
[`docs/mobile-app/iphone-test-checklist.md`](../docs/mobile-app/iphone-test-checklist.md).

## Troubleshooting

| Problem | Fix |
|---|---|
| `port … is already in use` | An earlier run is still up: `lsof -i :<port>`, then stop that process |
| `npm ci` errors, or wrangler says the workerd binary is missing | `rm -rf node_modules && npx npm@11 ci && npm rebuild` |
| Something didn't start | Logs are in `backend/.dev-state/logs/` (`api.log`, `fake-station.log`, `s3.log`, `devtools.log`); `dev-real.sh` uses `backend/.dev-state/real/api.log` |
| The native app still uses the old API address | Restart Metro after changing `EXPO_PUBLIC_API_BASE`; rebuild a Release app because its address is bundled. `?api=` only belongs to the archived browser prototype |
