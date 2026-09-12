-- One-pilgrim journey database.
-- Mirrors toRecords() in src/engine/machine.js, for syncing device records to a
-- backend later. Written for PostgreSQL; for SQLite use TEXT for timestamps and
-- INTEGER (0/1) for booleans.
--
-- The device is the source of truth during the ritual (it must work offline);
-- the server only ever receives completed or in-progress snapshots.

CREATE TABLE umrah_session (
  id              TEXT PRIMARY KEY,
  user_id         TEXT        NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  status          TEXT        NOT NULL CHECK (status IN ('active', 'complete', 'abandoned')),
  current_stage   TEXT        NOT NULL,          -- see STAGE_ORDER in src/engine/stages.js
  gender          TEXT        NOT NULL CHECK (gender IN ('male', 'female')),
  language        TEXT        NOT NULL DEFAULT 'en',
  miqat_route_id  TEXT,
  two_rakah_at    TIMESTAMPTZ,
  zamzam_at       TIMESTAMPTZ,
  hair_method     TEXT CHECK (hair_method IN ('shave', 'shorten')),
  ihram_exited_at TIMESTAMPTZ,
  CHECK (NOT (gender = 'female' AND hair_method = 'shave'))
);

CREATE TABLE tawaf_session (
  id               TEXT PRIMARY KEY,
  umrah_session_id TEXT        NOT NULL REFERENCES umrah_session (id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ NOT NULL,
  completed_at     TIMESTAMPTZ,
  current_round    SMALLINT    NOT NULL CHECK (current_round BETWEEN 1 AND 7),
  status           TEXT        NOT NULL CHECK (status IN ('in_progress', 'complete')),
  UNIQUE (umrah_session_id)
);

CREATE TABLE tawaf_rounds (
  id                  TEXT PRIMARY KEY,
  tawaf_session_id    TEXT     NOT NULL REFERENCES tawaf_session (id) ON DELETE CASCADE,
  round_number        SMALLINT NOT NULL CHECK (round_number BETWEEN 1 AND 7),
  started_at          TIMESTAMPTZ,                 -- NULL when set by a correction
  completed_at        TIMESTAMPTZ,
  confirmed           BOOLEAN  NOT NULL,           -- always confirmed by the pilgrim, never inferred
  tracking_confidence TEXT     NOT NULL CHECK (tracking_confidence IN ('high', 'medium', 'low', 'manual')),
  source              TEXT     NOT NULL CHECK (source IN ('confirmed', 'correction')),
  UNIQUE (tawaf_session_id, round_number)
);

CREATE TABLE sai_session (
  id               TEXT PRIMARY KEY,
  umrah_session_id TEXT        NOT NULL REFERENCES umrah_session (id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ NOT NULL,
  completed_at     TIMESTAMPTZ,
  current_lap      SMALLINT    NOT NULL CHECK (current_lap BETWEEN 1 AND 7),
  status           TEXT        NOT NULL CHECK (status IN ('in_progress', 'complete')),
  UNIQUE (umrah_session_id)
);

CREATE TABLE sai_laps (
  id                  TEXT PRIMARY KEY,
  sai_session_id      TEXT     NOT NULL REFERENCES sai_session (id) ON DELETE CASCADE,
  lap_number          SMALLINT NOT NULL CHECK (lap_number BETWEEN 1 AND 7),
  start_location      TEXT     NOT NULL CHECK (start_location IN ('SAFA', 'MARWAH')),
  end_location        TEXT     NOT NULL CHECK (end_location IN ('SAFA', 'MARWAH')),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  confirmed           BOOLEAN  NOT NULL,
  tracking_confidence TEXT     NOT NULL CHECK (tracking_confidence IN ('high', 'medium', 'low', 'manual')),
  source              TEXT     NOT NULL CHECK (source IN ('confirmed', 'correction')),
  UNIQUE (sai_session_id, lap_number),
  -- Odd laps run Safa -> Marwah, even laps Marwah -> Safa; lap 7 ends at Marwah.
  CHECK (
    (lap_number % 2 = 1 AND start_location = 'SAFA' AND end_location = 'MARWAH') OR
    (lap_number % 2 = 0 AND start_location = 'MARWAH' AND end_location = 'SAFA')
  )
);

CREATE TABLE ritual_pauses (
  id               BIGSERIAL PRIMARY KEY,
  umrah_session_id TEXT        NOT NULL REFERENCES umrah_session (id) ON DELETE CASCADE,
  stage            TEXT        NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ
);

CREATE TABLE count_corrections (
  id               BIGSERIAL PRIMARY KEY,
  umrah_session_id TEXT        NOT NULL REFERENCES umrah_session (id) ON DELETE CASCADE,
  kind             TEXT        NOT NULL CHECK (kind IN ('tawaf', 'sai')),
  from_value       TEXT        NOT NULL,           -- round/lap number, or 'complete'
  to_value         SMALLINT    NOT NULL CHECK (to_value BETWEEN 1 AND 7),
  at               TIMESTAMPTZ NOT NULL
);

-- Append-only audit log of every action the pilgrim took.
CREATE TABLE ritual_events (
  id               BIGSERIAL PRIMARY KEY,
  umrah_session_id TEXT        NOT NULL REFERENCES umrah_session (id) ON DELETE CASCADE,
  at               TIMESTAMPTZ NOT NULL,
  type             TEXT        NOT NULL,
  stage            TEXT        NOT NULL,           -- stage after the event
  payload          JSONB                           -- round, lap, mode, method, confidence, ...
);

CREATE INDEX ritual_events_session_at ON ritual_events (umrah_session_id, at);
