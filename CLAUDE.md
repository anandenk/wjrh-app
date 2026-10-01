# WJRH listener app

WJRH 104.9 FM (Lafayette College) listener app. The owner is learning software development:
explain things plainly and briefly, and check before assuming.

## Where things are

| Path | What |
|---|---|
| `apps/mobile/` | The Expo / React Native app. **Not started yet.** |
| `docs/mobile-app/plan.md` | The app plan: stack, screen → endpoint map, rules, build order. Read this first. |
| `backend/` | The `/v1` API (Cloudflare Worker + D1), recorder, JSON schemas, fake station and fake Mixcloud. Local only, not deployed. |
| `backend/schemas/` | Source of truth for API response shapes; the app's types are generated from these. |
| `docs/backend-proposal/` | API contracts (`api.md`) and decisions: 001 Cloudflare hosting, 002 archives (Mixcloud). |
| `frontend/` | The current visual design (`index.html`). Use it as the design reference, not older copies. |

The old `~/Downloads/design_handoff_wjrh_app` folder is superseded; everything in it is in git history
(commit `c526e18`). The design wired to the API is kept at tag `archive/api-wired-design`.

## Commands

```bash
cd backend/api && npm ci && npm test   # 50 tests in Cloudflare's runtime; npm run typecheck
backend/scripts/dev.sh                 # fake station + fake Mixcloud + API on http://127.0.0.1:8787
backend/scripts/dev-real.sh            # API on http://127.0.0.1:8797 against the REAL station (read-only)
python3 backend/scripts/e2e.py --quick # end-to-end check against the running stack
python3 tools/check_station_services.py  # read-only check of the real stream, feed and calendar
```

## Where we are

Phase 0 is done: the API works against the real stream, feed and calendar with no code changes
(`docs/mobile-app/phase0-findings.md`). The audio spike (`apps/audio-spike/`, throwaway) passed on
the iOS simulator with `expo-audio`: live stream, background playback, lock-screen registration
(`docs/mobile-app/audio-spike.md`). Still to do on a real iPhone: lock-screen look, interruptions,
headphones, long background run. After that, scaffold the real app in `apps/mobile`.
Use `react-native-track-player` only if the iPhone tests fail. Xcode 27 has no Simulator app: use
DeviceHub (see the doc).

## Rules

- **Licensing (webcasting, 17 U.S.C. §114):** never show upcoming songs (upcoming shows are fine);
  show title, artist and album while a track plays; no queue, song picking, per-track replay or
  recording of the live stream.
- Live audio plays straight from the stream URL, with a built-in fallback, so the app still plays
  when the API is down. Never proxy audio through the API.
- Mixcloud archives play only inside Mixcloud's own player (WebView); never route that audio
  through our own player.
- Never ship the admin token or call `/v1/admin/*` from the listener app.
- The recent-track cover images in `frontend/assets/` are placeholders, not real artwork.

## Git

- Work on a branch, open a PR, and squash-merge into `main` (as with #1–#7).
- **No Claude attribution** in commits or PRs: no `Co-Authored-By: Claude` or "Generated with
  Claude Code" lines.
