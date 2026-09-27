# ADR-001: Run the WJRH application layer on Cloudflare

- **Status:** Proposed. The technical choice is made and implemented locally, but production deployment needs station approval.
- **Date:** 2026-09-27
- **Decides:** where the `/v1` API, its scheduled jobs, its database and the archive media live.
- **Does not decide:** whether Archive launches. That is covered by [ADR-002](ADR-002-archive-storage-licensing.md).

## Context

The design prototype implies features no current service provides:
- station-wide recent tracks;
- per-show history;
- show profiles;
- a dated schedule;
- archive playback;
- a join form;
- health.

See [`../FRONTEND_BACKEND_GAP_ANALYSIS.md`](../FRONTEND_BACKEND_GAP_ANALYSIS.md).
[`../BACKEND_INTEGRATION_PLAN.md`](../BACKEND_INTEGRATION_PLAN.md) recommends adding a small layer on
top of the existing sources rather than replacing them. The existing sources are the Shoutcast stream,
the S3/CloudFront now-playing JSON, and the public Google Calendar.

Constraints that drive the choice:

1. **Student turnover.** Whoever maintains this graduates within four years. Anything that needs
   OS patching, uptime babysitting or institutional sysadmin knowledge will rot.
2. **Near-zero budget.** Club funding, approved by the board.
3. **Archive audio is the only large or bandwidth-heavy workload.** Per-GB egress fees would dominate
   any other cost.
4. **Everything must be testable locally before money is spent.**

## Decision

| Concern | Cloudflare product | Local stand-in |
|---|---|---|
| `/v1` API | Workers (TypeScript, Hono) | `wrangler dev` (workerd, the same runtime) |
| Scheduled jobs (collector, schedule refresh, probes, retention) | Cron Triggers | `wrangler dev --test-scheduled`, ticked by `scripts/dev.sh` |
| Database | D1 (SQLite) | Local D1 via Miniflare |
| Archive media | R2 (S3-compatible, public bucket on `media.wjrh.org`) | moto or MinIO on `:9000` |
| Staff/admin auth | Cloudflare Access in front of `/v1/admin/*`, plus a service token for the recorder | Bearer token in `.dev.vars` |
| Archive recorder | **Not Cloudflare.** A long-running process on an always-on machine (booth PC, Raspberry Pi, or Lafayette VM) | `backend/recorder/recorder.py` |

The live audio stays exactly where it is. Listeners connect directly to `internetstreamer.lafayette.edu`,
and the API never proxies audio, whether live or archived.

The station keeps editing the Google Calendar as it does today. Show descriptions and bios live in
reviewed JSON in git, in `backend/content/`. A CMS can come later if editing frequency justifies it.

## Options considered

| Option | For | Against |
|---|---|---|
| **Cloudflare (chosen)** | No servers to patch; the free/cheap tiers fit this scale; R2 has **no egress fees**; the board prototype is already on Cloudflare Pages; `wrangler dev` runs the real runtime locally | ICS parsing had to be ported from Python to TypeScript (done, with a parity test); the recorder still needs a separate machine; vendor-specific bindings (D1, Cron) |
| Single Python VM (FastAPI + SQLite + recorder on one box) | Reuses `fetch_schedule.py` directly; one machine for everything | Someone must patch and monitor it; one failure takes down both the API and archiving; a VPS costs about $5/mo |
| AWS (Lambda + DynamoDB + S3/CloudFront), next to the existing now-playing bucket | Possibly the same account as today's metadata publisher | The account's owner is unknown (see CURRENT_CAPABILITIES); S3/CloudFront egress for audio costs real money; local emulation (LocalStack) is heavier |

Portability is kept deliberately. Archive storage speaks plain S3, so R2, AWS S3, Backblaze B2 and
MinIO are interchangeable through env vars (`src/storage.ts`). The SQL is standard SQLite. The
Worker code is web-standard `fetch` apart from the `DB` binding.

## Cost estimate

These figures use Cloudflare's published pricing as of this writing. **Re-check the pricing pages before
the board vote.**

**Traffic.** An open app polls now-playing and recent every 15 s. That is about 480 requests per hour per
listener. Ten listeners on average around the clock is about 115,000 requests a day, which already
exceeds the Workers **free** allowance of 100,000 a day.

**Archive audio.**
- 128 kbps is 57.6 MB per hour.
- Live programming is about 29 hours a week (from `schedule.json`), so about 1.7 GB of new audio a week.

| Item | Assumption | Monthly |
|---|---|---|
| Workers Paid plan (includes D1 and Cron at this scale) | 10M requests/month included | **$5.00** |
| R2 storage, 2-week retention | ≈3.4 GB, within the 10 GB free tier | $0.00 |
| R2 storage, full-semester retention | ≈25 GB, so ≈15 GB billable at $0.015/GB | ≈$0.23 |
| R2 egress (listeners streaming archives) | Free on R2 | $0.00 |
| Recorder machine | An existing booth PC or a Lafayette VM | $0 (a Pi is ≈$60–80 once; a VPS is ≈$5) |
| **Total** | | **≈ $5–10 / month** |

The Workers free tier might be enough if the frontend polls less often. For example, recent tracks could be
fetched only on screens that show them, and now-playing could use a 30 s interval. The Paid plan is the
safer budget line.

## Consequences

- There is a working local implementation in `backend/`, with 47 automated tests and an end-to-end
  script against a fake station.
- **Before production:**
  1. A Cloudflare account owned by the station (not a student's personal account), with at least two
     admins.
  2. DNS for `wjrh.org`, so the API and media can use `api.wjrh.org` and `media.wjrh.org`. The
     `*.workers.dev` hostname works for a pilot. `r2.dev` URLs are rate-limited and not for production.
  3. Secrets set with `wrangler secret put`: `ADMIN_TOKEN`, `S3_ACCESS_KEY_ID`,
     `S3_SECRET_ACCESS_KEY`, `JOIN_SALT`.
  4. A named owner for alerts. `/v1/health` exists, but nothing pages anyone yet.
- The Cloudflare Access configuration and the alerting integration are not implemented.
- The now-playing collector's resolution is one minute (the cron minimum), plus whatever listener
  traffic triggers. It uses the publisher's `Last-Modified` timestamp when plausible, so start times are
  source-accurate rather than poll-accurate.
