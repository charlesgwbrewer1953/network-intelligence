const { discoverInterfaces, sweepAndCollect, classifyDevice, getArpMacForIp } = require('./network');

// ── MAC validity filter ───────────────────────────────────────────────────────
function isPhysicalDevice(mac) {
  if (!mac || mac.length !== 17) return false;
  if (mac === 'ff:ff:ff:ff:ff:ff') return false;
  if (mac === '00:00:00:00:00:00') return false;
  if (mac.startsWith('01:00:5e:')) return false;
  if (mac.startsWith('33:33:'))    return false;
  return true;
}

// ── Stub mode ─────────────────────────────────────────────────────────────────
function stubResult() {
  const observations = [
    { observed_mac: 'aa:bb:cc:dd:ee:01', ip_address: '192.168.1.1',   hostname: 'router.local',  _networkCidr: '192.168.1.0/24', _interfaceName: 'en0' },
    { observed_mac: 'aa:bb:cc:dd:ee:02', ip_address: '192.168.1.100', hostname: 'macbook.local', _networkCidr: '192.168.1.0/24', _interfaceName: 'en0' },
    { observed_mac: 'aa:bb:cc:dd:ee:03', ip_address: '192.168.1.101', hostname: 'iphone.local',  _networkCidr: '192.168.1.0/24', _interfaceName: 'en0' },
    { observed_mac: 'aa:bb:cc:dd:ee:04', ip_address: '192.168.1.102', hostname: 'printer.local', _networkCidr: '192.168.1.0/24', _interfaceName: 'en0' },
  ];
  return {
    observations,
    networks:   [{ cidr: '192.168.1.0/24', name: 'Wi-Fi', network_type: 'wifi', gateway_ip: '192.168.1.1', gateway_mac: null }],
    interfaces: [{ name: 'en0', display_name: 'Wi-Fi', interface_type: 'wifi', ip_address: '192.168.1.50', subnet_mask: '255.255.255.0', cidr: '192.168.1.0/24', mac_address: 'aa:aa:aa:aa:aa:01', gateway_ip: '192.168.1.1', ssid: 'StubNet' }],
    stats: { interfaces_found: 1, interfaces_swept: 1, raw_arp_entries: 4, valid_device_entries: 4, filtered_entries: 0 },
  };
}

// ── Real scan: per-interface CIDR sweep ───────────────────────────────────────
async function realScan() {
  const { interfaces: ifaces, skipped } = discoverInterfaces();

  console.log(`  Interfaces found: ${ifaces.length}`);
  for (const iface of ifaces) {
    console.log(`    [active] ${iface.name} — ${iface.type} — ${iface.cidr}${iface.ssid ? ` (${iface.ssid})` : ''}`);
  }
  for (const s of skipped) {
    console.log(`    [skip]   ${s.name} — ${s.reason}`);
  }

  const networks  = [];
  const netIfaces = [];
  const allObs    = [];
  let rawTotal    = 0;
  let filteredTotal = 0;
  let swept       = 0;

  for (const iface of ifaces) {
    const gatewayMac = iface.gateway ? getArpMacForIp(iface.gateway) : null;

    networks.push({
      cidr:         iface.cidr,
      name:         iface.displayName,
      network_type: iface.type,
      gateway_ip:   iface.gateway || null,
      gateway_mac:  gatewayMac,
    });

    netIfaces.push({
      name:           iface.name,
      display_name:   iface.displayName,
      interface_type: iface.type,
      ip_address:     iface.ip,
      subnet_mask:    iface.subnetMask,
      cidr:           iface.cidr,
      mac_address:    iface.mac,
      gateway_ip:     iface.gateway || null,
      ssid:           iface.ssid || null,
    });

    console.log(`  Sweeping ${iface.cidr} via ${iface.name}…`);
    const result = await sweepAndCollect(iface);

    if (result.skipped) {
      console.log(`    Skipped: ${result.reason}`);
      continue;
    }

    swept++;
    const raw = result.entries;
    const valid = raw.filter(e => isPhysicalDevice(e.observed_mac));
    rawTotal += raw.length;
    filteredTotal += raw.length - valid.length;

    console.log(`    ARP entries: ${raw.length} raw, ${valid.length} valid, ${raw.length - valid.length} filtered`);

    for (const entry of valid) {
      const { device_type, manufacturer } = classifyDevice(entry, iface.gateway);
      allObs.push({
        ...entry,
        device_type,
        manufacturer,
        _networkCidr:   iface.cidr,
        _interfaceName: iface.name,
      });
    }
  }

  // Deduplicate by MAC — keep the entry with the most complete data
  const byMac = new Map();
  for (const obs of allObs) {
    const existing = byMac.get(obs.observed_mac);
    if (!existing || (obs.device_type && !existing.device_type)) {
      byMac.set(obs.observed_mac, obs);
    }
  }
  const observations = [...byMac.values()];

  console.log(`  Total unique devices: ${observations.length}`);

  return {
    observations,
    networks,
    interfaces: netIfaces,
    stats: {
      interfaces_found:    ifaces.length,
      interfaces_swept:    swept,
      raw_arp_entries:     rawTotal,
      valid_device_entries: observations.length,
      filtered_entries:    filteredTotal,
    },
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function runScan() {
  const mode = process.env.SCANNER || 'stub';
  if (mode === 'real') {
    return realScan();
  }
  return stubResult();
}

module.exports = { runScan };
