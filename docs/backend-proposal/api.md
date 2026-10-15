# Proposed backend API contracts

These contracts are a planning baseline, not an existing API. Confirm the host platform,
owners and authentication model before implementation. The proposed platform is in
[`decisions/001-hosting-on-cloudflare.md`](decisions/001-hosting-on-cloudflare.md).

A working implementation of these contracts runs locally in [`../../backend/`](../../backend/),
against a fake station. The notes marked **Learned from the prototype** below come from that work.
Archive episodes can also live on Mixcloud; see "Archives on Mixcloud" in
[`../../backend/README.md`](../../backend/README.md).

## What each screen of the design reads

| Design screen (`frontend/`) | Data today | Endpoint |
|---|---|---|
| **Now**: on-air show, LIVE / AUTOMATED state, now playing | Fixtures and a fixed demo clock | `/v1/now-playing` (plus the ET clock and `/v1/schedule/weekly`) |
| **Now**: Recently played | Fixture list | `/v1/recent` |
| **Now**: play button | Simulated | The existing stream, directly (URL from `/v1/station`) |
| **Schedule** | Hard-coded copy of the calendar | `/v1/schedule/weekly` (or `/v1/schedule` for dated views) |
| **Show page**: description, host | Generated placeholder copy | `/v1/shows` |
| **Archive**: grid, past broadcasts, player | Placeholder dates, album covers, fake timer | `/v1/archives`, `/v1/shows/{showId}/archives`, and audio straight from storage |
| **Station**: Team, Events | Hard-coded lists | `/v1/station` |
| Offline / "Signal Broadcast" state | Editor switch | `/v1/health` (`services.stream.status`) |

With the service unreachable, the frontend must still play the live stream. Keep a built-in fallback
stream URL, and keep showing the last data it received.

## Conventions

- Base path: `/v1`
- JSON responses use `application/json; charset=utf-8`.
- Times are ISO 8601 with offsets; schedule timezone is always named explicitly.
- IDs are stable slugs/UUIDs, never array positions or display names.
- Unknown values are `null`; do not send placeholder strings such as `TBD` or `Null`.
- Public read endpoints permit the production web origin through CORS.
- Responses include `generatedAt` or `asOf` so the client can identify stale data.
- Errors use one envelope:

```json
{
  "error": {
    "code": "schedule_unavailable",
    "message": "The schedule could not be refreshed.",
    "requestId": "01J..."
  }
}
```

## `GET /v1/health`

Provides one operational status without asking the frontend to infer health from several
unrelated requests.

```json
{
  "status": "degraded",
  "checkedAt": "2026-09-25T21:56:00-04:00",
  "services": {
    "stream": { "status": "ok", "latencyMs": 142 },
    "metadata": { "status": "degraded", "freshAt": null },
    "schedule": { "status": "ok", "generatedAt": "2026-09-25T21:45:00-04:00" },
    "archives": { "status": "disabled" }
  }
}
```

This endpoint must not claim the stream is healthy based only on an HTTP status. The
probe should verify that audio bytes are arriving.

**Learned from the prototype**
- **The stream probe.** Read about 8 KB within a few seconds, then disconnect. A `200` with no bytes
  is `down`.
- **Store probe results and serve them.** A listener request should never wait on the upstreams.
- **Schedule details.** Add `services.schedule.lastError`, `warnings` and `unmappedShows`.

## `GET /v1/now-playing`

Normalizes the existing metadata JSON and joins it to the current schedule occurrence.

```json
{
  "asOf": "2026-09-25T21:56:03-04:00",
  "sourceUpdatedAt": "2026-09-25T21:55:58-04:00",
  "live": true,
  "automation": false,
  "track": {
    "title": "Example title",
    "artist": "Example artist",
    "album": null,
    "artworkUrl": null
  },
  "show": {
    "id": "amber-on-audio",
    "name": "Amber on Audio",
    "hostNames": ["Amber"]
  }
}
```

Rules:

- `track` is `null` when title and artist are both absent.
- `sourceUpdatedAt` is required once the publisher can provide or the collector can
  observe it.
- Metadata freshness thresholds belong in the backend and health endpoint, not in
  duplicated frontend heuristics.
- Album/artwork enrichment must have a documented source and rights basis.

**Learned from the prototype**
- **Upstream shape.** The feed is `{"nowplaying": {"ARTIST", "TITLE"}}`, served as
  `binary/octet-stream`. Values may be URL-encoded (`+` for spaces), JSON `null`, or the literal
  string `"Null"` when a DJ streams from a laptop. Replace `+` with a space, URL-decode, and
  treat `null`, `Null`, `unknown` and `-` as missing.
- **`sourceUpdatedAt`.** Take it from the feed's HTTP `Last-Modified` header. S3 sets it on every
  publish.
