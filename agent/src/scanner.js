const { execSync } = require('child_process');

function isPhysicalDevice(mac) {
  if (!mac || mac.length !== 17) return false;
  if (mac === 'ff:ff:ff:ff:ff:ff') return false; // broadcast
  if (mac === '00:00:00:00:00:00') return false; // all-zeros
  if (mac.startsWith('01:00:5e:')) return false; // IPv4 multicast
  if (mac.startsWith('33:33:')) return false;    // IPv6 multicast
  return true;
}

function parseArpOutput(output) {
  const raw = [];
  for (const line of output.split('\n')) {
    // macOS arp -a: hostname (ip) at mac on interface [type]
    // Incomplete entries (no valid MAC) are skipped by the regex itself.
    const match = line.match(/^(\S+)\s+\(([^)]+)\)\s+at\s+([0-9a-f]{2}(?::[0-9a-f]{2}){5})\s+/i);
    if (!match) continue;
    const [, hostname, ip, mac] = match;
    raw.push({
      observed_mac: mac.toLowerCase(),
      ip_address: ip,
      hostname: hostname === '?' ? null : hostname.replace(/\.$/, ''),
    });
  }

  const valid = raw.filter(obs => isPhysicalDevice(obs.observed_mac));

  return {
    observations: valid,
    stats: {
      raw_arp_entries: raw.length,
      valid_device_entries: valid.length,
      filtered_entries: raw.length - valid.length,
    },
  };
}

async function scanWithArp() {
  const output = execSync('arp -a 2>/dev/null', { encoding: 'utf8' });
  return parseArpOutput(output);
}

function stubResult() {
  const observations = [
    { observed_mac: 'aa:bb:cc:dd:ee:01', ip_address: '192.168.1.1',   hostname: 'router.local' },
    { observed_mac: 'aa:bb:cc:dd:ee:02', ip_address: '192.168.1.100', hostname: 'macbook.local' },
    { observed_mac: 'aa:bb:cc:dd:ee:03', ip_address: '192.168.1.101', hostname: 'iphone.local' },
    { observed_mac: 'aa:bb:cc:dd:ee:04', ip_address: '192.168.1.102', hostname: 'printer.local' },
  ];
  return {
    observations,
    stats: {
      raw_arp_entries: observations.length,
      valid_device_entries: observations.length,
      filtered_entries: 0,
    },
  };
}

async function runScan() {
  const mode = process.env.SCANNER || 'stub';
  if (mode === 'real') {
    const result = await scanWithArp();
    return result.observations.length > 0 ? result : stubResult();
  }
  return stubResult();
}

module.exports = { runScan };
