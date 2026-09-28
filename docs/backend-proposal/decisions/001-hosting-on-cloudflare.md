# Decision 001: Host the WJRH application layer on Cloudflare

- **Status:** Proposed. Waiting on board approval; nothing is deployed.
- **Date:** 2026-09-28
- **Decides:** where the `/v1` API ([`../api.md`](../api.md)), its scheduled jobs,
  its database and any archive audio would live.
- **Does not decide:** whether Archive launches. That is covered by
  [Decision 002](002-archive-and-licensing.md).

## Context

The frontend design (`frontend/index.html`) shows features no current service
provides. The gaps are listed in [`../gaps.md`](../gaps.md):
- station-wide recently played;
- show pages;
- a live on-air state;
- an archive.

[`../rollout-plan.md`](../rollout-plan.md) recommends adding a small layer
beside the existing sources, not replacing them. The existing sources are the Shoutcast stream,
the S3/CloudFront now-playing JSON, and the public Google Calendar.

Constraints:

1. **Student turnover.** Whoever maintains this graduates within four years. Anything that needs OS
   patching or uptime babysitting will rot.
2. **Near-zero budget.**
3. **Archive audio is the only bandwidth-heavy workload.** Per-GB download fees would dominate every
   other cost.
4. **Existing systems must not change.** The stream, booth, feed and calendar keep working as they
   do today.

## Proposal

| Concern | Cloudflare product |
|---|---|
| `/v1` API | Workers |
| Scheduled jobs (history collector, calendar refresh, health checks, retention) | Cron Triggers |
| Database (play history, schedule snapshots, archive records, audit log) | D1 (SQLite) |
| Archive audio, if approved | R2 (S3-compatible storage, served from `media.wjrh.org`) |
| Staff/admin access | Cloudflare Access in front of `/v1/admin/*` |
| Frontend | Cloudflare Pages, where the design preview already lives |

- **Two things stay off Cloudflare.**
  - **Live audio** keeps flowing straight from `internetstreamer.lafayette.edu` to listeners. The
    API never proxies audio.
  - **The archive recorder**, if approved, runs on a small always-on cloud server (for example
    Hetzner or DigitalOcean, about $5/month). Workers can't hold a stream open for a whole show.
    The recorder only needs the public stream URL, so **nothing is installed or maintained at the
    station**. Everything is set up and managed remotely.
- **Editorial content lives in reviewed JSON in git.** That covers show descriptions, host bios, the
  team roster and events. The Google Calendar stays the source for *when* shows air.

## Options considered

| Option | For | Against |
|---|---|---|
| **Cloudflare (proposed)** | No servers to patch; cheap at this scale; R2 has no download fees; the design preview is already on Cloudflare Pages; `wrangler dev` runs the real runtime locally | The existing Python schedule parser must be ported to TypeScript; the recorder still needs its own machine; D1 and Cron are Cloudflare-specific |
| One Python server (FastAPI + SQLite + recorder) | Reuses `fetch_schedule.py` directly; one machine | Someone must patch and watch it; one failure takes down both the API and archiving; a VPS costs about $5/month |
| AWS, next to the existing now-playing bucket | May share the account that already publishes metadata | That account's owner is unknown; audio download fees cost real money |

Archive storage should be written against the plain S3 API. That keeps R2, AWS S3 and Backblaze B2
interchangeable.

## Cost estimate

These use Cloudflare's published pricing. Re-check it before the board vote.

**Traffic.** An open app that polls every 15 s makes roughly 480 requests an hour. Ten listeners on
average is about 115,000 requests a day, which is over the Workers free allowance of 100,000 a day.

**Archive audio.** At 128 kbps, audio is 57.6 MB an hour. The schedule has about 29 live hours a week,
so that's about 1.7 GB of new audio a week.

| Item | Assumption | Monthly |
|---|---|---|
| Workers Paid (includes D1 and Cron at this scale) | 10M requests/month included | **$5.00** |
| R2 storage, 2-week retention | ≈3.4 GB, within the 10 GB free tier | $0.00 |
| R2 storage, full-semester retention | ≈25 GB, so ≈15 GB billable at $0.015/GB | ≈$0.23 |
| R2 downloads | Free | $0.00 |
| Cloud server for the recorder (archive only) | Smallest Linux VPS | ≈$4–6 |
| **Total** | | **≈ $5–10 / month**, plus the archive if approved: ≈ $5 more (whole-day blocks) or ≈ $16–20 more (Mixcloud); see [Decision 002](002-archive-and-licensing.md) |

## What production would need

1. A Cloudflare account owned by the station, not a student, with at least two admins.
2. DNS for `api.wjrh.org` and `media.wjrh.org`, or the temporary `*.workers.dev` address for a pilot.
3. Secrets held in Cloudflare, not in the repository.
4. A named person who receives alerts when `/v1/health` reports a problem.

## Prior work

A working local prototype of this proposal was built and then removed from the working tree while
the board decides. It included:
- the API;
- a mock station;
- the recorder;
- 47 automated tests.

It is preserved in the history of branch `claude/busy-bell-qvk1c0` at commit `e423e98`. To look at it:
`git checkout e423e98 -- backend`.