- **Useful additions:**
  - `stale` (boolean). True when the feed is unreachable, in which case serve the last good track, or
    when `sourceUpdatedAt` is older than a threshold (45 min).
  - `show.occurrenceId`, `show.startsAt`, `show.endsAt`.
  - `nextShow` (same shape as `show`), for "next live show".
- **Errors.** Return a `503` error envelope only if the feed has never been reachable.

## `GET /v1/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD`

Returns dated occurrences rather than only a weekly template. That handles cancellations,
specials, semester breaks and one-off changes correctly.

```json
{
  "timezone": "America/New_York",
  "generatedAt": "2026-09-25T21:45:00-04:00",
  "source": "google-calendar",
  "occurrences": [
    {
      "id": "2026-09-30T17:00:00-04:00_amber-on-audio",
      "showId": "amber-on-audio",
      "startsAt": "2026-09-30T17:00:00-04:00",
      "endsAt": "2026-09-30T18:00:00-04:00",
      "cancelled": false
    }
  ]
}
```

The existing weekly `tools/schedule-snapshot.json` can remain as a generated fallback while this API is
introduced.

**Learned from the prototype**
- **Useful occurrence fields.** Beyond the example above: `title`, `hostNames`, `recurring`, and
  `hasProfile` (whether `/v1/shows` has an entry).
- **Occurrences that are cancelled or moved.**
  - Expand weekly `RRULE`s with `EXDATE`, `UNTIL`, `COUNT` and `INTERVAL`.
  - Apply `RECURRENCE-ID` overrides. A moved instance takes its new time; a `STATUS:CANCELLED`
    instance becomes `cancelled: true`.
  - Keep ET wall-clock times across daylight saving.
  - The current `fetch_schedule.py` flattens all of this into a permanent weekly grid.
- **Last known good.**
  - Reject a calendar response that is not a complete `VCALENDAR` or has no events, and keep serving
    the previous snapshot.
  - Report the failure through `/v1/health` (`services.schedule.lastError`).
  - Overlaps and empty weeks are warnings, not rejections.
