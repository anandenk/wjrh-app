# WJRH listener app workspace

This workspace contains the current production web app, the editable design prototype,
deployment bundles, and backend-readiness documentation. These artifacts have different
roles and should not be merged or treated as interchangeable.

## Start here

- [`docs/backend/CURRENT_CAPABILITIES.md`](docs/backend/CURRENT_CAPABILITIES.md) — verified production services and client capabilities.
- [`docs/backend/FRONTEND_BACKEND_GAP_ANALYSIS.md`](docs/backend/FRONTEND_BACKEND_GAP_ANALYSIS.md) — what the proposed frontend expects versus what exists today.
- [`docs/backend/BACKEND_INTEGRATION_PLAN.md`](docs/backend/BACKEND_INTEGRATION_PLAN.md) — phased implementation plan and ownership questions.
- [`docs/backend/API_CONTRACTS.md`](docs/backend/API_CONTRACTS.md) — proposed versioned interfaces for backend work.
- [`docs/content/STATION_CONTENT_BRIEF.md`](docs/content/STATION_CONTENT_BRIEF.md) — station-owned copy still needed for shows and hosts.
- [`docs/backend/decisions/`](docs/backend/decisions/) — proposals awaiting board approval: Cloudflare hosting and cost, and archive licensing options.

Run the repeatable public-service check with:

```bash
python3 tools/verify_backend.py
```

The check is read-only. It verifies the stream headers, now-playing JSON and CORS,
the public Google Calendar, and drift between that calendar and
`wjrh-app/schedule.json`.

## Active artifacts

| Path | Role | Status |
|---|---|---|
| `wjrh-app/` | Production-oriented static PWA connected to the real stream, metadata feed and generated schedule | Current implementation baseline |
| `claude-design-preview/WJRH Radio.dc.html` | Editable frontend design prototype | Current design source |
| `wjrh-design-preview-cloudflare/` | Static sharing copy of the design prototype | Current board/demo deployment source |
| `wjrh-app-deploy.zip` | Rebuilt deployment package for the production-oriented PWA | Generated artifact |
| `wjrh-design-preview-cloudflare.zip` | Upload-ready package for the visual prototype | Generated artifact |

## Supporting folders

- `docs/backend/` — capability audit, gap analysis, API contracts and integration plan.
- `docs/content/` — material the station must approve or supply.
- `docs/design/` — prior frontend maps, redesign research and design prompts.
- `docs/deployment/` — deployment instructions.
- `docs/archive/` — superseded written handoffs retained for context.
- `_archive/` — non-current code and deployment artifacts retained without cluttering active sources.
- `tools/` — workspace-level read-only verification utilities.

## Important boundaries

- The design prototype contains simulated tracks, artwork, archive recordings and
  playback state. It is not evidence that those backend capabilities exist.
- `wjrh-app/` is the only implementation currently wired to WJRH production services.
- No source code or deployment configuration for the stream server, metadata publisher,
  S3/CloudFront distribution, or an application API is present in this workspace.
- Do not expose advance song playlists or interactive per-track playback. Archive work
  requires a station licensing review before implementation.

## Archived material

- `_archive/legacy-root-prototype/` contains the older root-level prototype and its
  runtime helpers; its relative files were moved together so it remains inspectable.
- `_archive/wjrh-app-legacy-design-system/` contains the unsynchronized standalone
  design-system export formerly stored inside `wjrh-app/ds/`.
- `_archive/deploy-bundles/` contains superseded ZIP files, including the prior PWA
  bundle that differed from current source and omitted the local font.

