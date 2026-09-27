# Backend integration plan

> **Status (2026-09-27):** the Phase 1–3 engineering in this plan (normalized now-playing,
> automated/validated schedule, health probes, show catalog, recent-spin collector, archive
> pipeline) is implemented and tested **locally** in [`../../backend/`](../../backend/README.md).
> Platform choice: [ADR-001](decisions/ADR-001-platform-cloudflare.md). Archive: disabled pending
> [ADR-002](decisions/ADR-002-archive-storage-licensing.md). The Phase 0 ownership, access and
> policy work below is still open and still blocks production.

## Recommended approach

Do not replace the working stream, metadata publisher, or Google Calendar at the start.
Add a small versioned application layer that normalizes those sources, records durable
history, and exposes only the capabilities the frontend needs.

```text
Existing sources                     New application layer
----------------                     ---------------------
Shoutcast stream -------------------> health probe (audio remains direct to listener)
Now-playing JSON -------------------> normalizer + history collector ----> /v1/now-playing
Google Calendar ICS ----------------> schedule worker/store ------------> /v1/schedule
Station-owned show content ---------> show catalog ---------------------> /v1/shows
Recorded broadcasts ----------------> ingest + object storage ----------> /v1/.../archives
                                                                  └----> monitoring/alerts
```

The live audio should continue flowing directly from the stream host to listeners. The
new API should not proxy it.

## Phase 0 — ownership, access and policy

Complete this before choosing infrastructure or writing production code.

### Required discovery

- Identify the owners and administrators for:
  - `internetstreamer.lafayette.edu`;
  - the now-playing publisher;
  - the S3 bucket and CloudFront distribution behind `nowplaying.wjrh.org`;
  - the public Google Calendar;
  - the current WJRH website/domain/DNS;
  - the production hosting account; and
  - station mailing lists or forms.
- Locate any backend or infrastructure repositories not included in this workspace.
- Record development, staging and production environments.
- Record where secrets are stored and who can rotate them.
- Name one technical owner and one station/content owner.

### Required decisions

- Hosting platform for the application API and scheduled jobs.
- Database/object-storage options already supported by Lafayette or WJRH.
- Monitoring and alert destination.
- Play-history retention period.
- Archive recording, retention, takedown and publication policy.
- Licensing approval for on-demand archives.
- Whether browser push and email collection are worth their privacy/operations cost.

### Exit criteria

- An ownership table with contacts and access confirmed.
- An architecture decision record for hosting/storage.
- Written approval or rejection of on-demand archives.
- A prioritized launch scope signed off by product/station and technical owners.

## Phase 1 — stabilize what already exists

This phase is the safest first implementation work because it does not require Archive.

### 1. Automate schedule generation

- Run the existing parser on a schedule or deployment event.
- Validate the generated result before publishing:
  - valid timezone;
  - start/end times;
  - no accidental overlaps;
  - stable show mapping;
  - duplicate detection;
  - freshness timestamp; and
  - a non-empty result during the active semester.
- Keep the last known-good schedule when generation fails.
- Alert when the source or output is stale.
- Review the current drift before publishing a new snapshot.

### 2. Normalize now-playing data

- Wrap the existing JSON in the proposed `/v1/now-playing` contract.
- Preserve raw source payloads in restricted logs for troubleshooting.
- Normalize URL encoding, `null`, `Null`, empty and malformed values.
- Add an observation/freshness timestamp.
- Join the current schedule occurrence when possible.
- Work with encoder owners to add album at the source if feasible.

### 3. Add health checks

- Verify actual stream bytes, not only an HTTP status.
- Verify metadata freshness and JSON validity.
- Verify schedule freshness and parsing.
- Alert a named operator; document expected response.

### 4. Integrate the frontend safely

- Put API URLs behind a configuration object.
- Keep the existing stream URL direct.
- Add adapters that map API contracts to current frontend state.
- Preserve explicit stale/empty/offline behavior.
- Use feature flags for services that are not yet production-ready.

### Exit criteria

- Schedule refresh is automated and monitored.
- `/v1/health`, `/v1/now-playing` and `/v1/schedule` pass contract tests.
- The production frontend no longer depends on a manually refreshed schedule during
  normal operations.
- Album behavior is resolved as supplied, unavailable, or intentionally deferred.

## Phase 2 — show catalog and persistent recent history

### 1. Establish stable show identities

- Create one `showId` per unique show independent of weekday/time.
- Map calendar occurrences to those IDs.
- Detect unmapped or renamed shows and require review rather than silently creating
  duplicates.

### 2. Add station-owned show content

- Complete `docs/content/STATION_CONTENT_BRIEF.md`.
- Choose the simplest maintainable source:
  - reviewed JSON in source control;
  - a controlled spreadsheet with a validation/export job; or
  - a CMS only if nontechnical editing frequency justifies it.
- Publish through `/v1/shows`.
- Require alt text and ownership for artwork.

### 3. Build the history collector

