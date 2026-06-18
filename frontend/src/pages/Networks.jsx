import { useState, useEffect } from 'react'
import { networksApi } from '../api/client'

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function typeLabel(t) {
  if (!t) return '—'
  return { wifi: 'Wi-Fi', ethernet: 'Ethernet', mesh_node: 'Mesh', vpn: 'VPN', bridge: 'Bridge' }[t] || t
}

export default function Networks() {
  const [networks, setNetworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    networksApi.list()
      .then(setNetworks)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading…</div>

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Networks</h1>
          <p>{networks.length} network{networks.length !== 1 ? 's' : ''} discovered</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="section">
        <div className="section-header">
          <h2>Discovered Networks</h2>
        </div>
        <div className="table-wrap">
          {networks.length === 0 ? (
            <div className="empty-state">
              <p>No networks discovered yet. Run a scan to populate this list.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>CIDR</th>
                  <th>Interface</th>
                  <th>Type</th>
                  <th>SSID</th>
                  <th>Gateway</th>
                  <th>Local IP</th>
                  <th>Devices</th>
                  <th>Last Scanned</th>
                </tr>
              </thead>
              <tbody>
                {networks.map(n => (
                  <tr key={n.network_id}>
                    <td className="mono">{n.cidr}</td>
                    <td>{n.interface_display_name || n.interface_name || <span className="text-muted">—</span>}</td>
                    <td>{typeLabel(n.interface_type || n.network_type)}</td>
                    <td>{n.ssid || <span className="text-muted">—</span>}</td>
                    <td className="mono">{n.gateway_ip || <span className="text-muted">—</span>}</td>
                    <td className="mono">{n.local_ip || <span className="text-muted">—</span>}</td>
                    <td>{n.device_count ?? '—'}</td>
                    <td className="text-muted">{timeAgo(n.last_scanned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
