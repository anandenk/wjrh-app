# ADR-002: Keep Archive provider-agnostic and off until licensing is decided

- **Status:** Proposed. The launch decision belongs to the board.
- **Date:** 2026-09-28
- **Related:** [ADR-001](ADR-001-platform-cloudflare.md) and
  [`../BACKEND_INTEGRATION_PLAN.md`](../BACKEND_INTEGRATION_PLAN.md) (Phase 3).

## Context

The design's Archive tab offers:
- one page per show;
- past broadcasts;
- on-demand play with seek and ±30 s.

Nothing like this exists today, and it is the only feature with real licensing exposure.

**The licensing problem.** WJRH webcasts under the statutory licence for sound recordings
(17 U.S.C. §114). That licence covers *non-interactive* streaming and attaches conditions to
"archived programs." As we read §114(d)(2)(C)(iii):
- an archived program **shorter than five hours** is not eligible;
- a program of five hours or more is eligible only if it's available for **two weeks or less**.

Almost every WJRH show is one or two hours long, so serving recorded music shows on demand from our
own storage is **probably not covered**. Musical-work rights (ASCAP, BMI, SESAC, GMR) are a separate
question. This is our reading, not legal advice, and the station and college must confirm it.

The existing rules in [`../CURRENT_CAPABILITIES.md`](../CURRENT_CAPABILITIES.md) ("Licensing rules for any frontend") still apply:
- no advance playlists;
- no per-track interactivity.

## Proposal

Design the archive so the storage provider can change later, and ship it **switched off** until
the board picks a path.

```
recorder (always-on box)          API (Worker + D1)                storage (S3 API)
────────────────────────          ─────────────────                ────────────────
watches /v1/schedule
records each opted-in show
registers the episode ──────────> episode 'uploading' + one-time upload URL
uploads the file ───────────────────────────────────────────────> archives/<show>/<id>.mp3
marks it ready ─────────────────> checks the file exists and is audio → 'pending_review'
                 staff: publish / unpublish / delete   (every action logged with who did it)
listeners: /v1/shows/{id}/archives lists published episodes only ──> audio straight from storage
daily: episodes older than the retention window are deleted (default 14 days)
```

Safeguards:
- **Opt-in by show.** The recorder records only shows on an approved list. There is no default.
- **Nothing is public without a staff decision.**
- **Immediate takedown.** Unpublishing takes effect at once, and deleting removes the file. Both are
  logged.
- **Retention is enforced by a scheduled job, not by memory.**
- **The API never passes audio through itself.** The storage host must support HTTP range requests
  so listeners can seek.

## Options for the board

| Path | What it means | Licensing posture | Work beyond the proposal |
|---|---|---|---|
| **A. Talk/spoken-word only** | Record only shows that are mostly speech, with host consent | Lowest risk. Incidental music still needs a policy | None |
| **B. Mixcloud for music shows** | Upload to a station Mixcloud account; the app plays through Mixcloud's player | Mixcloud licenses DJ mixes and radio shows in many territories. **Check its terms for US college radio** | Small: episodes point at Mixcloud instead of our storage |
| **C. Self-hosted for everything** | Record and host all shows | Probably outside §114 for shows under 5 hours unless separately licensed | None |
| **D. No archive for now** | Hide the Archive tab. Keep station-wide recently played and per-show "last time on air" playlists (text only) | No exposure | Remove Archive from the design |

**Recommendation.** Pilot **A** with one or two consenting talk shows, which proves out the recorder,
the review step and retention. At the same time, bring **B** to the board as the route for music
shows. Don't turn on **C** for music without written sign-off.

## Open questions

1. Who at the station or college can approve a licensing position in writing?
2. Retention: 14 days, a semester, or per show?
3. Who reviews and publishes episodes, and how soon after a broadcast?
4. Where would the recorder run, and who owns it? It needs a UPS.
5. How do hosts request a takedown?
