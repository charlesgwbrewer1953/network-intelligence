const { execSync } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

// ── OUI prefix lookup ─────────────────────────────────────────────────────────
const OUI_TABLE = {
  'f8:4d:89': { manufacturer: 'Apple',         device_type: 'computer' },
  'a4:c3:f0': { manufacturer: 'Apple',         device_type: 'computer' },
  '90:8d:6c': { manufacturer: 'Apple',         device_type: 'computer' },
  'dc:a4:ca': { manufacturer: 'Apple',         device_type: 'computer' },
  '3c:22:fb': { manufacturer: 'Apple',         device_type: 'phone' },
  'b8:e8:56': { manufacturer: 'Apple',         device_type: 'phone' },
  '24:a4:3c': { manufacturer: 'Ubiquiti',      device_type: 'access_point' },
  '78:45:58': { manufacturer: 'Ubiquiti',      device_type: 'access_point' },
  'f4:92:bf': { manufacturer: 'Ubiquiti',      device_type: 'router' },
  'fc:ec:da': { manufacturer: 'Ubiquiti',      device_type: 'access_point' },
  'f8:bb:bf': { manufacturer: 'Eero',          device_type: 'mesh_node' },
  'a0:10:81': { manufacturer: 'Eero',          device_type: 'mesh_node' },
  'a4:2b:b0': { manufacturer: 'TP-Link',       device_type: 'router' },
  '50:d4:f7': { manufacturer: 'TP-Link',       device_type: 'router' },
  'c4:e9:84': { manufacturer: 'TP-Link',       device_type: 'router' },
  'c4:3d:c7': { manufacturer: 'Netgear',       device_type: 'router' },
  '78:9e:d0': { manufacturer: 'Samsung',       device_type: 'phone' },
  'a0:07:98': { manufacturer: 'Samsung',       device_type: 'phone' },
  '54:60:09': { manufacturer: 'Google',        device_type: 'iot' },
  'a4:77:33': { manufacturer: 'Google',        device_type: 'iot' },
  'fc:65:de': { manufacturer: 'Amazon',        device_type: 'iot' },
  '68:37:e9': { manufacturer: 'Amazon',        device_type: 'iot' },
  'b8:27:eb': { manufacturer: 'Raspberry Pi',  device_type: 'computer' },
  'dc:a6:32': { manufacturer: 'Raspberry Pi',  device_type: 'computer' },
  '9c:b6:d0': { manufacturer: 'HP',            device_type: 'printer' },
  'a0:d3:c1': { manufacturer: 'HP',            device_type: 'printer' },
  '00:0e:58': { manufacturer: 'Sonos',         device_type: 'iot' },
  'b8:e9:37': { manufacturer: 'Sonos',         device_type: 'iot' },
  'a0:2d:db': { manufacturer: 'Virgin Media',  device_type: 'router' },
  '7c:4c:a5': { manufacturer: 'Virgin Media',  device_type: 'router' },
};

const HOSTNAME_PATTERNS = [
  [/router|gateway|hub|modem|draytek|fritzbox/i, 'router'],
  [/mesh|eero|orbi|velop|deco|plume/i,           'mesh_node'],
  [/iphone|android|pixel|galaxy|oneplus/i,        'phone'],
  [/ipad/i,                                        'tablet'],
  [/macbook|laptop|notebook/i,                    'laptop'],
  [/imac|desktop/i,                               'desktop'],
  [/apple-?tv|appletv|chromecast|firetv/i,        'tv'],
  [/printer|hp-|canon-|epson-|brother-|ricoh/i,   'printer'],
  [/nas|synology|qnap|drobo|readynas/i,           'nas'],
  [/camera|cam\b|hikvision|dahua/i,               'camera'],
  [/echo|alexa|homepod|sonos/i,                   'iot'],
];

// ── Network math ──────────────────────────────────────────────────────────────
function ipToInt(ip) {
  const p = ip.split('.').map(Number);
  return (p[0] << 24 | p[1] << 16 | p[2] << 8 | p[3]) >>> 0;
}

function hexMaskToCidr(hex) {
  let mask = parseInt(hex, 16) >>> 0;
  let bits = 0;
  while (mask & 0x80000000) { bits++; mask = (mask << 1) >>> 0; }
  return bits;
}

function hexMaskToDotted(hex) {
  const m = parseInt(hex, 16) >>> 0;
  return [(m >> 24) & 0xff, (m >> 16) & 0xff, (m >> 8) & 0xff, m & 0xff].join('.');
}

