const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT nr.*,
      p.primary_mac AS parent_mac, p.hostname AS parent_hostname, p.device_type AS parent_type,
      c.primary_mac AS child_mac,  c.hostname AS child_hostname,  c.device_type AS child_type
    FROM network_relationships nr
    JOIN devices p ON p.device_id = nr.parent_device_id
    JOIN devices c ON c.device_id = nr.child_device_id
    ORDER BY nr.confidence DESC, nr.last_seen DESC
  `);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { parent_device_id, child_device_id, relationship_type, network_id, confidence, evidence } = req.body;
  if (!parent_device_id || !child_device_id || !relationship_type) {
    return res.status(400).json({ error: 'parent_device_id, child_device_id, relationship_type required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO network_relationships
       (parent_device_id, child_device_id, relationship_type, network_id, confidence, evidence)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT ON CONSTRAINT network_relationships_unique DO UPDATE SET
       confidence = GREATEST(EXCLUDED.confidence, network_relationships.confidence),
       last_seen  = NOW()
     RETURNING *`,
    [parent_device_id, child_device_id, relationship_type,
     network_id || null, confidence ?? 1.0, evidence || null]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
