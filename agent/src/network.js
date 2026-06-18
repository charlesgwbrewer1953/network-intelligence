const { execSync } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

// ── OUI prefix → { manufacturer, device_type } ──────────────────────────────
const OUI_TABLE = {
  // Apple
  'f8:4d:89': { manufacturer: 'Apple', device_type: 'computer' },
  'a4:c3:f0': { manufacturer: 'Apple', device_type: 'computer' },
  '90:8d:6c': { manufacturer: 'Apple', device_type: 'computer' },
  '3c:22:fb': { manufacturer: 'Apple', device_type: 'phone' },
  'b8:e8:56': { manufacturer: 'Apple', device_type: 'phone' },
  'dc:a4:ca': { manufacturer: 'Apple', device_type: 'computer' },
  // Ubiquiti / UniFi
  '24:a4:3c': { manufacturer: 'Ubiquiti', device_type: 'access_point' },
  '78:45:58': { manufacturer: 'Ubiquiti', device_type: 'access_point' },
  'f4:92:bf': { manufacturer: 'Ubiquiti', device_type: 'router' },
  'fc:ec:da': { manufacturer: 'Ubiquiti', device_type: 'access_point' },
  // Eero
  'f8:bb:bf': { manufacturer: 'Eero', device_type: 'mesh_node' },
  'a0:10:81': { manufacturer: 'Eero', device_type: 'mesh_node' },
  // TP-Link
  'a4:2b:b0': { manufacturer: 'TP-Link', device_type: 'router' },
  '50:d4:f7': { manufacturer: 'TP-Link', device_type: 'router' },
  'c4:e9:84': { manufacturer: 'TP-Link', device_type: 'router' },
  // Netgear
  'c4:3d:c7': { manufacturer: 'Netgear', device_type: 'router' },
  '20:4e:7f': { manufacturer: 'Netgear', device_type: 'router' },
  // Cisco
  '00:1a:a1': { manufacturer: 'Cisco', device_type: 'router' },
  '00:0c:85': { manufacturer: 'Cisco', device_type: 'switch' },
  // Samsung
  '78:9e:d0': { manufacturer: 'Samsung', device_type: 'phone' },
  'a0:07:98': { manufacturer: 'Samsung', device_type: 'phone' },
  // Google (Nest / Chromecast)
  '54:60:09': { manufacturer: 'Google', device_type: 'iot' },
  'a4:77:33': { manufacturer: 'Google', device_type: 'iot' },
  // Amazon (Echo / Fire)
  'fc:65:de': { manufacturer: 'Amazon', device_type: 'iot' },
  '68:37:e9': { manufacturer: 'Amazon', device_type: 'iot' },
  // Raspberry Pi
  'b8:27:eb': { manufacturer: 'Raspberry Pi', device_type: 'computer' },
  'dc:a6:32': { manufacturer: 'Raspberry Pi', device_type: 'computer' },
  // HP printers
  '9c:b6:d0': { manufacturer: 'HP', device_type: 'printer' },
  'a0:d3:c1': { manufacturer: 'HP', device_type: 'printer' },
  // Sonos
  '00:0e:58': { manufacturer: 'Sonos', device_type: 'iot' },
  'b8:e9:37': { manufacturer: 'Sonos', device_type: 'iot' },
  // Virgin Media / Liberty Global
  'a0:2d:db': { manufacturer: 'Virgin Media', device_type: 'router' },
  '7c:4c:a5': { manufacturer: 'Virgin Media', device_type: 'router' },
};

function ouiLookup(mac) {
  const prefix = mac.substring(0, 8).toLowerCase();
  return OUI_TABLE[prefix] || null;
}

// ── Hostname → device_type hints ─────────────────────────────────────────────
const HOSTNAME_PATTERNS = [
  [/router|gateway|hub|modem|draytek|fritzbox/i, 'router'],
  [/mesh|eero|orbi|velop|deco|plume/i,           'mesh_node'],
  [/iphone|android|pixel|galaxy|oneplus/i,        'phone'],
  [/ipad/i,                                        'tablet'],
  [/macbook|laptop|notebook/i,                    'laptop'],
  [/imac|desktop|pc\b/i,                          'desktop'],
  [/apple-?tv|appletv|chromecast|firetv/i,        'tv'],
  [/printer|hp-|canon-|epson-|brother-|ricoh/i,   'printer'],
  [/nas|synology|qnap|drobo|readynas/i,           'nas'],
  [/switch\b/i,                                   'switch'],
  [/camera|cam\b|hikvision|dahua/i,               'camera'],
  [/echo|alexa|homepod|sonos/i,                   'iot'],
];

function classifyByHostname(hostname) {
  if (!hostname) return null;
  for (const [pattern, type] of HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) return type;
  }
  return null;
}

