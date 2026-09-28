# WJRH listener app

The frontend design for the WJRH 104.9 FM listener app, and the written proposal for the
backend it needs. The backend is a proposal only: nothing is built or connected until the
board approves it.

## What's here

| Path | What it is |
|---|---|
| `frontend/` | The app design (`index.html`), running on built-in demo data. Also what deploys to Cloudflare Pages. |
| `docs/backend-proposal/` | What exists today, the gaps, the proposed API, the rollout plan, and decisions awaiting the board. |
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
