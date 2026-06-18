const axios = require('axios');

const API_BASE = process.env.API_URL || 'http://localhost:3101';
const AGENT_ID = process.env.AGENT_ID || null;

const api = axios.create({ baseURL: API_BASE });

async function getOrCreateDevice(mac, observationData) {
  try {
    // POST /api/devices — if MAC already exists, the DB unique constraint fires.
    // We rely on the backend to handle 409 or just swallow the error and fetch.
    const { data } = await api.post('/api/devices', {
      primary_mac: mac,
      hostname: observationData.hostname || null,
    });
    return data.device_id;
  } catch (err) {
    if (err.response?.status === 409 || err.response?.status === 400) {
      // Device already exists — fetch existing
      const { data: devices } = await api.get('/api/devices');
      const existing = devices.find(d => d.primary_mac === mac);
      return existing?.device_id || null;
    }
    throw err;
  }
}

async function reportScan(observations) {
  const startedAt = new Date().toISOString();

  // Create scan record
  const { data: scan } = await api.post('/api/scans', {
    agent_id: AGENT_ID,
    scan_type: 'agent',
  });

  const scanId = scan.scan_id;

  // Upsert devices and record observations
  const observationPayloads = [];
  for (const obs of observations) {
    let deviceId = null;
    if (obs.observed_mac) {
      deviceId = await getOrCreateDevice(obs.observed_mac, obs);
    }
    observationPayloads.push({ ...obs, scan_id: scanId, device_id: deviceId });
  }

  // Post each observation
  for (const payload of observationPayloads) {
    try {
      await api.post('/api/observations', payload);
    } catch (err) {
      console.warn('Failed to post observation:', err.message);
    }
  }

  // Update scan with completion
  await api.patch(`/api/scans/${scanId}`, {
    finished_at: new Date().toISOString(),
    devices_found: observationPayloads.length,
  }).catch(() => {});

  return { scanId, count: observationPayloads.length };
}

module.exports = { reportScan };
