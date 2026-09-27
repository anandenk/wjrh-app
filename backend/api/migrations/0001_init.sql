-- WJRH application API — initial schema (Cloudflare D1 / SQLite).
-- Times are stored as epoch milliseconds (INTEGER) and rendered as ET ISO strings.

-- Each calendar fetch attempt. The newest row with status='ok' is the live schedule;
-- failed or rejected fetches never replace it (last known good).
CREATE TABLE schedule_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fetched_at  INTEGER NOT NULL,
  checked_at  INTEGER NOT NULL,          -- last time the same content was re-confirmed
  status      TEXT    NOT NULL CHECK (status IN ('ok', 'rejected', 'error')),
  source_hash TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  events_json TEXT,                      -- normalized VEVENTs (see src/ics.ts)
  warnings    TEXT,                      -- JSON array of strings
  error       TEXT
);
CREATE INDEX schedule_snapshots_ok ON schedule_snapshots (status, id);

-- Single-row state for the now-playing collector.
CREATE TABLE collector_state (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  track_key         TEXT,                -- lower(title)|lower(artist) of the open observation
  observation_id    TEXT,
  last_polled_at    INTEGER,
  last_ok_at        INTEGER,
  source_updated_at INTEGER,
  last_payload      TEXT,                -- normalized track JSON last served
  last_error        TEXT
);
INSERT INTO collector_state (id) VALUES (1);

-- Station-wide play history built by the collector.
CREATE TABLE observations (
  id            TEXT PRIMARY KEY,        -- ULID
  title         TEXT,
  artist        TEXT,
  album         TEXT,
  started_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  ended_at      INTEGER,
  show_id       TEXT,
  occurrence_id TEXT,
  raw           TEXT                     -- source payload, for troubleshooting only
);
CREATE INDEX observations_started ON observations (started_at DESC);
CREATE INDEX observations_show ON observations (show_id, started_at DESC);

-- Latest probe result per service.
CREATE TABLE health_checks (
  service    TEXT PRIMARY KEY,
  status     TEXT    NOT NULL,
  checked_at INTEGER NOT NULL,
  latency_ms INTEGER,
  detail     TEXT                        -- JSON
);

CREATE TABLE episodes (
  id               TEXT PRIMARY KEY,     -- ULID
  show_id          TEXT    NOT NULL,
  occurrence_id    TEXT,
  status           TEXT    NOT NULL CHECK (status IN ('uploading', 'pending_review', 'published', 'unpublished')),
  object_key       TEXT    NOT NULL UNIQUE,
  mime_type        TEXT    NOT NULL,
  bytes            INTEGER,
  duration_seconds INTEGER,
  recorded_at      INTEGER NOT NULL,
  published_at     INTEGER,
  title            TEXT,
  description      TEXT,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  created_by       TEXT
);
CREATE INDEX episodes_show ON episodes (show_id, status, recorded_at DESC);

-- Who changed what, and when. Never deleted with the episode.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          INTEGER NOT NULL,
  actor       TEXT    NOT NULL,
  action      TEXT    NOT NULL,
  entity      TEXT    NOT NULL,
  entity_id   TEXT    NOT NULL,
  detail      TEXT
);
CREATE INDEX audit_entity ON audit_log (entity, entity_id);

CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

-- Dev-only "log" join provider outbox. A real provider replaces this.
CREATE TABLE join_outbox (
  id         TEXT PRIMARY KEY,
  email      TEXT    NOT NULL,
  source     TEXT,
  created_at INTEGER NOT NULL
);
