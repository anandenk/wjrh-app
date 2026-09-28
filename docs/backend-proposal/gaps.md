# Frontend-to-backend gap analysis

This compares the frontend design (`frontend/`) with verified WJRH services.
It is a scope control document: a polished screen is not considered supported until its
data and actions come from a durable production source.

## Status legend

- **Supported** — the necessary production service exists and is already consumed.
- **Partial** — some data or behavior exists, but not enough for the intended feature.
- **Client-only** — works only on one device or while the app remains open.
- **Prototype** — simulated visual behavior with no production source.
- **Unknown** — ownership, access or implementation cannot be established here.

Priority meanings:

- **P0:** required before a truthful public launch.
- **P1:** highest-value backend addition after the launch baseline.
- **P2:** substantial new service or operational workflow.
- **P3:** optional enhancement after the core system is stable.

## Capability matrix

| Frontend expectation | Current status | Evidence/current behavior | Missing backend or operational work | Priority |
|---|---|---|---|---:|
| Play the live station | Partial | HTTPS MP3 Shoutcast stream exists; the design's play button is simulated | Connect a real audio element (no CORS needed); uptime monitoring, ownership and incident runbook | P0 |
| Show buffering/reconnect/offline states | Prototype | The design shows these states from an editor switch | Real audio events plus a central health signal | P0 |
| Display current title and artist | Partial | Public CORS JSON exposes `ARTIST` and `TITLE`; values can be null | Encoder/DJ metadata reliability, normalized response, freshness timestamp | P0 |
| Display album | Unsupported | The feed does not supply album | Add album at the metadata source or enrich through a licensed, reviewed process | P0 |
| Display current album/show artwork | Prototype | Design uses placeholder covers | Approved artwork repository and stable URLs; define whether artwork is per show or per episode | P1 |
| Identify the current scheduled show | Prototype | The design uses a fixed demo clock and a hard-coded roster | Real ET clock plus an automated schedule source | P0 |
| Weekly schedule | Partial | Public calendar and `tools/fetch_schedule.py` work, but the design hard-codes a Sep 22 copy and the snapshot has drifted | Scheduled generation, validation and failure alerts | P0 |
| Show genres | Partial | Calendar description first line is reused as genre | Station-approved structured field; 19 current slots are blank | P1 |
| Show descriptions | Prototype/partial | Calendar descriptions are sparse; prototype uses generated copy | Station-owned editorial source and review workflow | P1 |
| Host bios | Unsupported | Generated schedule sets every bio to blank | Station-owned content source keyed by stable show ID | P1 |
| Station-wide recent history | Unsupported | No durable play-log service | Metadata collector, deduplication, storage, retention and `/recent` API | P1 |
| Per-show previous playlist | Unsupported | Requires historical spins joined to schedule occurrences | Reliable spin timestamps, show occurrence IDs and query API | P1 |
| Archive show index | Prototype | Design creates one archive entry per hardcoded show | Show catalog API/content source and archive availability state | P2 |
| Archive episode dates and metadata | Prototype | Three generated dates per show | Recording ingestion, episode records, publish status and stable IDs | P2 |
| Archive playback | Prototype | Timer simulates playback; no media files are loaded | Recorded audio, object storage/CDN, media delivery and failure states | P2 |
| Archive seeking and ±30 seconds | Prototype | UI manipulates a simulated duration | Seekable media with byte-range support and authoritative duration | P2 |
| Archive persistent player | Frontend-ready only | Interaction is designed but not connected to media | Playback adapter, episode API and integration tests | P2 |
| Saved show reminders | Unsupported | Not in the current design | Push or native notifications if the station wants them | P3 |
| Host-interest signup | Links only | The design links to GroupMe and email | None, unless the station wants an in-app form | P3 |
| Station information pages | Mostly static | Links and copy are embedded in frontend | Station approval, ownership and a future editing workflow if frequent changes are expected | P1 |
| Team roster | Static prototype | People and email links are embedded in prototype code | Approved source and semester turnover process | P1 |
| Background/lock-screen live controls | Unsupported | Not in the current design | Media Session with real playback; real-device validation | P1 |
| Analytics and usage reporting | Unsupported | No analytics code or event endpoint | Privacy decision, event taxonomy, retention and implementation | P3 |
| Backend health/observability | Unsupported/unknown | No monitoring configuration is present | Probes, alerts, dashboards, logs and named owners | P0 |
| Admin/editorial interface | Unsupported | Content changes require calendar edits or code changes | Decide whether a spreadsheet, CMS or small admin app is justified | P2 |

## Truthful launch boundary

A public version can honestly ship before the larger backend exists if it includes only:

- live stream playback;
- current title and artist when available, with an explicit missing-data state;
- the refreshed weekly schedule;
- station-approved static content and links; and
- Recently played hidden, or clearly labeled, until a play-history service exists.

The public build should hide or clearly mark Archive, generated descriptions, cover art,
episode dates, persistent history and reliable reminders until their services exist.

## Decisions that block backend implementation

1. Who owns the existing stream, metadata publisher, CloudFront distribution, calendar,
   website deployment and future API?
2. Can the encoder/publisher emit album and timestamps, or must metadata be normalized
   elsewhere?
3. Where should station-owned show profiles live: a controlled JSON file, spreadsheet,
   CMS or database?
4. Does the station have approval to record and offer programs on demand, and for what
   retention period?
5. Who can publish/unpublish an archive episode?
6. What hosting environment is institutionally supportable: Lafayette infrastructure,
   Cloudflare, AWS, or another existing platform?
7. Are show reminders wanted at all? The current design has none.

## Definition of “backend supported”

A frontend capability moves out of Prototype/Partial only when all of the following are
true:

- it has an authoritative data owner;
- it has a documented versioned interface;
- success, empty, stale and error states are defined;
- the service is monitored;
- privacy, retention and licensing questions are resolved;
- the production frontend consumes it without fixture fallback; and
- an end-to-end test verifies the user-visible result.

