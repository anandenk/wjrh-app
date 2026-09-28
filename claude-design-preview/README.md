# WJRH listener app design

`WJRH Radio.dc.html` is the complete design: every screen, its preview-state logic, and its
demo data. `support.js` and the three React shims are the runtime it needs; `fonts/` and
`assets/` hold its display face and images.

## Preview

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/WJRH%20Radio.dc.html`. React loads from unpkg.com, so the
preview needs internet access.

## Demo data

Tracks, archive dates, album covers, show descriptions and the on-air clock are fixtures.
`../docs/backend/API_CONTRACTS.md` maps each one to the endpoint that would replace it.
Image credits are in `assets/station-content-sources.md` and
`assets/recent-cover-sources.md`; the font licence is `fonts/OFL.txt`.

## Palette

The default `lafayette` palette uses Lafayette maroon for live/on-air, warm gold, and cream
surfaces. The other palettes remain available in the Claude Design palette control.