// ── Interface type classification ─────────────────────────────────────────────
function getHardwarePortMap() {
  const map = {};
  try {
    const output = execSync('networksetup -listallhardwareports 2>/dev/null', { encoding: 'utf8' });
    for (const entry of output.split('\n\n')) {
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
    if (p.includes('thunderbolt bridge') || p.includes('bridge')) return 'bridge';
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

// ── Network math ──────────────────────────────────────────────────────────────
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

function networkAddress(ip, cidrBits) {
  const p = ip.split('.').map(Number);
  const ipInt = (p[0] << 24 | p[1] << 16 | p[2] << 8 | p[3]) >>> 0;
  const mask  = cidrBits === 0 ? 0 : (~((1 << (32 - cidrBits)) - 1)) >>> 0;
  const net   = (ipInt & mask) >>> 0;
  return [(net >> 24) & 0xff, (net >> 16) & 0xff, (net >> 8) & 0xff, net & 0xff].join('.');
}

// ── Gateway detection ─────────────────────────────────────────────────────────
function getDefaultGateway(ifaceName) {
  try {
    const output = execSync('netstat -rn -f inet 2>/dev/null', { encoding: 'utf8' });
    for (const line of output.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'default') {
        // Netif is the last column before Expire (if present)
        const iface = parts[parts.length - 1].replace(/\d+$/, ''); // strip 'en0' suffix if numbered
        if (!ifaceName || parts[3] === ifaceName || parts[parts.length - 1] === ifaceName) {
          return parts[1];
        }
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

// ── Phase A+B: Interface + subnet discovery ───────────────────────────────────
function discoverInterfaces() {
  const portMap = getHardwarePortMap();
  const output  = execSync('ifconfig 2>/dev/null', { encoding: 'utf8' });

  const SKIP = ['lo', 'awdl', 'llw', 'gif', 'stf', 'XHC', 'p2p', 'utun', 'ipsec'];
  const SKIP_TYPES = ['bluetooth', 'usb_tethering', 'vpn', 'bridge', 'virtual'];

  // Split into per-interface blocks (each starts with non-whitespace)
  const blocks = [];
  let current = null;
  for (const line of output.split('\n')) {
    if (/^\S/.test(line)) { if (current) blocks.push(current); current = [line]; }
    else if (current) current.push(line);
  }
  if (current) blocks.push(current);

  const interfaces = [];
  for (const blockLines of blocks) {
    const block = blockLines.join('\n');
    const nameM = block.match(/^(\S+):/);
    if (!nameM) continue;
    const name = nameM[1];

    if (SKIP.some(p => name.startsWith(p))) continue;

    // Must be UP and RUNNING
    const flagsM = block.match(/flags=\w+<([^>]*)>/);
    if (!flagsM || !flagsM[1].includes('UP') || !flagsM[1].includes('RUNNING')) continue;

    const macM  = block.match(/ether ([0-9a-f:]{17})/i);
    const inetM = block.match(/inet (\d+\.\d+\.\d+\.\d+) netmask (0x[0-9a-f]+)/i);
    if (!inetM) continue;

    const ip = inetM[1];
    if (ip.startsWith('169.254.')) continue; // link-local

    const cidrBits  = hexMaskToCidr(inetM[2]);
    const subnetMask = hexMaskToDotted(inetM[2]);
    const netAddr   = networkAddress(ip, cidrBits);
    const cidr      = `${netAddr}/${cidrBits}`;
    const portName  = portMap[name] || null;
    const type      = classifyInterface(name, portName);

    if (SKIP_TYPES.includes(type)) continue;

    const gateway = getDefaultGateway(name);

    interfaces.push({
      name,
      displayName:  portName || name,
      type,
      ip,
      subnetMask,
      cidrBits,
      cidr,
      networkAddress: netAddr,
      mac: macM ? macM[1].toLowerCase() : null,
      gateway,
    });
  }
  return interfaces;
}

// ── Phase C: Ping sweep to populate ARP cache ─────────────────────────────────
async function pingSweep(netAddr, cidrBits) {
  const hostBits = 32 - cidrBits;
  if (hostBits > 9) { // >512 hosts — too large
    console.log(`    /${cidrBits} subnet too large to sweep, skipping`);
    return;
  }
  const hostCount = (1 << hostBits) - 2;
  const parts = netAddr.split('.').map(Number);
  const netInt = (parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) >>> 0;

  const pings = [];
  for (let i = 1; i <= hostCount; i++) {
    const h = (netInt + i) >>> 0;
    const ip = [(h >> 24) & 0xff, (h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff].join('.');
    pings.push(execAsync(`ping -c 1 -t 1 -q ${ip} 2>/dev/null`).catch(() => {}));
  }
  await Promise.all(pings);
}

// ── Phase D: Device classification ───────────────────────────────────────────
function classifyDevice(obs, gatewayIp) {
  let device_type = null;
  let manufacturer = null;
  let confidence = 0;

  // Gateway detection — highest confidence
  if (gatewayIp && obs.ip_address === gatewayIp) {
    device_type  = 'router';
    confidence   = 0.95;
  }

  // OUI lookup
  const oui = ouiLookup(obs.observed_mac);
  if (oui) {
    manufacturer = oui.manufacturer;
    if (!device_type) { device_type = oui.device_type; confidence = 0.7; }
  }

  // Hostname patterns
  const hostnameType = classifyByHostname(obs.hostname);
  if (hostnameType) {
    if (!device_type || confidence < 0.8) { device_type = hostnameType; confidence = 0.8; }
  }

  return { device_type, manufacturer, confidence };
}

module.exports = { discoverInterfaces, pingSweep, classifyDevice, getArpMacForIp };
