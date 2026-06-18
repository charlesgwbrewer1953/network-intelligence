const express = require('express');
const pool = require('../db');
const { logger } = require('../middleware/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      d.*,
      (
        SELECT ip_address
        FROM scan_observations so
        WHERE so.device_id = d.device_id
        ORDER BY seen_at DESC
        LIMIT 1
      ) AS current_ip,
      (
        SELECT COUNT(*)::int
        FROM scan_observations so
        WHERE so.device_id = d.device_id
      ) AS observation_count
    FROM devices d
    ORDER BY d.last_seen DESC
  `);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const deviceResult = await pool.query(
    'SELECT * FROM devices WHERE device_id = $1',
    [id]
  );
  if (deviceResult.rows.length === 0) {
    return res.status(404).json({ error: 'Device not found' });
  }

  const [historyResult, observationsResult] = await Promise.all([
    pool.query(
      'SELECT * FROM device_history WHERE device_id = $1 ORDER BY event_time DESC LIMIT 50',
      [id]
    ),
    pool.query(
      `SELECT so.*, s.started_at AS scan_started_at
       FROM scan_observations so
       JOIN scans s ON s.scan_id = so.scan_id
       WHERE so.device_id = $1
       ORDER BY so.seen_at DESC
       LIMIT 20`,
      [id]
    ),
  ]);

  res.json({
    device: deviceResult.rows[0],
    history: historyResult.rows,
    observations: observationsResult.rows,
  });
});

router.post('/', async (req, res) => {
  const { primary_mac, user_name, hostname, manufacturer, device_type, location, notes } = req.body;
  if (!primary_mac) {
    return res.status(400).json({ error: 'primary_mac is required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO devices (primary_mac, user_name, hostname, manufacturer, device_type, location, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (primary_mac) DO UPDATE SET
       last_seen    = NOW(),
       updated_at   = NOW(),
       hostname     = COALESCE(devices.hostname,     EXCLUDED.hostname),
       manufacturer = COALESCE(devices.manufacturer, EXCLUDED.manufacturer),
       device_type  = COALESCE(devices.device_type,  EXCLUDED.device_type)
     RETURNING *, (xmax = 0) AS created`,
    [primary_mac, user_name, hostname, manufacturer, device_type, location, notes]
  );

  const isNew = rows[0].created;
  if (isNew) {
    logger.info('device created', { device_id: rows[0].device_id, mac: primary_mac });
  }
  res.status(isNew ? 201 : 200).json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const allowed = ['user_name', 'hostname', 'manufacturer', 'device_type', 'location', 'notes'];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const values = [id, ...updates.map(([, v]) => v)];

  const { rows } = await pool.query(
    `UPDATE devices SET ${setClauses}, updated_at = NOW() WHERE device_id = $1 RETURNING *`,
    values
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Device not found' });
  }

  logger.info('device updated', { device_id: id, fields: updates.map(([k]) => k) });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { rowCount } = await pool.query(
    'DELETE FROM devices WHERE device_id = $1',
    [id]
  );

  if (rowCount === 0) {
    return res.status(404).json({ error: 'Device not found' });
  }

  logger.info('device deleted', { device_id: id });
  res.status(204).end();
});

module.exports = router;
