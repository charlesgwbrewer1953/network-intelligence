const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT ni.*, n.cidr AS network_cidr
    FROM network_interfaces ni
    LEFT JOIN networks n ON n.network_id = ni.network_id
    ORDER BY ni.last_seen DESC
  `);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, display_name, interface_type, ip_address, subnet_mask, cidr, mac_address, gateway_ip, network_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { rows } = await pool.query(
    `INSERT INTO network_interfaces
       (name, display_name, interface_type, ip_address, subnet_mask, cidr, mac_address, gateway_ip, network_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT ON CONSTRAINT network_interfaces_name_unique DO UPDATE SET
       ip_address     = COALESCE(EXCLUDED.ip_address, network_interfaces.ip_address),
       gateway_ip     = COALESCE(EXCLUDED.gateway_ip, network_interfaces.gateway_ip),
       network_id     = COALESCE(EXCLUDED.network_id, network_interfaces.network_id),
       is_active      = true,
       last_seen      = NOW()
     RETURNING *`,
    [name, display_name || null, interface_type || null, ip_address || null,
     subnet_mask || null, cidr || null, mac_address || null, gateway_ip || null, network_id || null]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
