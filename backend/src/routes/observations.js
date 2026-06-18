const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const { device_id, scan_id } = req.query;

  const conditions = [];
  const values = [limit];

  if (device_id) {
    conditions.push(`so.device_id = $${values.length + 1}`);
    values.push(device_id);
  }
  if (scan_id) {
    conditions.push(`so.scan_id = $${values.length + 1}`);
    values.push(scan_id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT so.*, d.user_name, d.device_type
     FROM scan_observations so
     LEFT JOIN devices d ON d.device_id = so.device_id
     ${where}
     ORDER BY so.seen_at DESC
     LIMIT $1`,
    values
  );

  res.json(rows);
});

router.post('/', async (req, res) => {
  const { scan_id, device_id, observed_mac, ip_address, hostname, latency_ms, packet_loss, signal_strength } = req.body;
  if (!scan_id || !observed_mac) {
    return res.status(400).json({ error: 'scan_id and observed_mac are required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO scan_observations
       (scan_id, device_id, observed_mac, ip_address, hostname, latency_ms, packet_loss, signal_strength)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [scan_id, device_id || null, observed_mac, ip_address || null, hostname || null,
     latency_ms || null, packet_loss || null, signal_strength || null]
  );

  res.status(201).json(rows[0]);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    `SELECT so.*, d.user_name, d.device_type, d.manufacturer
     FROM scan_observations so
     LEFT JOIN devices d ON d.device_id = so.device_id
     WHERE so.observation_id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Observation not found' });
  }

  res.json(rows[0]);
});

module.exports = router;
