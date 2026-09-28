# Running and testing the WJRH backend locally

A hands-on walkthrough for macOS or Linux. On Windows, use WSL (Ubuntu). Everything runs
on your machine against a **fake station**, so nothing touches WJRH's real stream, feed or
calendar. The whole guide takes about 20 minutes.

For how the pieces fit together, see [`README.md`](README.md).

## 0. What you need (once)

- **Node 20+** and **Python 3.10+**. Check with `node -v` and `python3 --version`.
  - On a Mac, `brew install node python` if either is missing.
- **git**.
- Docker is **not** needed.
- The first run downloads npm packages and a small Python S3 emulator, so you need internet once.

## 1. Get the code

```bash
cd wjrh-app                       # your clone
git fetch origin
git checkout claude/busy-bell-qvk1c0
```

## 2. Automated tests (about 1 minute; no servers needed)

```bash
cd backend/api
npm ci                            # installs wrangler, vitest, the Workers runtime
npm test                          # expect: Tests  47 passed (47)
npm run typecheck                 # expect: no errors
cd ../..
```

The tests run inside Cloudflare's actual runtime (workerd) with a throwaway database. They cover:
- every endpoint checked against its JSON Schema in `schemas/`;
- calendar edge cases: cancelled, moved and skipped shows, and the daylight-saving switch;
- the new schedule endpoint reproducing today's `wjrh-app/schedule.json` exactly;
- bad metadata (`Null`, URL-encoded values, feed outages);
- de-duplication of the play history;
- the audio health probe;
- join rate limits;
- the full archive review workflow.

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
| 9000 | S3 storage for archive audio (stand-in for Cloudflare R2) |
| 8787 | **The API** |
| 8765 | **The listener app** |
| 8790 | **Archive test bench** |

If it says `port … is already in use`, an earlier run is still going. `lsof -i :<port>` shows you
what it is.

## 4. One-shot end-to-end check (Terminal 2)

```bash
python3 backend/scripts/e2e.py --quick    # ~1 min: 7 checks
python3 backend/scripts/e2e.py            # ~3 min: also records, publishes and plays an episode
```

Expect `all 8 checks passed`. The script resets the fake station afterwards.

## 5. Hands-on tour

### 5a. Look at the API

Open these in a browser:
- http://127.0.0.1:8787/v1/health: `"status": "ok"`, with stream, metadata, schedule and archives
  all `"ok"`.
- http://127.0.0.1:8787/v1/now-playing: the current fictional track and the next live show.
- http://127.0.0.1:8787/v1/schedule: dated shows for the next 7 days.
- http://127.0.0.1:8787/v1/recent: station-wide history.
- `/v1/shows` and `/v1/station`.

### 5b. The listener app running on the API

Open **http://127.0.0.1:8765/?api=http://127.0.0.1:8787** and choose **Just look around**.

- **Now Playing** shows fictional tracks. The app polls every 15 s, and the track changes every 90 s.
- **Last heard** is labelled **"Station-wide · last hour"**. The same history appears on any device.
- Open **http://127.0.0.1:8765/?api=off** to switch back to the original, direct sources.
  - The label becomes "On this device · last hour".
  - Locally those sources may be unreachable, so expect missing-metadata states. That is fine.

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
| A DJ streaming from a laptop (feed says `Null`) | `curl -X POST 'http://127.0.0.1:8802/_scenario?name=Null'` | The app shows **LIVE FROM THE BOOTH / Track info not posted yet** within about 15 s. `/v1/now-playing` has `"track": null`. `/v1/recent` gains no junk entries |
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
2. Run the recorder, which in production sits on an always-on machine at the station:
   ```bash
   python3 backend/recorder/recorder.py --shows amber-on-audio
   ```
   - It logs `waiting …`, then `recording …`.
   - About 2 minutes later it logs
     `uploaded … as episode … (1933312 bytes, 121s, 0 gaps) — awaiting staff review`.
   - Then press Ctrl-C.
3. Open **http://127.0.0.1:8790/archive-player.html** and choose **Load queue**. The episode shows
   `PENDING_REVIEW`. Nothing is public yet. Choose **Mark published**.
4. Choose **Load archive**, then **Amber on Audio**, then **Load**, then **Play**.
   - Try **+30s**, **−30s** and the slider.
   - "Range probe: HTTP 206 (seekable)" confirms the storage supports seeking, as R2 will.
5. Choose **Mark unpublished**, then **Load archive** again. It shows "No published episodes yet".
   The full history (who registered, reviewed, published and unpublished it) is kept:
   ```bash
   curl -H 'Authorization: Bearer dev-admin-token' 'http://127.0.0.1:8787/v1/admin/audit'
   ```
6. Reset the calendar with `curl -X POST 'http://127.0.0.1:8803/_scenario?name=snapshot'`.

### 5e. The interest form

1. In the app, tap the **i** button (About), then **Host a show**.
2. Enter an email and submit. You should see **SENT TO THE STATION / Interest received**.
3. The dev provider just stores it:

```bash
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
4. In the app, go to **Schedule**, then **Friday**, then **Supercut**. The blurb appears under the
   title and the bio appears under **Hosted by**.

This is how the answers to `docs/content/STATION_CONTENT_BRIEF.md` get into the app. Revert the file
afterwards with `git checkout backend/content/shows.json` if it was only a test.

## 6. Stop and reset

- **Ctrl-C** in Terminal 1 stops every service.
- `rm -rf backend/.dev-state` wipes the local database, recordings, logs and Python tools. The next
  `dev.sh` rebuilds them.

## 7. Against the real station

This needs a network that can reach WJRH's services, such as campus Wi-Fi.

```bash
python3 tools/verify_backend.py            # real stream, feed and calendar (read-only)
python3 tools/verify_backend.py --local    # the same checks against the fake station
```

To replace the reconstructed calendar fixture with a real capture, see "About the fixtures" in
[`README.md`](README.md).

## Troubleshooting

| Problem | Fix |
|---|---|
| `port … is already in use` | An earlier run is still up: `lsof -i :<port>`, then stop that process |
| `npm ci` errors, or wrangler says the workerd binary is missing | `rm -rf node_modules && npx npm@11 ci && npm rebuild` |
| Something didn't start | Logs are in `backend/.dev-state/logs/` (`api.log`, `fake-station.log`, `s3.log`, `pwa.log`) |
| The app still shows old data after switching `?api=` | Hard-reload. The API setting is remembered per tab, and `?api=off` clears it |
