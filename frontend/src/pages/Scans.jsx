import { useState, useEffect } from 'react'
import { scansApi } from '../api/client'

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

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

function ScanDetail({ scanId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    scansApi.get(scanId).then(setData).finally(() => setLoading(false))
  }, [scanId])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 700 }}>
        <h2>Scan Detail</h2>
        {loading ? <div className="loading">Loading…</div> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 13 }}>
              <div><span className="text-muted">Started: </span>{formatDate(data.scan.started_at)}</div>
              <div><span className="text-muted">Finished: </span>{formatDate(data.scan.finished_at)}</div>
              <div><span className="text-muted">Type: </span><span className="badge badge-info">{data.scan.scan_type}</span></div>
              <div><span className="text-muted">Duration: </span>{data.scan.duration_seconds != null ? `${data.scan.duration_seconds}s` : '—'}</div>
              <div><span className="text-muted">Devices found: </span>{data.scan.devices_found}</div>
              <div><span className="text-muted">Agent: </span>{data.scan.agent_name || '—'}</div>
            </div>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Observations ({data.observations.length})</div>
            <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {data.observations.length === 0 ? (
                <div className="text-muted" style={{ padding: '16px 0', textAlign: 'center', fontSize: 13 }}>No observations recorded.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>MAC</th>
                      <th>IP</th>
                      <th>Hostname</th>
                      <th>Latency</th>
                      <th>Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.observations.map(o => (
                      <tr key={o.observation_id}>
                        <td className="mono">{o.observed_mac}</td>
                        <td className="mono">{o.ip_address || '—'}</td>
                        <td>{o.hostname || '—'}</td>
                        <td>{o.latency_ms != null ? `${o.latency_ms}ms` : '—'}</td>
                        <td>{o.user_name || o.device_type || <span className="text-muted">Unknown</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function Scans() {
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [triggering, setTriggering] = useState(false)
  const [selectedScan, setSelectedScan] = useState(null)

  useEffect(() => {
    scansApi.list()
      .then(setScans)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function triggerScan() {
    setTriggering(true)
    try {
      const scan = await scansApi.create({ scan_type: 'manual' })
      setScans(prev => [scan, ...prev])
    } catch (err) {
      setError(err.message)
    } finally {
      setTriggering(false)
    }
  }

  if (loading) return <div className="loading">Loading…</div>

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Scans</h1>
          <p>{scans.length} scan{scans.length !== 1 ? 's' : ''} in history</p>
        </div>
        <button className="btn btn-primary" onClick={triggerScan} disabled={triggering}>
          {triggering ? 'Starting…' : '+ New Scan'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="section">
        <div className="section-header">
          <h2>Scan History</h2>
        </div>
        <div className="table-wrap">
          {scans.length === 0 ? (
            <div className="empty-state">
              <p>No scans yet. Click "New Scan" to create one manually, or start the discovery agent.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Finished</th>
                  <th>Type</th>
                  <th>Devices Found</th>
                  <th>Duration</th>
                  <th>Agent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {scans.map(s => (
                  <tr key={s.scan_id}>
                    <td>{timeAgo(s.started_at)}</td>
                    <td className="text-muted">{s.finished_at ? formatDate(s.finished_at) : <span className="badge badge-warning">In Progress</span>}</td>
                    <td><span className="badge badge-info">{s.scan_type}</span></td>
                    <td>{s.devices_found}</td>
                    <td>{s.duration_seconds != null ? `${s.duration_seconds}s` : '—'}</td>
                    <td className="text-muted">{s.agent_name || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedScan(s.scan_id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedScan && <ScanDetail scanId={selectedScan} onClose={() => setSelectedScan(null)} />}
    </>
  )
}
