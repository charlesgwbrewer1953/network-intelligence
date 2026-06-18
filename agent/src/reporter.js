const axios = require('axios');

const API_BASE = process.env.API_URL || 'http://localhost:3101';
const AGENT_ID = process.env.AGENT_ID || null;

const api = axios.create({ baseURL: API_BASE });

async function getOrCreateDevice(mac, observationData) {
  try {
    const { data } = await api.post('/api/devices', {
      primary_mac: mac,
      hostname: observationData.hostname || null,
    });
    return data.device_id;
  } catch (err) {
    if (err.response?.status === 409 || err.response?.status === 400) {
      const { data: devices } = await api.get('/api/devices');
      const existing = devices.find(d => d.primary_mac === mac);
      return existing?.device_id || null;
    }
    throw err;
  }
}

async function buildAndPostObservations(observations, scanId) {
  const payloads = [];
  for (const obs of observations) {
    let deviceId = null;
    if (obs.observed_mac) {
      deviceId = await getOrCreateDevice(obs.observed_mac, obs);
    }
    payloads.push({ ...obs, scan_id: scanId, device_id: deviceId });
  }

  for (const payload of payloads) {
    try {
      await api.post('/api/observations', payload);
    } catch (err) {
      console.warn('Failed to post observation:', err.message);
    }
  }

  await api.patch(`/api/scans/${scanId}`, {
    finished_at: new Date().toISOString(),
    devices_found: payloads.length,
  }).catch(() => {});

  return { scanId, count: payloads.length };
}

async function reportScan(observations) {
  const { data: scan } = await api.post('/api/scans', {
    agent_id: AGENT_ID,
    scan_type: 'agent',
  });
  return buildAndPostObservations(observations, scan.scan_id);
}

async function reportExistingScan(observations, scanId) {
  return buildAndPostObservations(observations, scanId);
}

module.exports = { reportScan, reportExistingScan, api };
