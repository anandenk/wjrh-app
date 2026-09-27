# Proposed backend API contracts

These contracts are a planning baseline, not an existing API. Confirm the host platform,
owners and authentication model before implementation.

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

The existing weekly `schedule.json` can remain as a generated fallback while this API is
introduced.

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

## Archive management endpoints

These are authenticated staff operations and should not be exposed to the public client:

- `POST /v1/admin/archives` — register an ingested recording.
- `PATCH /v1/admin/archives/{episodeId}` — edit metadata or publish/unpublish.
- `DELETE /v1/admin/archives/{episodeId}` — remove according to the retention policy.

Authentication, roles and audit logging must be selected before implementing these
operations. At minimum, record who changed publication state and when.

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