- **Add `GET /v1/schedule/weekly?week=YYYY-MM-DD`.**
  - It returns one real week in the exact `tools/schedule-snapshot.json` shape, plus `showId`, `occurrenceId` and
    `recurring` per slot and `weekOf` / `contentChangedAt` at the top level (all declared in
    `schemas/schedule-weekly.schema.json`, which the mobile app's types are generated from).
  - Existing frontends can switch source without a rewrite. Built from the current calendar, it
    reproduced the committed `tools/schedule-snapshot.json` exactly.
  - Its `generatedAt` should mean "last confirmed current" (the last successful check), so a
    frontend can flag stale schedules honestly.
- **Map show names to IDs with the same slug rule as `fetch_schedule.py`.** Keep an `aliases` list per
  profile for renamed shows. Report names with no profile in `/v1/health`
  (`services.schedule.unmappedShows`) rather than creating profiles automatically.

## `GET /v1/shows`

Returns station-approved editorial records independent of calendar occurrences.

```json
{
  "updatedAt": "2026-09-25T18:00:00-04:00",
  "shows": [
    {
      "id": "amber-on-audio",
      "name": "Amber on Audio",
      "genres": [],
      "description": null,
      "hostNames": ["Amber"],
      "hostBio": null,
      "artwork": null,
      "active": true
    }
  ]
}
```

`artwork`, when present:

```json
{
  "url": "https://media.wjrh.org/shows/amber-on-audio/cover.jpg",
  "width": 1200,
  "height": 1200,
  "alt": "Station-approved Amber on Audio artwork"
}
```

## `GET /v1/recent?limit=20&since=<ISO-8601>`

Returns station-wide observations from a server-side metadata collector.

```json
{
  "asOf": "2026-09-25T21:56:03-04:00",
  "items": [
    {
      "id": "01J...",
      "type": "track",
      "title": "Example title",
      "artist": "Example artist",
      "album": null,
      "startedAt": "2026-09-25T21:52:14-04:00",
      "endedAt": null,
      "showId": "amber-on-audio",
      "occurrenceId": "2026-09-30T17:00:00-04:00_amber-on-audio"
    }
  ]
}
```

Collector rules:

- Poll the existing feed at an agreed interval.
- Decode URL-encoded values and normalize empty/`Null` values.
- Deduplicate consecutive identical title/artist pairs.
- Record the observation time and source payload for debugging.
- Do not infer an exact start time more precise than the polling interval.
- Define retention before launch.

**Learned from the prototype**
- **Collector timing.** Cron's minimum interval is one minute. Listener requests to `/v1/now-playing`
  can also feed the collector.
- **Concurrent writers.** Guard against them with a compare-and-set on the current track, so each
  change is recorded once.
- **Short metadata gaps.** A gap inside one track (one `Null` poll, then the same track) should reopen
  the previous entry instead of creating a second play. A 5-minute window works.
- **`startedAt`.** Use the feed's `Last-Modified` when it's plausible (within 10 minutes);
  otherwise use the observation time.

## `GET /v1/shows/{showId}/archives`

Only return published episodes that listeners are allowed to play.

```json
{
  "showId": "amber-on-audio",
  "episodes": [
    {
      "id": "01J...",
      "title": "Amber on Audio",
      "recordedAt": "2026-09-30T17:00:00-04:00",
      "publishedAt": "2026-09-30T20:15:00-04:00",
      "durationSeconds": 3598,
      "audioUrl": "https://media.wjrh.org/archives/01J....mp3",
      "mimeType": "audio/mpeg",
      "byteRangeSupported": true,
      "artwork": null,
      "description": null
    }
  ]
}
```

The media URL should point to object storage/CDN rather than proxying large audio files
through the application API. The media host must support range requests for seeking.

**Learned from the prototype**
- Include `"enabled": false` in the response while archives are switched off, so the frontend can
  explain an empty Archive tab.
- Add `GET /v1/archives`, the index the Archive grid needs:

```json
{
  "asOf": "2026-09-30T21:00:00-04:00",
  "enabled": true,
  "shows": [
    { "showId": "amber-on-audio", "name": "Amber on Audio", "episodeCount": 3,
      "latestRecordedAt": "2026-09-30T17:00:00-04:00", "artwork": null }
  ]
}
```

## `GET /v1/station`

Station content the design currently hard-codes: the team roster, events, and where to listen.

```json
{
  "updatedAt": "2026-09-27T00:00:00-04:00",
  "approved": false,
  "team": [],
  "events": [{ "name": "Record Painting with WJRH", "date": "2025-10-16" }],
  "listen": { "streamUrl": "https://internetstreamer.lafayette.edu/" }
}
```

`approved` stays `false` until the station confirms the roster each semester. While it is `false` the API sends `team: []`: the roster (students' names and emails) is held back by the server, not only hidden by the app, because anyone can call a public API directly.

## Archive management endpoints

These are authenticated staff operations and should not be exposed to the public client:

- `POST /v1/admin/archives` — register an ingested recording.
- `PATCH /v1/admin/archives/{episodeId}` — edit metadata or publish/unpublish.
- `DELETE /v1/admin/archives/{episodeId}` — remove according to the retention policy.

Authentication, roles and audit logging must be selected before implementing these
operations. At minimum, record who changed publication state and when.

**Learned from the prototype**
- **Episode lifecycle:** `uploading → pending_review → published ⇄ unpublished`. Reject any other
  transition with `409`.
- **Registering an episode.** `POST` returns the episode plus a one-time presigned `PUT` URL, so
  audio goes straight to storage and never through the API.
- **Moving to `pending_review`.** First confirm the object exists and has an `audio/*` type.
- **Publishing** requires `durationSeconds`.
- **`GET /v1/admin/audit?entityId=`** returns the trail.
- **Retention** deletes both the object and the record, and logs the expiry.

## `POST /v1/join`

Adapter for the station-approved mailing-list or form provider.

Request:

```json
{ "email": "listener@example.edu", "source": "listener-app" }
```

Success:

```json
{ "accepted": true, "confirmationRequired": true }
```

Requirements:

- rate limiting and abuse protection;
- no email logging beyond what operations genuinely need;
- clear provider confirmation behavior;
- generic responses that do not reveal whether an address is already subscribed; and
- a documented deletion/retention policy.

## Push reminders, if approved

Browser push adds substantial operational and privacy scope. If chosen, use:

- `POST /v1/push-subscriptions`
- `DELETE /v1/push-subscriptions/{id}`
- `PUT /v1/push-subscriptions/{id}/shows/{showId}`

Subscriptions must be revocable, expire cleanly and never be treated as user accounts.
Schedule changes and cancellations must update queued notifications.

## Cache guidance

| Endpoint | Suggested policy |
|---|---|
| `/v1/health` | `no-store` or very short TTL |
| `/v1/now-playing` | `no-store` or TTL below poll interval |
| `/v1/schedule` | short public cache with `ETag`; stale-if-error allowed |
| `/v1/shows` | public cache with `ETag`; purge on publish |
| `/v1/recent` | short public cache |
| Archive lists | public cache with purge on publish/unpublish |
| Archive media | long immutable cache when URLs are versioned |

## Contract tests required

- Null and malformed metadata normalize to `track: null` without a server error.
- A cancelled or changed calendar event updates dated occurrences.
- Every schedule `showId` resolves to zero or one show profile; unresolved IDs are
  reported to operators.
- Recent-spin deduplication is deterministic.
- Archive list never includes unpublished episodes.
- Media supports byte ranges and reports the expected duration.
- CORS permits only the intended public read access and required production origins.
- Stale upstream data is marked stale rather than returned as current.

