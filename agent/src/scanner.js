const { execSync } = require('child_process');
const { discoverInterfaces, pingSweep, classifyDevice, getArpMacForIp } = require('./network');

// ── MAC validity filter ───────────────────────────────────────────────────────
function isPhysicalDevice(mac) {
  if (!mac || mac.length !== 17) return false;
  if (mac === 'ff:ff:ff:ff:ff:ff') return false;
  if (mac === '00:00:00:00:00:00') return false;
  if (mac.startsWith('01:00:5e:')) return false; // IPv4 multicast
  if (mac.startsWith('33:33:'))    return false; // IPv6 multicast
  return true;
}

function parseArpOutput(output) {
  const raw = [];
  for (const line of output.split('\n')) {
    const match = line.match(/^(\S+)\s+\(([^)]+)\)\s+at\s+([0-9a-f]{2}(?::[0-9a-f]{2}){5})\s+/i);
    if (!match) continue;
    const [, hostname, ip, mac] = match;
    raw.push({
      observed_mac: mac.toLowerCase(),
      ip_address:   ip,
      hostname:     hostname === '?' ? null : hostname.replace(/\.$/, ''),
    });
  }
  const valid = raw.filter(obs => isPhysicalDevice(obs.observed_mac));
  return { raw, valid };
}

// ── Stub mode ─────────────────────────────────────────────────────────────────
function stubResult() {
  const observations = [
    { observed_mac: 'aa:bb:cc:dd:ee:01', ip_address: '192.168.1.1',   hostname: 'router.local' },
    { observed_mac: 'aa:bb:cc:dd:ee:02', ip_address: '192.168.1.100', hostname: 'macbook.local' },
    { observed_mac: 'aa:bb:cc:dd:ee:03', ip_address: '192.168.1.101', hostname: 'iphone.local' },
    { observed_mac: 'aa:bb:cc:dd:ee:04', ip_address: '192.168.1.102', hostname: 'printer.local' },
  ];
  return {
    observations,
    networks: [],
    interfaces: [],
    stats: { raw_arp_entries: 4, valid_device_entries: 4, filtered_entries: 0 },
  };
}

// ── Real scan ─────────────────────────────────────────────────────────────────
async function realScan() {
  // Phase A+B: discover interfaces and subnets
  const ifaces = discoverInterfaces();
  console.log(`  Interfaces: ${ifaces.map(i => `${i.name}(${i.type})`).join(', ')}`);

  // Phase C: ping sweep each subnet to populate ARP cache
  for (const iface of ifaces) {
    console.log(`  Sweeping ${iface.cidr} via ${iface.name}…`);
    await pingSweep(iface.networkAddress, iface.cidrBits);
  }

  // Collect full ARP table after sweep
  const arpOutput = execSync('arp -a 2>/dev/null', { encoding: 'utf8' });
  const { raw, valid } = parseArpOutput(arpOutput);

  const stats = {
    raw_arp_entries:     raw.length,
    valid_device_entries: valid.length,
    filtered_entries:    raw.length - valid.length,
  };

  // Phase D: classify devices
  const gatewayIps = new Set(ifaces.map(i => i.gateway).filter(Boolean));
  const { classifyDevice: classify } = require('./network');

  const observations = valid.map(obs => {
    const gatewayIp = [...gatewayIps][0]; // primary gateway
    const { device_type, manufacturer } = classify(obs, gatewayIp);
    return { ...obs, device_type, manufacturer };
  });

  // Build network records per interface
  const networks = ifaces.map(iface => {
    const gatewayMac = iface.gateway ? getArpMacForIp(iface.gateway) : null;
    return {
      cidr:         iface.cidr,
      name:         iface.displayName,
      network_type: iface.type,
      gateway_ip:   iface.gateway || null,
      gateway_mac:  gatewayMac,
    };
  });

  const interfaces = ifaces.map(iface => ({
    name:           iface.name,
    display_name:   iface.displayName,
    interface_type: iface.type,
    ip_address:     iface.ip,
    subnet_mask:    iface.subnetMask,
    cidr:           iface.cidr,
    mac_address:    iface.mac,
    gateway_ip:     iface.gateway || null,
  }));

  return { observations, networks, interfaces, stats };
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function runScan() {
  const mode = process.env.SCANNER || 'stub';
  if (mode === 'real') {
    const result = await realScan();
    return result.observations.length > 0 ? result : stubResult();
  }
  return stubResult();
}

module.exports = { runScan };
