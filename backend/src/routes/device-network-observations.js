const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { device_id, network_id, limit: lim = 100 } = req.query;
  const limit = Math.min(parseInt(lim), 500);
  const conditions = [];
  const values = [limit];

  if (device_id)  { conditions.push(`dno.device_id  = $${values.length + 1}`); values.push(device_id); }
  if (network_id) { conditions.push(`dno.network_id = $${values.length + 1}`); values.push(network_id); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(`
    SELECT dno.*,
      d.primary_mac, d.hostname, d.device_type,
      n.cidr, n.network_type, n.gateway_ip
    FROM device_network_observations dno
    JOIN devices d ON d.device_id = dno.device_id
    JOIN networks n ON n.network_id = dno.network_id
    ${where}
    ORDER BY dno.seen_at DESC
    LIMIT $1
  `, values);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { device_id, scan_id, network_id, interface_name, observed_ip } = req.body;
  if (!device_id || !scan_id || !network_id) {
    return res.status(400).json({ error: 'device_id, scan_id, network_id required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO device_network_observations (device_id, scan_id, network_id, interface_name, observed_ip)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [device_id, scan_id, network_id, interface_name || null, observed_ip || null]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
