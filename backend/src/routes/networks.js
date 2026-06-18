const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      n.*,
      ni.name           AS interface_name,
      ni.display_name   AS interface_display_name,
      ni.interface_type,
      ni.ssid,
      ni.ip_address     AS local_ip,
      (
        SELECT COUNT(DISTINCT dno.device_id)::int
        FROM device_network_observations dno
        WHERE dno.network_id = n.network_id
      ) AS device_count,
      (
        SELECT MAX(dno.seen_at)
        FROM device_network_observations dno
        WHERE dno.network_id = n.network_id
      ) AS last_scanned
    FROM networks n
    LEFT JOIN network_interfaces ni ON ni.network_id = n.network_id
    ORDER BY n.last_seen DESC
  `);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { cidr, name, network_type, gateway_ip, gateway_mac } = req.body;
  if (!cidr) return res.status(400).json({ error: 'cidr is required' });

  const { rows } = await pool.query(
    `INSERT INTO networks (cidr, name, network_type, gateway_ip, gateway_mac)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ON CONSTRAINT networks_cidr_unique DO UPDATE SET
       name        = COALESCE(networks.name, EXCLUDED.name),
       network_type = COALESCE(networks.network_type, EXCLUDED.network_type),
       gateway_ip  = COALESCE(EXCLUDED.gateway_ip, networks.gateway_ip),
       gateway_mac = COALESCE(EXCLUDED.gateway_mac, networks.gateway_mac),
       last_seen   = NOW()
     RETURNING *`,
    [cidr, name || null, network_type || null, gateway_ip || null, gateway_mac || null]
  );
  res.status(201).json(rows[0]);
});

router.post('/:networkId/devices', async (req, res) => {
  const { networkId } = req.params;
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });

  const { rows } = await pool.query(
    `INSERT INTO device_networks (device_id, network_id)
     VALUES ($1, $2)
     ON CONFLICT (device_id, network_id) DO UPDATE SET last_seen = NOW()
     RETURNING *`,
    [device_id, networkId]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
