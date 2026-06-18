import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { devicesApi, scansApi } from '../api/client'

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

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 60 * 60 * 1000
}

export default function Dashboard() {
  const [devices, setDevices] = useState([])
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([devicesApi.list(), scansApi.list()])
      .then(([d, s]) => { setDevices(d); setScans(s) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading…</div>

  const online = devices.filter(d => isOnline(d.last_seen)).length
  const offline = devices.length - online
  const recentScans = scans.slice(0, 5)

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Dashboard</h1>
          <p>Network overview at a glance</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="cards-row">
        <div className="card">
          <div className="card-label">Total Devices</div>
          <div className="card-value">{devices.length}</div>
        </div>
        <div className="card">
          <div className="card-label">Online</div>
          <div className={`card-value ${online > 0 ? 'green' : ''}`}>{online}</div>
        </div>
        <div className="card">
          <div className="card-label">Offline</div>
          <div className={`card-value ${offline > 0 ? 'red' : ''}`}>{offline}</div>
        </div>
        <div className="card">
          <div className="card-label">Total Scans</div>
          <div className="card-value">{scans.length}</div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>Recent Scans</h2>
          <Link to="/scans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>View all →</Link>
        </div>
        <div className="table-wrap">
          {recentScans.length === 0 ? (
            <div className="empty-state">
              <p>No scans yet. Start the discovery agent or trigger a scan.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Type</th>
                  <th>Devices Found</th>
                  <th>Duration</th>
                  <th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map(s => (
                  <tr key={s.scan_id}>
                    <td>{timeAgo(s.started_at)}</td>
                    <td><span className="badge badge-info">{s.scan_type}</span></td>
                    <td>{s.devices_found}</td>
                    <td>{s.duration_seconds != null ? `${s.duration_seconds}s` : '—'}</td>
                    <td className="text-muted">{s.agent_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>Devices</h2>
          <Link to="/devices" style={{ fontSize: 12, color: 'var(--text-muted)' }}>View all →</Link>
        </div>
        <div className="table-wrap">
          {devices.length === 0 ? (
            <div className="empty-state">
              <p>No devices discovered yet.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>MAC</th>
                  <th>IP</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {devices.slice(0, 8).map(d => {
                  const online = isOnline(d.last_seen)
                  return (
                    <tr key={d.device_id}>
                      <td>{d.user_name || d.hostname || <span className="text-muted">Unknown</span>}</td>
                      <td className="mono">{d.primary_mac}</td>
                      <td className="mono">{d.current_ip || '—'}</td>
                      <td>
                        <span className={`badge ${online ? 'badge-online' : 'badge-offline'}`}>
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="text-muted">{timeAgo(d.last_seen)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