- Poll the existing now-playing source at the agreed interval.
- Normalize and deduplicate observations.
- Attach the current show occurrence when known.
- Store timestamps and source status.
- Expose `/v1/recent` with limits and retention.
- Add tools to inspect and correct bad metadata without rewriting source history.

### Frontend rollout

- Replace the device-only recent list with server history when healthy.
- Clearly fall back to local observations if the service is unavailable.
- Enable previous-show playlists only after occurrence attribution is tested.
- Replace generated show copy only when approved content exists.

### Exit criteria

- Every active schedule show resolves to a stable show profile.
- The API retains and serves recent spins across devices.
- Empty/bad metadata does not create bogus history entries.
- The frontend labels the source accurately during fallback.

## Phase 3 — archive feasibility and implementation

Archive is a separate service and operational workflow, not an extension of the recent
track list.

### Feasibility spike

- Identify the source recording or create a legal recording path.
- Capture representative broadcasts and measure file size/quality.
- Confirm whether automatic recording includes music that may be offered on demand.
- Review licensing and takedown requirements with the appropriate station/college
  authority.
- Test object storage, CDN delivery and byte-range seeking.
- Estimate monthly storage and egress from the chosen retention policy.

Stop here if rights or operations are unresolved. Keep Archive visibly disabled or
prototype-only.

### Minimum archive pipeline

1. Record or ingest one broadcast file.
2. Associate it with a dated schedule occurrence and stable show ID.
3. Validate duration, MIME type and file integrity.
4. Hold it unpublished for staff review.
5. Add approved title, description and artwork.
6. Publish the episode record and immutable media URL.
7. Support unpublish/takedown with an audit record.
8. Expire or retain the object according to policy.

### Frontend rollout

- Replace `ARCHIVE_SHOWS`, `PROOF_ARCHIVE_DATES`, simulated timers and placeholder
  artwork with API data.
- Render only shows with at least one published episode, unless the product explicitly
  wants an empty archive state.
- Bind play/pause/seek/skip to a real media element outside the render cycle.
- Keep live and archive audio mutually exclusive.
- Verify range requests, duration, interruption recovery and Media Session metadata.
- Remove all prototype labels only after fixtures are gone from the production path.

### Exit criteria

- One end-to-end pilot show can ingest, review, publish, play, seek and unpublish.
- Licensing and retention are documented.
- Monitoring covers failed ingestion and media delivery.
- The feature survives a browser refresh and poor network conditions.

## Phase 4 — optional engagement services

### Host-interest submission

- Select the actual provider.
- Implement `/v1/join` as a narrow adapter.
- Add rate limiting, confirmation semantics and a privacy statement.
- Keep the manual email path as a fallback.

### Reliable reminders

- Validate whether browser push meets the station’s goals across target phones.
- If approved, store anonymous push subscriptions and show selections.
- Schedule notifications from dated occurrences, handling changes/cancellations.
- Provide unsubscribe/delete behavior.

Do not introduce accounts unless another approved requirement genuinely needs them.

## Proposed implementation backlog

| Order | Work item | Depends on | Demonstrable outcome |
|---:|---|---|---|
| 1 | Ownership/access inventory | Station and Lafayette contacts | Named owners and reachable systems |
| 2 | Schedule validation + automated refresh | Hosting/scheduler decision | Live calendar changes reach app without manual rebuild |
| 3 | Health probes and alerts | Alert destination | Stream/metadata/schedule failures notify an owner |
| 4 | Normalized now-playing endpoint | Metadata system access | Stable JSON with freshness and null handling |
| 5 | Album metadata correction | Encoder/publisher access | Album displayed when supplied |
| 6 | Stable show catalog | Station content | Approved show detail without generated copy |
| 7 | Recent-spin collector | Database/retention decision | Cross-device recent history |
| 8 | Per-show occurrence history | Reliable schedule + collector | Previous-show playlist data |
| 9 | Archive feasibility pilot | Rights and storage approval | One reviewed real episode |
| 10 | Archive production pipeline | Successful pilot | Published, monitored show archives |
| 11 | Join endpoint | Provider/privacy decision | Verified subscription flow |
| 12 | Push reminders | Product/privacy decision | Closed-app reminder on supported devices |

## Testing gates for every phase

- Contract tests for the API response.
- Upstream failure, stale-data and malformed-data tests.
- Mobile browser and installed-PWA tests.
- Accessibility check for every new state.
- Observability check: an operator can detect and diagnose failure.
- Rollback plan that restores the last known-good frontend and data.
- Documentation update before production release.

## First backend working session agenda

1. Walk through `CURRENT_CAPABILITIES.md` and correct any ownership assumptions.
2. Assign owners for the three existing sources.
3. Decide where the small application layer and scheduled jobs can run.
4. Choose the Phase 1 milestone: automated schedule plus health checks.
5. Create the backend repository and environment conventions.
6. Convert the API examples into machine-validated schemas/tests.
7. Create staging endpoints and wire the frontend behind a feature flag.
8. Schedule the archive licensing/operations decision separately from engineering.

