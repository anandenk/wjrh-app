# WJRH listener app

The frontend design for the WJRH 104.9 FM listener app, the proposal for the backend it needs,
and that backend running locally. Nothing is deployed or connected to WJRH's services until the
board approves it.

## What's here

| Path | What it is |
|---|---|
| `frontend/` | The app design (`index.html`), running on built-in demo data. Also what deploys to Cloudflare Pages. |
| `apps/mobile/` | The native listener app (Expo / React Native). Not started; the plan is in [`docs/mobile-app/plan.md`](docs/mobile-app/plan.md). |
| `backend/` | The proposed `/v1` API (a Cloudflare Worker), the archive recorder, and a fake station to run them against. Local only; see [`backend/TESTING.md`](backend/TESTING.md). |
| `docs/backend-proposal/` | What exists today, the gaps, the proposed API, the rollout plan, and decisions awaiting the board. |
| `docs/mobile-app/` | The plan for the Expo app: stack, screen-to-endpoint map, rules it must keep, build order. |
| `docs/station-content-brief.md` | Show genres, blurbs and host bios the station needs to supply. |
| `docs/deploying-the-frontend.md` | How to deploy `frontend/` to Cloudflare Pages. |
| `tools/` | Read-only checks of the real stream, feed and calendar, and the current schedule snapshot. |

## Backend proposal, in reading order

1. [`current-systems.md`](docs/backend-proposal/current-systems.md): what the station runs today, and the licensing rules
2. [`gaps.md`](docs/backend-proposal/gaps.md): what the design needs that doesn't exist
3. [`api.md`](docs/backend-proposal/api.md): the proposed `/v1` API, screen by screen
4. [`rollout-plan.md`](docs/backend-proposal/rollout-plan.md): rollout phases
5. [`decisions/`](docs/backend-proposal/decisions/): [001 hosting on Cloudflare](docs/backend-proposal/decisions/001-hosting-on-cloudflare.md), [002 archive and licensing](docs/backend-proposal/decisions/002-archive-and-licensing.md)

## Preview the design

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory frontend
```

Open <http://127.0.0.1:8765/>. It loads React from unpkg.com, so it needs internet access.

## Run the backend locally

Free: no Cloudflare or Mixcloud account needed. Needs Node 20+ and Python 3.10+.

```bash
cd backend/api && npm ci && npm test      # 50 tests in Cloudflare's runtime
backend/scripts/dev.sh                    # fake station + fake Mixcloud + API on :8787
```

## Check the real services

```bash
python3 tools/check_station_services.py   # stream, now-playing feed, calendar, schedule drift
python3 tools/fetch_schedule.py           # refresh tools/schedule-snapshot.json from the calendar
```

Both are read-only against WJRH's services.

## Boundaries

- Everything the design shows (tracks, archive episodes, descriptions, covers) is demo data.
- Never publish an advance song playlist or add per-track playback. The licensing rules
  are in `docs/backend-proposal/current-systems.md`.
