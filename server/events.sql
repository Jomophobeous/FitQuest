-- Events table for silent activity logging (Phase 20+22)
-- Phase 22 added metadata column for flexible anomaly JSON

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id),
    device_id TEXT REFERENCES devices(device_id),
    event_type TEXT NOT NULL,
    ip TEXT,
    metadata TEXT,
    timestamp TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_device_id ON events(device_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