function calcNetworkAddress(ip, cidrBits) {
  const mask = cidrBits === 0 ? 0 : (~((1 << (32 - cidrBits)) - 1)) >>> 0;
  const net  = (ipToInt(ip) & mask) >>> 0;
  return [(net >> 24) & 0xff, (net >> 16) & 0xff, (net >> 8) & 0xff, net & 0xff].join('.');
}

function ipInCidr(ip, netAddr, cidrBits) {
  const mask = cidrBits === 0 ? 0 : (~((1 << (32 - cidrBits)) - 1)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(netAddr) & mask);
}

function isRfc1918(ip) {
  const p = ip.split('.').map(Number);
  return p[0] === 10 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168);
}

// ── Gateway lookup ────────────────────────────────────────────────────────────
function getDefaultGateway(ifaceName) {
  try {
    const out = execSync('netstat -rn -f inet 2>/dev/null', { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      const p = line.trim().split(/\s+/);
      if (p[0] === 'default' && (!ifaceName || p[3] === ifaceName || p[p.length - 1] === ifaceName)) {
        return p[1];
      }
    }
  } catch (_) {}
  return null;
}

function getArpMacForIp(ip) {
  try {
    const out = execSync(`arp -n ${ip} 2>/dev/null`, { encoding: 'utf8' });
    const m = out.match(/([0-9a-f]{2}(?::[0-9a-f]{2}){5})/i);
    return m ? m[1].toLowerCase() : null;
  } catch (_) { return null; }
}

// ── SSID for Wi-Fi interfaces ─────────────────────────────────────────────────
function getSsid(ifaceName) {
  try {
    const out = execSync(
      `networksetup -getairportnetwork ${ifaceName} 2>/dev/null`,
      { encoding: 'utf8' }
    );
    const m = out.match(/Current Wi-Fi Network:\s*(.+)/);
    return m ? m[1].trim() : null;
  } catch (_) { return null; }
}

// ── Hardware port classification ──────────────────────────────────────────────
function getHardwarePortMap() {
  const map = {};
  try {
    const out = execSync('networksetup -listallhardwareports 2>/dev/null', { encoding: 'utf8' });
    for (const entry of out.split('\n\n')) {
      const port   = entry.match(/Hardware Port:\s*(.+)/);
      const device = entry.match(/Device:\s*(\S+)/);
      if (port && device) map[device[1].trim()] = port[1].trim();
    }
  } catch (_) {}
  return map;
}

function classifyInterface(name, portName) {
  if (portName) {
    const p = portName.toLowerCase();
    if (p.includes('wi-fi') || p.includes('airport')) return 'wifi';
    if (p.includes('thunderbolt bridge') || p === 'bridge') return 'bridge';
    if (p.includes('thunderbolt') || p.includes('ethernet')) return 'ethernet';
    if (p.includes('bluetooth')) return 'bluetooth';
    if (p.includes('iphone') || p.includes('ipad') || p.includes('usb')) return 'usb_tethering';
    if (p.includes('vpn')) return 'vpn';
  }
  if (name.startsWith('utun') || name.startsWith('ipsec')) return 'vpn';
  if (name.startsWith('bridge')) return 'bridge';
  if (name.startsWith('vmnet') || name.startsWith('vnet')) return 'virtual';
  return 'ethernet';
}

// ── Phase A+B: discover all local interfaces with IPv4 ───────────────────────
function discoverInterfaces() {
  const portMap = getHardwarePortMap();
  const output  = execSync('ifconfig 2>/dev/null', { encoding: 'utf8' });

  const SKIP_PREFIXES  = ['lo', 'awdl', 'llw', 'gif', 'stf', 'XHC', 'p2p', 'utun', 'ipsec'];
  const SKIP_TYPES     = ['bluetooth', 'usb_tethering', 'vpn', 'bridge', 'virtual'];

  // Split into per-interface blocks (each starts with non-whitespace)
  const blocks = [];
  let current = null;
  for (const line of output.split('\n')) {
    if (/^\S/.test(line)) { if (current) blocks.push(current); current = [line]; }
    else if (current) current.push(line);
  }
  if (current) blocks.push(current);

  const interfaces = [];
  const skipped = [];

  for (const blockLines of blocks) {
    const block = blockLines.join('\n');
    const nameM = block.match(/^(\S+):/);
    if (!nameM) continue;
    const name = nameM[1];

    if (SKIP_PREFIXES.some(p => name.startsWith(p))) {
      skipped.push({ name, reason: 'system/virtual interface' });
      continue;
    }

    const flagsM = block.match(/flags=\w+<([^>]*)>/);
    if (!flagsM || !flagsM[1].includes('UP') || !flagsM[1].includes('RUNNING')) {
      skipped.push({ name, reason: 'not active' });
      continue;
    }

    const macM  = block.match(/ether ([0-9a-f:]{17})/i);
    const inetM = block.match(/inet (\d+\.\d+\.\d+\.\d+) netmask (0x[0-9a-f]+)/i);
    if (!inetM) {
      skipped.push({ name, reason: 'no IPv4' });
      continue;
    }

    const ip = inetM[1];
    if (ip.startsWith('169.254.')) {
      skipped.push({ name, reason: 'link-local 169.254.x.x' });
      continue;
    }

    const portName  = portMap[name] || null;
    const type      = classifyInterface(name, portName);

    if (SKIP_TYPES.includes(type)) {
      skipped.push({ name, reason: `${type} — skipped` });
      continue;
    }

    const cidrBits   = hexMaskToCidr(inetM[2]);
    const subnetMask = hexMaskToDotted(inetM[2]);
    const netAddr    = calcNetworkAddress(ip, cidrBits);
    const cidr       = `${netAddr}/${cidrBits}`;
    const gateway    = getDefaultGateway(name);
    const ssid       = type === 'wifi' ? getSsid(name) : null;

    interfaces.push({
      name, displayName: portName || name, type,
      ip, subnetMask, cidrBits, cidr, networkAddress: netAddr,
      mac: macM ? macM[1].toLowerCase() : null,
      gateway, ssid,
    });
  }

  return { interfaces, skipped };
}

// ── Phase C: ping sweep then collect ARP entries for this CIDR ────────────────
async function sweepAndCollect(iface) {
  const { networkAddress: netAddr, cidrBits, cidr } = iface;

  if (!isRfc1918(iface.ip)) {
    return { skipped: true, reason: 'not RFC1918' };
  }
  if (cidrBits < 16) {
    return { skipped: true, reason: `/${cidrBits} too large to sweep` };
  }

  const hostBits  = 32 - cidrBits;
  const hostCount = (1 << hostBits) - 2;
  const netInt    = ipToInt(netAddr);

  const pings = [];
  for (let i = 1; i <= hostCount; i++) {
    const h  = (netInt + i) >>> 0;
    const ip = [(h >> 24) & 0xff, (h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff].join('.');
    pings.push(execAsync(`ping -c 1 -t 1 -q ${ip} 2>/dev/null`).catch(() => {}));
  }
  await Promise.all(pings);

  // Collect ARP and filter to this CIDR only
  const arpOut = execSync('arp -a 2>/dev/null', { encoding: 'utf8' });
  const entries = [];
  for (const line of arpOut.split('\n')) {
    const m = line.match(/^(\S+)\s+\(([^)]+)\)\s+at\s+([0-9a-f]{2}(?::[0-9a-f]{2}){5})\s+/i);
    if (!m) continue;
    const [, hostname, ip, mac] = m;
    if (!ipInCidr(ip, netAddr, cidrBits)) continue;
    entries.push({
      observed_mac: mac.toLowerCase(),
      ip_address:   ip,
      hostname:     hostname === '?' ? null : hostname.replace(/\.$/, ''),
    });
  }

  return { skipped: false, entries };
}

// ── Phase D: device classification ───────────────────────────────────────────
function classifyDevice(obs, gatewayIp) {
  let device_type  = null;
  let manufacturer = null;
  let confidence   = 0;

  if (gatewayIp && obs.ip_address === gatewayIp) {
    device_type = 'router'; confidence = 0.95;
  }

  const oui = OUI_TABLE[obs.observed_mac.substring(0, 8).toLowerCase()];
  if (oui) {
    manufacturer = oui.manufacturer;
    if (!device_type) { device_type = oui.device_type; confidence = 0.7; }
  }

  if (obs.hostname) {
    for (const [pat, type] of HOSTNAME_PATTERNS) {
      if (pat.test(obs.hostname) && confidence < 0.8) {
        device_type = type; confidence = 0.8; break;
      }
    }
  }

  return { device_type, manufacturer, confidence };
}

module.exports = { discoverInterfaces, sweepAndCollect, classifyDevice, getArpMacForIp, isRfc1918 };
