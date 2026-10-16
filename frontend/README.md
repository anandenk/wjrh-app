# Frontend

The WJRH listener app design. `index.html` holds every screen, its preview-state logic and
its demo data. This folder is also exactly what gets deployed to Cloudflare Pages (see
`../docs/deploying-the-frontend.md`).

| File | Purpose |
|---|---|
| `index.html` | The design |
| `support.js`, `react-*.js` | The runtime it needs |
| `assets/` | Images, with credits in [`assets/station-content-sources.md`](assets/station-content-sources.md) and [`assets/recent-cover-sources.md`](assets/recent-cover-sources.md) |
| `fonts/` | Barlow Condensed display face and its licence (`OFL.txt`) |
| `_headers` | Cloudflare Pages headers: no search indexing, basic security headers |

## Preview

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/>. React loads from unpkg.com, so the preview needs internet
access.

## Demo data

Tracks, archive dates, album covers, show descriptions and the on-air clock are fixtures.
`../docs/backend-proposal/api.md` maps each one to the endpoint that would replace it.

## Palette

The default `lafayette` palette uses Lafayette maroon for live/on-air, warm gold, and cream
surfaces. The other palettes remain available in the Claude Design palette control.
