# Frontend-to-backend gap analysis

This compares the frontend design (`frontend/`) with verified WJRH services.
It is a scope control document: a polished screen is not considered supported until its
data and actions come from a durable production source.

**Implementation update (2026-10-15):** the `/v1` Worker, D1 collector, schedule parser, health probes, editorial JSON
and archive pipeline exist in `backend/` (#6); real-upstream validation is done (#9), and the native app consumes the
API (#12–#16). A demo API runs on a personal Cloudflare account (#24), not the station's production. The HTML design
still uses fixtures. The table distinguishes remaining production gaps from code already built; device-verification
limits and the pending runtime checks after #27 are in [`../mobile-app/status.md`](../mobile-app/status.md).

## Status legend

- **Supported** — the necessary production service exists and is already consumed.
- **Partial** — some data or behavior exists, but not enough for the intended feature.
- **Client-only** — works only on one device or while the app remains open.
- **Prototype** — simulated visual behavior with no production source.
- **Unknown** — ownership, access or implementation cannot be established here.
- **Unsupported** — no implementation of the requested capability exists here.

Priority meanings:

- **P0:** required before a truthful public launch.
- **P1:** highest-value backend addition after the launch baseline.
- **P2:** substantial new service or operational workflow.
- **P3:** optional enhancement after the core system is stable.

## Capability matrix

| Frontend expectation | Current status | Evidence/current behavior | Missing backend or operational work | Priority |
|---|---|---|---|---:|
| Play the live station | Partial | Native app plays the HTTPS stream directly with fallback; HTML design still simulates it | Full phone checks, uptime alerts, ownership and incident runbook | P0 |
| Show buffering/reconnect/offline states | Partial | Native player retry/watchdog, NetInfo and `/v1/health` exist; design has an editor switch | Pending runtime checks after #27, full phone checks and operational alerts | P0 |
| Display current title and artist | Partial | Native app reads normalized `/v1/now-playing`, with freshness and missing-data states | Encoder/DJ metadata reliability and station-owned production operation | P0 |
| Display album | Partial | Native app renders album when supplied, but the real feed does not supply it | Add album at the metadata source or enrich through a licensed, reviewed process | P0 |
| Display current album/show artwork | Prototype | Design uses placeholder covers | Approved artwork repository and stable URLs; define whether artwork is per show or per episode | P1 |
| Identify the current scheduled show | Partial | API joins real calendar occurrences; native app uses station time. HTML design retains a fixed clock | Station-owned production operation | P0 |
| Weekly schedule | Partial | API refreshes/validates the calendar every 15 min and keeps the last good answer; #9 refreshed the separate tool snapshot. Design hard-codes Sep 22 | Production ownership and failure alerts | P0 |
| Show genres | Partial | API supports profile genres and falls back to the calendar's first description line; 19 slots in the committed tool snapshot are blank | Station-supplied genres in `backend/content/shows.json` and review | P1 |
| Show descriptions | Partial | Editorial JSON has nullable descriptions; native app shows missing text honestly or labelled demo samples | Station-supplied descriptions and review workflow | P1 |
| Host bios | Partial | `backend/content/shows.json` has stable IDs and `hostBio`, currently empty | Station-supplied bios and review | P1 |
| Station-wide recent history | Partial | D1 collector, deduplication, retention and `/v1/recent` exist and feed the native app; demo deployment only | Station-owned production operation and retention approval | P1 |
| Per-show previous playlist | Unsupported | Collector records show/occurrence IDs; `/v1/recent` is station-wide, with no show filter | Per-occurrence query API, UI and attribution validation | P1 |
| Archive show index | Prototype | Design/native demo show sample catalogs; API has `/v1/archives` with an `enabled` flag | Real recordings, station approval and native API integration | P2 |
| Archive episode dates and metadata | Prototype | Design/native demo generate dates; backend has ingestion, episode records and review states | Approved real recordings and production workflow | P2 |
| Archive playback | Prototype | Native demo uses a silent timer; local backend/test bench supports storage and fake Mixcloud | Real recordings, provider approval, native player integration and production delivery | P2 |
| Archive seeking and ±30 seconds | Prototype | Native demo manipulates a timer; local backend test bench exercises storage Range requests | Native playback adapter and real-provider seek validation | P2 |
| Archive persistent player | Prototype | Demo context keeps a silent player across screens; backend episode API exists | Real playback adapter and end-to-end native integration | P2 |
| Saved show reminders | Client-only | Native local notifications are built; Android emulator delivery worked but was late. HTML design has none | iPhone/device checks and Android timing/wording decision | P3 |
| Host-interest signup | Links only | The design links to GroupMe and email | None, unless the station wants an in-app form | P3 |
| Station information pages | Mostly static | Links and copy are embedded in frontend | Station approval, ownership and a future editing workflow if frequent changes are expected | P1 |
| Team roster | Partial | Native app reads editorial JSON through `/v1/station`; API withholds unapproved names/emails (#24). HTML design has a hard-coded roster | Station approval and semester turnover process | P1 |
| Background/lock-screen live controls | Partial | Native audio registers metadata; background playback and Android notification controls passed earlier emulator checks | Full real-device validation and runtime checks after #27 | P1 |
| Analytics and usage reporting | Unsupported | No analytics code or event endpoint | Privacy decision, event taxonomy, retention and implementation | P3 |
| Backend health/observability | Partial | Scheduled stream/metadata/schedule probes and `/v1/health` exist; no alert delivery | Alerts, operational dashboards/runbook and named owners | P0 |
| Admin/editorial interface | Partial | Local archive-review test bench exists; show/station content still requires calendar or JSON edits | Production staff access and a decision on an editorial CMS | P2 |

## Truthful launch boundary

A public version still needs station approval and production operation. Its baseline can include:

- live stream playback;
- current title and artist when available, with an explicit missing-data state;
- the refreshed weekly schedule;
- station-approved static content and links; and
- Recently played from the existing collector once the station approves its production operation and retention.

The public build should hide or clearly mark Archive, generated descriptions, cover art,
episode dates, and unverified reminder behavior. The native app already saves last-good API answers across restarts
(#20); it does not save recent tracks or archives.

## Decisions that block production rollout

1. Who owns the existing stream, metadata publisher, CloudFront distribution, calendar,
   website deployment and future API?
2. Can the encoder/publisher emit album and timestamps, or must metadata be normalized
   elsewhere?
3. Are the implemented reviewed JSON profiles in `backend/content/shows.json` sufficient for station editors, or
   is a spreadsheet/CMS needed?
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

