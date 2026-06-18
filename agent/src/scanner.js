const { execSync } = require('child_process');

/**
 * Stub scanner — returns placeholder discovered devices.
 * Replace individual functions with real arp/ping/dns-sd implementations.
 */

function scanWithArp() {
  // Stub: in production, parse `arp -a` output
  return [];
}

function scanWithPing(subnet) {
  // Stub: in production, ping sweep subnet range
  return [];
}

function scanWithDnsSd() {
  // Stub: in production, use dns-sd / avahi-browse to find mDNS devices
  return [];
}

function generatePlaceholderObservations() {
  // Placeholder observations so the agent has something to report in V1
  const samples = [
    { mac: 'aa:bb:cc:dd:ee:01', ip: '192.168.1.1',   hostname: 'router.local',   latency_ms: 1 },
    { mac: 'aa:bb:cc:dd:ee:02', ip: '192.168.1.100',  hostname: 'macbook.local',  latency_ms: 12 },
    { mac: 'aa:bb:cc:dd:ee:03', ip: '192.168.1.101',  hostname: 'iphone.local',   latency_ms: 8 },
    { mac: 'aa:bb:cc:dd:ee:04', ip: '192.168.1.102',  hostname: 'printer.local',  latency_ms: 45 },
  ];

  return samples.map(s => ({
    observed_mac: s.mac,
    ip_address: s.ip,
    hostname: s.hostname,
    latency_ms: s.latency_ms,
    packet_loss: 0,
    signal_strength: null,
    seen_at: new Date().toISOString(),
  }));
}

async function runScan() {
  const arpDevices = scanWithArp();
  const pingDevices = scanWithPing();
  const mdnsDevices = scanWithDnsSd();

  const combined = [...arpDevices, ...pingDevices, ...mdnsDevices];

  // Fall through to placeholder if real scan returned nothing
  if (combined.length === 0) {
    return generatePlaceholderObservations();
  }

  // Deduplicate by MAC
  const seen = new Set();
  return combined.filter(d => {
    if (seen.has(d.observed_mac)) return false;
    seen.add(d.observed_mac);
    return true;
  });
}

module.exports = { runScan };
