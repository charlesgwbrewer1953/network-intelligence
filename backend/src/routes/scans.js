const express = require('express');
const pool = require('../db');
const { logger } = require('../middleware/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const { rows } = await pool.query(
    `SELECT s.*,
       a.name AS agent_name,
       EXTRACT(EPOCH FROM (s.finished_at - s.started_at))::int AS duration_seconds
     FROM scans s
     LEFT JOIN agents a ON a.agent_id = s.agent_id
     ORDER BY s.started_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json(rows);
});

router.get('/pending', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM scans
     WHERE finished_at IS NULL
     AND scan_type = 'manual'
     AND started_at > NOW() - INTERVAL '10 minutes'
     ORDER BY started_at ASC
     LIMIT 1`
  );
  res.json(rows[0] || null);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const scanResult = await pool.query(
    `SELECT s.*, a.name AS agent_name,
       EXTRACT(EPOCH FROM (s.finished_at - s.started_at))::int AS duration_seconds
     FROM scans s
     LEFT JOIN agents a ON a.agent_id = s.agent_id
     WHERE s.scan_id = $1`,
    [id]
  );

  if (scanResult.rows.length === 0) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const observationsResult = await pool.query(
    `SELECT so.*, d.user_name, d.device_type, d.manufacturer
     FROM scan_observations so
     LEFT JOIN devices d ON d.device_id = so.device_id
     WHERE so.scan_id = $1
     ORDER BY so.seen_at`,
    [id]
  );

  res.json({
    scan: scanResult.rows[0],
    observations: observationsResult.rows,
  });
});

router.post('/', async (req, res) => {
  const { agent_id, scan_type = 'manual' } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO scans (agent_id, scan_type, started_at)
     VALUES ($1, $2, NOW())
     RETURNING *`,
    [agent_id || null, scan_type]
  );

  logger.info('scan created', { scan_id: rows[0].scan_id, scan_type });
  res.status(201).json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { finished_at, devices_found } = req.body;

  const updates = [];
  const values = [id];

  if (finished_at !== undefined) {
    updates.push(`finished_at = $${values.length + 1}`);
    values.push(finished_at);
  }
  if (devices_found !== undefined) {
    updates.push(`devices_found = $${values.length + 1}`);
    values.push(devices_found);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { rows } = await pool.query(
    `UPDATE scans SET ${updates.join(', ')} WHERE scan_id = $1 RETURNING *`,
    values
  );

  if (rows.length === 0) return res.status(404).json({ error: 'Scan not found' });
  res.json(rows[0]);
});

module.exports = router;
