import { useState, useEffect } from 'react'
import { diagnosticsApi } from '../api/client'

const SEVERITY_LABELS = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
}

export default function Diagnostics() {
  const [diagnostics, setDiagnostics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    try {
      const data = await diagnosticsApi.list()
      setDiagnostics(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const counts = { info: 0, warning: 0, critical: 0 }
  diagnostics.forEach(d => { if (counts[d.severity] !== undefined) counts[d.severity]++ })

  if (loading) return <div className="loading">Generating diagnostics…</div>

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Diagnostics</h1>
          <p>Rule-based analysis of network health</p>
        </div>
        <button className="btn btn-ghost" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="cards-row" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="card-label">Critical</div>
          <div className={`card-value ${counts.critical > 0 ? 'red' : ''}`}>{counts.critical}</div>
        </div>
        <div className="card">
          <div className="card-label">Warnings</div>
          <div className={`card-value ${counts.warning > 0 ? 'yellow' : ''}`}>{counts.warning}</div>
        </div>
        <div className="card">
          <div className="card-label">Info</div>
          <div className="card-value">{counts.info}</div>
        </div>
        <div className="card">
          <div className="card-label">Total</div>
          <div className="card-value">{diagnostics.length}</div>
        </div>
      </div>

      {diagnostics.length === 0 ? (
        <div className="empty-state">
          <p>No diagnostics generated. This usually means no devices have been discovered yet.</p>
        </div>
      ) : (
        <>
          {['critical', 'warning', 'info'].map(severity =>
            diagnostics
              .filter(d => d.severity === severity)
              .map((d, i) => (
                <div key={`${severity}-${i}`} className={`diag-card ${severity}`}>
                  <div className="diag-header">
                    <span className={`badge badge-${severity}`}>{SEVERITY_LABELS[severity]}</span>
                    <span className="diag-title">{d.plain_language}</span>
                  </div>
                  <div className="diag-row">
                    <div>
                      <div className="diag-section-label">Technical Detail</div>
                      <div className="diag-section-text mono">{d.technical_detail}</div>
                    </div>
                    <div>
                      <div className="diag-section-label">Recommended Action</div>
                      <div className="diag-section-text">{d.recommended_action}</div>
                    </div>
                  </div>
                </div>
              ))
          )}
        </>
      )}
    </>
  )
}
