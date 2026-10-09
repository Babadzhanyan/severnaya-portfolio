CREATE TABLE IF NOT EXISTS versions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_hash char(64) UNIQUE NOT NULL,
    snapshot jsonb NOT NULL,
    google_signature text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE TABLE IF NOT EXISTS current_snapshot (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    version_id bigint REFERENCES versions(id),
    checked_at timestamptz,
    last_attempt_at timestamptz,
    source_status text NOT NULL DEFAULT 'waiting',
    last_error text,
    CHECK (source_status IN ('waiting', 'ok', 'error'))
);

INSERT INTO current_snapshot(singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS initiatives (
    code text PRIMARY KEY CHECK (code ~ '^ИТ-[0-9]{3}$'),
    record jsonb NOT NULL,
    source_hash char(64) NOT NULL REFERENCES versions(source_hash),
    version_id bigint NOT NULL REFERENCES versions(id),
    CHECK (record ->> 'code' = code)
);
CREATE INDEX IF NOT EXISTS versions_created_at ON versions(created_at DESC);
