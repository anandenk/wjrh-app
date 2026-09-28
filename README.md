# WJRH listener app

The frontend design for the WJRH 104.9 FM listener app, and the written proposal for the
backend it needs. The backend is a proposal only: nothing is built or connected until the
board approves it.

## What's here

| Path | What it is |
|---|---|
| `claude-design-preview/` | The frontend design (`WJRH Radio.dc.html`). Runs on built-in demo data. |
| `wjrh-design-preview-cloudflare/` | The copy deployed to Cloudflare Pages. `index.html` is identical to the design file. |
| `docs/backend/` | What exists today, the gaps, the proposed `/v1` API, the rollout plan, and proposals awaiting the board. |
| `docs/content/STATION_CONTENT_BRIEF.md` | Show genres, blurbs and host bios the station needs to supply. |
| `docs/deployment/CLOUDFLARE_BOARD_PROTOTYPE.md` | How the design is deployed to Cloudflare Pages. |
| `tools/` | Read-only checks of the real stream, feed and calendar, and the current schedule snapshot. |

## Start here

1. [`docs/backend/CURRENT_CAPABILITIES.md`](docs/backend/CURRENT_CAPABILITIES.md): what the station runs today
2. [`docs/backend/FRONTEND_BACKEND_GAP_ANALYSIS.md`](docs/backend/FRONTEND_BACKEND_GAP_ANALYSIS.md): what the design needs that doesn't exist
3. [`docs/backend/API_CONTRACTS.md`](docs/backend/API_CONTRACTS.md): the proposed API, screen by screen
4. [`docs/backend/decisions/`](docs/backend/decisions/): hosting and cost (ADR-001), archive and licensing (ADR-002)

## Preview the design

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory claude-design-preview
```

Open <http://127.0.0.1:8765/WJRH%20Radio.dc.html>. It loads React from unpkg.com, so it
needs internet access.

After editing the design, refresh the Cloudflare copy:

```bash
cp "claude-design-preview/WJRH Radio.dc.html" wjrh-design-preview-cloudflare/index.html
```

## Check the real services

```bash
python3 tools/verify_backend.py      # stream, now-playing feed, calendar, schedule drift
python3 tools/fetch_schedule.py      # refresh tools/schedule.json from the calendar
```

Both are read-only against WJRH's services.

## Boundaries

- Everything the design shows (tracks, archive episodes, descriptions, covers) is demo data.
- Never publish an advance song playlist or add per-track playback. The licensing rules
  are in `docs/backend/CURRENT_CAPABILITIES.md`.
