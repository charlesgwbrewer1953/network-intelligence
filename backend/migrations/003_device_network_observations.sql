-- Add SSID field to network_interfaces
ALTER TABLE network_interfaces ADD COLUMN IF NOT EXISTS ssid TEXT;

-- Per-scan observation linking device ↔ network ↔ interface
CREATE TABLE IF NOT EXISTS device_network_observations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id      UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  scan_id        UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
  network_id     UUID NOT NULL REFERENCES networks(network_id) ON DELETE CASCADE,
  interface_name TEXT,
  observed_ip    TEXT,
  seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dno_device    ON device_network_observations(device_id);
CREATE INDEX IF NOT EXISTS idx_dno_network   ON device_network_observations(network_id);
CREATE INDEX IF NOT EXISTS idx_dno_scan      ON device_network_observations(scan_id);
CREATE INDEX IF NOT EXISTS idx_dno_seen_at   ON device_network_observations(seen_at DESC);
