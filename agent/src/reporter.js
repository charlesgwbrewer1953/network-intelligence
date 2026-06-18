const axios = require('axios');

const API_BASE = process.env.API_URL || 'http://localhost:3101';
const AGENT_ID = process.env.AGENT_ID || null;

const api = axios.create({ baseURL: API_BASE });

async function getOrCreateDevice(mac, obs) {
  try {
    const { data } = await api.post('/api/devices', {
      primary_mac:  mac,
      hostname:     obs.hostname     || null,
      device_type:  obs.device_type  || null,
      manufacturer: obs.manufacturer || null,
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

async function reportNetworks(networks) {
  const networkIds = {};
  for (const net of networks) {
    try {
      const { data } = await api.post('/api/networks', net);
      networkIds[net.cidr] = data.network_id;
    } catch (err) {
      console.warn('Failed to post network:', net.cidr, err.message);
    }
  }
  return networkIds;
}

async function reportInterfaces(interfaces, networkIds) {
  for (const iface of interfaces) {
    try {
      await api.post('/api/network-interfaces', {
        ...iface,
        network_id: networkIds[iface.cidr] || null,
      });
    } catch (err) {
      console.warn('Failed to post interface:', iface.name, err.message);
    }
  }
}

async function buildAndPostObservations(observations, networks, scanId) {
  const networkIds = await reportNetworks(networks);

  // Determine gateway device IDs for relationship building
  const gatewayMacByNetworkId = {};
  for (const net of networks) {
    if (net.gateway_mac && networkIds[net.cidr]) {
      gatewayMacByNetworkId[networkIds[net.cidr]] = net.gateway_mac;
    }
  }

  const deviceIdByMac = {};
  const payloads = [];

  for (const obs of observations) {
    let deviceId = null;
    if (obs.observed_mac) {
      deviceId = await getOrCreateDevice(obs.observed_mac, obs);
      if (deviceId) deviceIdByMac[obs.observed_mac] = deviceId;
    }
    payloads.push({ ...obs, scan_id: scanId, device_id: deviceId });
  }

  // Post observations
  for (const payload of payloads) {
    try {
      await api.post('/api/observations', payload);
    } catch (err) {
      console.warn('Failed to post observation:', err.message);
    }
  }

  // Record device-network membership and gateway relationships
  for (const [cidr, networkId] of Object.entries(networkIds)) {
    const gatewayMac = gatewayMacByNetworkId[networkId];
    const gatewayDeviceId = gatewayMac ? deviceIdByMac[gatewayMac] : null;

    for (const obs of observations) {
      const deviceId = obs.observed_mac ? deviceIdByMac[obs.observed_mac] : null;
      if (!deviceId) continue;

      // Record network membership
      try {
        await api.post(`/api/networks/${networkId}/devices`, { device_id: deviceId });
      } catch (_) {}

      // Record gateway → client relationship
      if (gatewayDeviceId && deviceId !== gatewayDeviceId) {
        try {
          await api.post('/api/network-relationships', {
            parent_device_id:  gatewayDeviceId,
            child_device_id:   deviceId,
            relationship_type: 'gateway-client',
            network_id:        networkId,
            confidence:        0.9,
            evidence:          `device on ${cidr} via gateway`,
          });
        } catch (_) {}
      }
    }
  }

  // Update scan record
  await api.patch(`/api/scans/${scanId}`, {
    finished_at:   new Date().toISOString(),
    devices_found: payloads.length,
  }).catch(() => {});

  return { scanId, count: payloads.length };
}

async function reportScan(observations, networks = [], interfaces = []) {
  const { data: scan } = await api.post('/api/scans', {
    agent_id:  AGENT_ID,
    scan_type: 'agent',
  });

  await reportInterfaces(interfaces, await reportNetworks(networks));
  return buildAndPostObservations(observations, networks, scan.scan_id);
}

async function reportExistingScan(observations, scanId, networks = [], interfaces = []) {
  await reportInterfaces(interfaces, await reportNetworks(networks));
  return buildAndPostObservations(observations, networks, scanId);
}

module.exports = { reportScan, reportExistingScan, api };
