# WJRH listener app: project guide

@AGENTS.md

The shared rules above apply to Claude Code and Codex. This file holds the repository map and common commands;
current implementation, verification and next steps live in
[`docs/mobile-app/status.md`](docs/mobile-app/status.md). The shared workflow and documentation ownership are in
[`docs/workflow.md`](docs/workflow.md).

## Where things are

| Path | Purpose |
|---|---|
| [`docs/mobile-app/status.md`](docs/mobile-app/status.md) | Current state, verification evidence, pending checks, decisions and next steps |
| [`docs/mobile-app/plan.md`](docs/mobile-app/plan.md) | Architecture, screen-to-endpoint map and build order |
| [`apps/mobile/README.md`](apps/mobile/README.md) | Native app layout, scripts and environment variables |
| [`backend/README.md`](backend/README.md), [`backend/TESTING.md`](backend/TESTING.md) | API/recorder layout and backend run/check procedures |
| `backend/schemas/` | Source of truth for API response shapes; mobile types are generated from these |
| [`docs/mobile-app/iphone-test-checklist.md`](docs/mobile-app/iphone-test-checklist.md) | Physical-device checks and results log |
| [`docs/mobile-app/archive-demo.md`](docs/mobile-app/archive-demo.md) | Sample Archive, demo boundaries and phone-build recipe |
| [`docs/mobile-app/design-polish.md`](docs/mobile-app/design-polish.md) | Visual comparison and intentional differences from the HTML design |
| [`docs/backend-proposal/`](docs/backend-proposal/) | API contract, production rollout and station-owned decisions |
| `frontend/index.html` | Visual reference; built-in demo data, not the station's production app |
| [`docs/mobile-app/audio-spike.md`](docs/mobile-app/audio-spike.md), [`docs/mobile-app/phase0-findings.md`](docs/mobile-app/phase0-findings.md) | Dated findings; preserve the original results and versions |

The old `~/Downloads/design_handoff_wjrh_app` folder is superseded. The initial workspace is preserved in git
(`a953a95`); tags `archive/api-wired-design` and `archive/audio-spike` preserve the removed experiments.

## Common commands

Run from the repository root unless a command changes directory. These are references, not instructions to run
every command: select the checks allowed by the task. Server/app commands need their own terminal and cleanup.
Follow the no-audio rule in `AGENTS.md` before any app or emulator work.

```bash
(cd backend/api && npm ci && npm test && npm run typecheck)
backend/scripts/dev.sh                         # fake station + API, :8787
backend/scripts/dev-real.sh                    # real upstreams, read-only; API :8797
API_HOST=0.0.0.0 backend/scripts/dev-real.sh     # trusted Wi-Fi only, never campus Wi-Fi
python3 backend/scripts/e2e.py --quick          # requires the running dev.sh stack
python3 tools/check_station_services.py        # read-only real-service check
python3 tools/check_docs.py                    # local links/anchors/imports; no network
(cd apps/mobile && npm ci && npm run typecheck && npm test && npm run check:contract && npm run lint)
(cd apps/mobile && npm run smoke:api)           # requires the running dev.sh stack
(cd apps/mobile && npm run smoke:fixtures)      # no server
(cd apps/mobile && npm run gen:types)           # after backend/schema changes; commit generated files
(cd apps/mobile && npx expo-doctor)             # dependency health, not runtime verification
```

Simulator/emulator setup, silent testing and machine-specific gotchas are in the status doc. Script/env-var
details belong in the app/backend READMEs; check those and the code before copying an old command.
