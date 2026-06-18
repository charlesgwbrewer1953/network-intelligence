require('dotenv').config();
const { runScan } = require('./scanner');
const { reportScan, reportExistingScan, api } = require('./reporter');

const INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_MS) || 5 * 60 * 1000;
const PENDING_CHECK_MS = 30 * 1000;

async function tick() {
  console.log(`[${new Date().toISOString()}] Starting scan…`);
  try {
    const { observations, stats } = await runScan();
    console.log(`  ARP entries:   ${stats.raw_arp_entries}`);
    console.log(`  Filtered:      ${stats.filtered_entries}`);
    console.log(`  Valid devices: ${stats.valid_device_entries}`);
    const { scanId, count } = await reportScan(observations);
    console.log(`  Reported scan ${scanId} with ${count} observation(s)`);
  } catch (err) {
    console.error('  Scan error:', err.message);
  }
}

async function checkPending() {
  try {
    const { data } = await api.get('/api/scans/pending');
    if (data && data.scan_id) {
      console.log(`[${new Date().toISOString()}] Processing pending scan ${data.scan_id}…`);
      const { observations, stats } = await runScan();
      console.log(`  ARP entries:   ${stats.raw_arp_entries}`);
      console.log(`  Filtered:      ${stats.filtered_entries}`);
      console.log(`  Valid devices: ${stats.valid_device_entries}`);
      const { count } = await reportExistingScan(observations, data.scan_id);
      console.log(`  Completed pending scan with ${count} observation(s)`);
    }
  } catch (_) {
    // pending check failures are non-fatal
  }
}

async function main() {
  console.log('Network Intelligence Agent starting');
  console.log(`  API:      ${process.env.API_URL || 'http://localhost:3101'}`);
  console.log(`  Scanner:  ${process.env.SCANNER || 'stub'}`);
  console.log(`  Interval: ${INTERVAL_MS / 1000}s`);

  await tick();
  setInterval(tick, INTERVAL_MS);
  setInterval(checkPending, PENDING_CHECK_MS);
}

main();
