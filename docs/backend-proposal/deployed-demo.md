# The demo API on Cloudflare (free plan)

A copy of the API runs on Cloudflare so the demo app does not need a laptop. It is **a demo deployment on a personal
account**, not the station's production setup (decision 001 still says: a station-owned account, a station domain).

| | |
|---|---|
| Address | `https://wjrh-api.anandenkhjin.workers.dev` |
| Account | A personal Cloudflare account (the free plan; no card). Move it to the station's account before a real launch |
| What exists | A Worker `wjrh-api`, a D1 database `wjrh` (region ENAM), and the four scheduled jobs from `wrangler.toml` |
| Data | The station's real stream, now-playing feed and calendar, read only. Archives off, the join form off |
| Secrets | **None.** `ADMIN_TOKEN` is not set, so every `/v1/admin/*` request answers 401 (and archives are off anyway) |
| Deployed from | `backend/api/wrangler.toml` with the real D1 id swapped in, kept in an untracked `wrangler.demo.toml` |

## What anyone can see

The API is public: anyone with the address can read what the app reads (now playing, recent tracks, the schedule,
show list, station pages). The student roster (names and emails) is **not** sent while `approved` is `false`
(`publicStation` in `src/content.ts`). The first deployment sent it by mistake for about 12 hours; that was fixed the same
day. Do not put anything private in the content files without checking `publicStation`.

## How it was deployed

```bash
cd backend/api
npx wrangler login                        # opens a browser; needs a Cloudflare account (free)
npx wrangler d1 create wjrh               # prints a database_id
# copy wrangler.toml to wrangler.demo.toml and put that id in the top-level [[d1_databases]]
# (wrangler.demo.toml is ignored by git: add it to .git/info/exclude)
npx wrangler d1 migrations apply wjrh --remote -c wrangler.demo.toml
npx wrangler deploy -c wrangler.demo.toml
```

Redeploying after a code change is the last command alone. The login lasts only a few hours when Wrangler cannot
refresh it without a terminal: if a deploy says "Not logged in", run `npx wrangler login` again. To see what the
Worker is doing: the Cloudflare dashboard (Workers & Pages, `wjrh-api`, Metrics and Logs); `wrangler tail` dropped its
connection when tried.

To point the app at it, build with `EXPO_PUBLIC_API_BASE=https://wjrh-api.anandenkhjin.workers.dev`
(see `apps/mobile/README.md`). `eas.json` does not set it yet for preview or production builds.

## The free plan, and what to watch

Cloudflare's free limits (checked in October 2026): 100,000 Worker requests a day, **10 ms of processing per request
and per scheduled job**, 5 scheduled jobs on the account (this uses 4), and for D1 5 million rows read and 100,000 rows
written a day, 500 MB a database.

- **Working so far:** the scheduled jobs ran on their own for 12 hours: the track collector kept adding recent tracks
  (100 collected), the health checks ran every 5 minutes, and the 15-minute calendar refresh succeeded.
- **The risk:** the calendar parse took about 2.6 ms warm but 23 ms on its first run in plain Node. A job that goes over 10 ms
  is stopped, and the API keeps serving the last good snapshot and retries. If `health` shows the schedule stale
  (`status` not `ok`), look for "exceeded CPU" in the dashboard first. Fixes: do less work per run (compare the
  calendar's hash before parsing it) or move to the paid plan.
- **Not enough for launch:** decision 001 estimated about 115,000 requests a day with real listeners, which is over the
  free limit. The Workers Paid plan ($5 a month) covers that.

## Before a real launch

1. A Cloudflare account owned by the station with at least two admins (decision 001), and re-run the steps above there.
2. A station domain (`api.wjrh.org`) instead of the `workers.dev` address.
3. Set `EXPO_PUBLIC_API_BASE` for the preview and production profiles in `eas.json`.
4. If archives or the admin routes are ever turned on: a strong `ADMIN_TOKEN` as a secret (`wrangler secret put`) and
   Cloudflare Access in front of `/v1/admin/*`, as the code comments assume.

## Switching it off

```bash
cd backend/api
npx wrangler delete -c wrangler.demo.toml     # removes the Worker and its scheduled jobs
npx wrangler d1 delete wjrh                   # removes the database
```
