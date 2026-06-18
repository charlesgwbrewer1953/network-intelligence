const express = require('express');
const pool = require('../db');
const { logger } = require('../middleware/logger');

const router = express.Router();

async function generateDiagnostics() {
  const results = [];
  const now = new Date();

  const { rows: devices } = await pool.query(
    `SELECT d.*,
       (SELECT COUNT(*)::int FROM scan_observations WHERE device_id = d.device_id) AS total_observations
     FROM devices d`
  );

  const { rows: recentScans } = await pool.query(
    `SELECT scan_id FROM scans ORDER BY started_at DESC LIMIT 15`
  );
  const recentScanIds = recentScans.map(s => s.scan_id);

  for (const device of devices) {
    const name = device.user_name || device.hostname || device.primary_mac;

    // Device not seen in over 24 hours
    const hoursSinceLastSeen = (now - new Date(device.last_seen)) / (1000 * 60 * 60);
    if (hoursSinceLastSeen > 24) {
      results.push({
        device_id: device.device_id,
        severity: 'critical',
        plain_language: `${name} has not been seen on the network for more than ${Math.round(hoursSinceLastSeen)} hours.`,
        technical_detail: `Last seen: ${device.last_seen}. Device MAC: ${device.primary_mac}.`,
        recommended_action: 'Check if the device is powered on and connected to the network.',
      });
    } else if (hoursSinceLastSeen > 1) {
      results.push({
        device_id: device.device_id,
        severity: 'warning',
        plain_language: `${name} has not been seen in the last hour.`,
        technical_detail: `Last seen: ${device.last_seen}. Device MAC: ${device.primary_mac}.`,
        recommended_action: 'Run a new scan to check current status.',
      });
    }

    // New device (first seen within 24 hours)
    const hoursOld = (now - new Date(device.first_seen)) / (1000 * 60 * 60);
    if (hoursOld < 24 && device.total_observations >= 1) {
      results.push({
        device_id: device.device_id,
        severity: 'info',
        plain_language: `${name} is a new device that appeared on the network within the last 24 hours.`,
        technical_detail: `First seen: ${device.first_seen}. MAC: ${device.primary_mac}.`,
        recommended_action: 'Verify this device is expected. Add a name and label via the Devices page.',
      });
    }

    // Frequent disappearances
    if (recentScanIds.length > 0) {
      const { rows: appearances } = await pool.query(
        `SELECT COUNT(DISTINCT scan_id)::int AS seen_in
         FROM scan_observations
         WHERE device_id = $1 AND scan_id = ANY($2::uuid[])`,
        [device.device_id, recentScanIds]
      );
      const seenIn = appearances[0]?.seen_in ?? 0;
      const ratio = recentScanIds.length > 0 ? seenIn / recentScanIds.length : 1;

      if (recentScanIds.length >= 5 && ratio < 0.5) {
        results.push({
          device_id: device.device_id,
          severity: 'warning',
          plain_language: `${name} has been intermittently disappearing from the network.`,
          technical_detail: `Seen in ${seenIn} of the last ${recentScanIds.length} scans (${Math.round(ratio * 100)}% availability).`,
          recommended_action: 'Check wireless signal strength, cable connections, or power supply for this device.',
        });
      }
    }

    // IP address changes
    const { rows: ipChanges } = await pool.query(
      `SELECT COUNT(*)::int AS changes
       FROM device_history
       WHERE device_id = $1 AND event_type = 'ip_changed'
         AND event_time > NOW() - INTERVAL '7 days'`,
      [device.device_id]
    );
    if (ipChanges[0]?.changes > 2) {
      results.push({
        device_id: device.device_id,
        severity: 'info',
        plain_language: `${name} has changed IP address ${ipChanges[0].changes} times in the last 7 days.`,
        technical_detail: `Device MAC: ${device.primary_mac}. Frequent IP changes may indicate DHCP lease issues.`,
        recommended_action: 'Consider assigning a static IP or a DHCP reservation for this device.',
      });
    }
  }

  // No scans ever
  const { rows: scanCount } = await pool.query('SELECT COUNT(*)::int AS total FROM scans');
  if (scanCount[0].total === 0) {
    results.push({
      device_id: null,
      severity: 'info',
      plain_language: 'No scans have been run yet.',
      technical_detail: 'The scan history table is empty.',
      recommended_action: 'Start the discovery agent or trigger a manual scan via POST /api/scans.',
    });
  }

  logger.info('diagnostics generated', { count: results.length });
  return results;
}

router.get('/', async (req, res) => {
  const diagnostics = await generateDiagnostics();
  res.json(diagnostics);
});

module.exports = router;
