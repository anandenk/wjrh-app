# Phase 0: the API against the real station

Run on 2026-09-28, 19:44–20:11 ET (a Monday evening), with `backend/scripts/dev-real.sh`.
Everything was read-only: the API only fetched from the station.

## Result

The API worked against the real stream, now-playing feed and calendar **with no code changes**.
The fakes in `backend/mocks/` already copy the real feed's quirks.

| What | Real behavior | Handled? |
|---|---|---|
| Stream | `audio/mpeg`, 128 kbps, Shoutcast ICY headers, HTTPS | Yes: health check reads it as `ok` |
| Now-playing feed | `{"nowplaying": {"ARTIST", "TITLE"}}`, URL-encoded (`%20`), served as `binary/octet-stream` from S3/CloudFront | Yes: decoded correctly |
| Album | Never sent | Yes: `album` is `null`, health reports `albumSupplied: false` |
| Calendar | 29 events: weekly series, a series split in two (SoupBurger!!), one-offs, one moved occurrence (`RECURRENCE-ID`), a 2-hour show | Yes: `/v1/schedule` matched the calendar event for event |
| Show ends with nothing after it | At 20:00 the feed kept updating (automation plays songs with metadata) | Yes: `live: false`, `automation: true`, songs still shown, recent list kept building |

Songs changed every 3–4 minutes, and `/v1/recent` recorded each one with the right show.

## Fixed

- `tools/schedule-snapshot.json` was out of date (API on Air moved; The Bit is now 2 hours).
  Refreshed with `tools/fetch_schedule.py`. The API doesn't use this file.

## Not tested yet

- A DJ streaming from their own laptop (the feed sends `"Null"`). The fakes cover this case,
  but we haven't seen it happen live.
- The stream or feed going down.
- Late night and overnight hours.
- Mixcloud archives: they stay on the fake until the station decides (decision 002).
