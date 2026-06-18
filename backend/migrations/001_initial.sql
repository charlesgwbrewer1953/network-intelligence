-- Initial schema for network-intelligence

CREATE TABLE IF NOT EXISTS agents (
  agent_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  hostname    TEXT,
  location    TEXT,
  ip_address  TEXT,
  mac_address TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS devices (
  device_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_mac TEXT UNIQUE NOT NULL,
  user_name   TEXT,
  hostname    TEXT,
  manufacturer TEXT,
  device_type TEXT,
  location    TEXT,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
  scan_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID REFERENCES agents(agent_id) ON DELETE SET NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  devices_found INTEGER NOT NULL DEFAULT 0,
  scan_type     TEXT NOT NULL DEFAULT 'manual',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_observations (
  observation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
  device_id       UUID REFERENCES devices(device_id) ON DELETE SET NULL,
  observed_mac    TEXT NOT NULL,
  ip_address      TEXT,
  hostname        TEXT,
  latency_ms      NUMERIC,
  packet_loss     NUMERIC,
  signal_strength NUMERIC,
  seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_history (
  history_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  event_time  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scans_started_at ON scans(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_scan_id ON scan_observations(scan_id);
CREATE INDEX IF NOT EXISTS idx_observations_device_id ON scan_observations(device_id);
CREATE INDEX IF NOT EXISTS idx_device_history_device_id ON device_history(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen DESC);
