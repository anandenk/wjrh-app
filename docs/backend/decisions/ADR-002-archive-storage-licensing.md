# ADR-002: Build Archive provider-agnostic; keep it off until licensing is decided

- **Status:** Proposed. The engineering is done locally. The launch decision belongs to the board.
- **Date:** 2026-09-27
- **Related:** [ADR-001](ADR-001-platform-cloudflare.md), [`../BACKEND_INTEGRATION_PLAN.md`](../BACKEND_INTEGRATION_PLAN.md), Phase 3

## Context

The design's Archive tab has one page per show, past broadcasts, and on-demand play with seek and
±30 s. Nothing like it exists today. This is the only feature with real licensing exposure.

**The licensing problem, in one paragraph.** WJRH webcasts under the statutory licence for sound
recordings (17 U.S.C. §114). That licence covers *non-interactive* streaming, and it attaches conditions
to "archived programs". As we read §114(d)(2)(C)(iii):
- an archived program **shorter than five hours** is not eligible;
- a program of five hours or more is eligible only if it is available for **two weeks or less**.

Almost every WJRH show is one or two hours long. So recording music shows and serving them on demand
from our own storage is **probably not covered** by the licence the station already relies on.
Musical-work rights (ASCAP/BMI/SESAC/GMR) are a separate question.

This is our reading, not legal advice. **The station and the college must confirm it before any public
launch.** The existing compliance rules in `wjrh-app/README.md` still apply: no advance playlists, and
no per-track interactivity.

## Decision

Build the whole archive pipeline now, **provider-agnostic and disabled in production**
(`ARCHIVES_ENABLED = "false"` in `wrangler.toml`). The board can then pick a path without new
engineering work.

What exists (all local, all tested):

```
recorder (always-on box)                API (Worker + D1)                   storage (S3 API)
────────────────────────                ─────────────────                   ────────────────
watches /v1/schedule
records each opted-in occurrence
POST /v1/admin/archives  ─────────────> episode 'uploading' + presigned URL
PUT file ───────────────────────────────────────────────────────────────> archives/<show>/<id>.mp3
PATCH status=pending_review ──────────> HEAD object: exists? audio/*? size
                        staff: PATCH published | unpublished | DELETE (audit_log)
listeners: GET /v1/shows/{id}/archives (published only) ──> audioUrl ──> direct from media host (Range)
daily: retention job deletes objects older than ARCHIVE_RETENTION_DAYS (default 14)
```

Safeguards built in:
- **Per-show opt-in at the recorder.** `--shows` lists the cleared shows. There is no default.
- **Nothing is public without a staff decision.** The only way to publish is `pending_review → published`.
- **Takedown.** Unpublish is immediate. Delete removes the object. Every change is written to
  `audit_log` with the actor.
- **Retention is enforced by a job, not by memory.** The default is 14 days.
- **Media is never proxied through the API.** The media host must answer HTTP Range requests; the
  e2e test checks for a `206`.

## Options for the board

| Path | What it means | Licensing posture | Engineering left |
|---|---|---|---|
| **A. Talk/spoken-word only** (e.g. *Fatou Talks*, talk segments) | The recorder is limited to shows that are mostly speech; hosts consent | Lowest risk. Incidental music still needs a policy | None beyond choosing shows |
| **B. Mixcloud for music shows** | Upload shows to a station Mixcloud account. The API lists them and the app plays through Mixcloud's embed widget | Mixcloud holds licences for DJ mixes and radio shows in many territories. **Check its terms for US college radio**, including tracklist requirements and any playback limits | Small: an episode type with an external `embedUrl`; the player uses the widget API (seek and styling are limited to what the widget allows) |
| **C. Self-hosted (R2) for everything** | What is built, turned on for all shows | Probably outside §114 for shows under 5 hours unless separately licensed | None |
| **D. No archive** | Hide the Archive tab. Keep station-wide recent tracks and per-show "last time on air" playlists (text only, allowed) | No exposure | Remove Archive from the design |

**Recommendation.** Pilot **A** with one or two consenting talk shows on the self-hosted pipeline. That
validates the operations: the recorder uptime, the review queue and retention. At the same time,
put **B** to the board as the route for music shows. Do not turn on **C** for music programming
without written sign-off.

## Local verification

- `backend/scripts/e2e.py` records a real 2-minute occurrence from the fake stream. It then checks:
  - the upload, review, publish and unpublish steps;
  - that the media host returns HTTP 206 for a byte range;
  - that the audit trail is complete.
- `backend/devtools/archive-player.html` plays and seeks a recorded episode in a real `<audio>`
  element and works the review queue.

## Open questions

1. Who at the station or college can approve a licensing position, in writing?
2. Retention: 14 days (default), a semester, or per show?
3. Who reviews and publishes episodes, and how quickly after a broadcast?
4. Where does the recorder run? The booth PC or a Pi is simplest; it needs a UPS and a named owner.
5. Should hosts be able to request a takedown directly, and how?
