require('dotenv').config();
const { runScan } = require('./scanner');
const { reportScan } = require('./reporter');

const INTERVAL_MS = parseInt(process.env.SCAN_INTERVAL_MS) || 5 * 60 * 1000; // default 5 min

async function tick() {
  console.log(`[${new Date().toISOString()}] Starting scan…`);
  try {
    const observations = await runScan();
    console.log(`  Discovered ${observations.length} device(s)`);

    const { scanId, count } = await reportScan(observations);
    console.log(`  Reported scan ${scanId} with ${count} observation(s)`);
  } catch (err) {
    console.error('  Scan error:', err.message);
  }
}

async function main() {
  console.log(`Network Intelligence Agent starting`);
  console.log(`  API: ${process.env.API_URL || 'http://localhost:3101'}`);
  console.log(`  Interval: ${INTERVAL_MS / 1000}s`);

  await tick();
  setInterval(tick, INTERVAL_MS);
}

main();
