-- Network topology tables

CREATE TABLE IF NOT EXISTS networks (
  network_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidr          TEXT NOT NULL,
  name          TEXT,
  network_type  TEXT,
  gateway_ip    TEXT,
  gateway_mac   TEXT,
  first_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT networks_cidr_unique UNIQUE (cidr)
);

CREATE TABLE IF NOT EXISTS network_interfaces (
  interface_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  display_name   TEXT,
  interface_type TEXT,
  ip_address     TEXT,
  subnet_mask    TEXT,
  cidr           TEXT,
  mac_address    TEXT,
  gateway_ip     TEXT,
  network_id     UUID REFERENCES networks(network_id) ON DELETE SET NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT network_interfaces_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS device_networks (
  device_id  UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  network_id UUID NOT NULL REFERENCES networks(network_id) ON DELETE CASCADE,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, network_id)
);

CREATE TABLE IF NOT EXISTS network_relationships (
  relationship_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_device_id UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  child_device_id  UUID NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  network_id       UUID REFERENCES networks(network_id) ON DELETE SET NULL,
  confidence       NUMERIC NOT NULL DEFAULT 1.0,
  evidence         TEXT,
  first_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT network_relationships_unique UNIQUE (parent_device_id, child_device_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_device_networks_device ON device_networks(device_id);
CREATE INDEX IF NOT EXISTS idx_device_networks_network ON device_networks(network_id);
CREATE INDEX IF NOT EXISTS idx_relationships_parent ON network_relationships(parent_device_id);
CREATE INDEX IF NOT EXISTS idx_relationships_child ON network_relationships(child_device_id);
CREATE INDEX IF NOT EXISTS idx_network_interfaces_network ON network_interfaces(network_id);
