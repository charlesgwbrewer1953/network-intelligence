const { execSync } = require('child_process');

function parseArpOutput(output) {
  const observations = [];
  for (const line of output.split('\n')) {
    // macOS arp -a format:
    // ? (192.168.1.1) at a4:91:b1:xx:xx:xx on en0 ifscope [ethernet]
    // hostname.local (192.168.1.x) at mac on en0 ...
    // ? (ip) at (incomplete) on en0 ... -- skipped: no 17-char MAC match
    const match = line.match(/^(\S+)\s+\(([^)]+)\)\s+at\s+([0-9a-f]{2}(?::[0-9a-f]{2}){5})\s+/i);
    if (!match) continue;
    const [, hostname, ip, mac] = match;
    observations.push({
      observed_mac: mac.toLowerCase(),
      ip_address: ip,
      hostname: hostname === '?' ? null : hostname.replace(/\.$/, ''),
    });
  }
  return observations;
}

async function scanWithArp() {
  const output = execSync('arp -a 2>/dev/null', { encoding: 'utf8' });
  return parseArpOutput(output);
}

function stubObservations() {
  return [
    { observed_mac: 'aa:bb:cc:dd:ee:01', ip_address: '192.168.1.1',   hostname: 'router.local' },
    { observed_mac: 'aa:bb:cc:dd:ee:02', ip_address: '192.168.1.100', hostname: 'macbook.local' },
    { observed_mac: 'aa:bb:cc:dd:ee:03', ip_address: '192.168.1.101', hostname: 'iphone.local' },
    { observed_mac: 'aa:bb:cc:dd:ee:04', ip_address: '192.168.1.102', hostname: 'printer.local' },
  ];
}

async function runScan() {
  const mode = process.env.SCANNER || 'stub';
  if (mode === 'real') {
    const results = await scanWithArp();
    return results.length > 0 ? results : stubObservations();
  }
  return stubObservations();
}

module.exports = { runScan };
