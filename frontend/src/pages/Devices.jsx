import { useState, useEffect } from 'react'
import { devicesApi } from '../api/client'

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

function EditModal({ device, onClose, onSave }) {
  const [form, setForm] = useState({
    user_name: device.user_name || '',
    device_type: device.device_type || '',
    location: device.location || '',
    notes: device.notes || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(device.device_id, form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Edit Device</h2>
        <div className="form-group">
          <label>Name</label>
          <input value={form.user_name} onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))} placeholder="My Laptop" />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={form.device_type} onChange={e => setForm(f => ({ ...f, device_type: e.target.value }))}>
            <option value="">Unknown</option>
            <option value="laptop">Laptop</option>
            <option value="desktop">Desktop</option>
            <option value="phone">Phone</option>
            <option value="tablet">Tablet</option>
            <option value="printer">Printer</option>
            <option value="router">Router</option>
            <option value="switch">Switch</option>
            <option value="server">Server</option>
            <option value="iot">IoT Device</option>
            <option value="tv">Smart TV</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label>Location</label>
          <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Living room" />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    devicesApi.list()
      .then(setDevices)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(id, data) {
    const updated = await devicesApi.update(id, data)
    setDevices(prev => prev.map(d => d.device_id === id ? { ...d, ...updated } : d))
  }

  async function handleDelete(id) {
    if (!confirm('Delete this device? This cannot be undone.')) return
    await devicesApi.delete(id)
    setDevices(prev => prev.filter(d => d.device_id !== id))
  }

  const filtered = devices.filter(d => {
    const q = search.toLowerCase()
    return !q ||
      (d.user_name || '').toLowerCase().includes(q) ||
      (d.hostname || '').toLowerCase().includes(q) ||
      (d.primary_mac || '').toLowerCase().includes(q) ||
      (d.manufacturer || '').toLowerCase().includes(q) ||
      (d.location || '').toLowerCase().includes(q)
  })

  if (loading) return <div className="loading">Loading…</div>

  return (
    <>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Devices</h1>
          <p>{devices.length} device{devices.length !== 1 ? 's' : ''} in registry</p>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="section">
        <div className="section-header">
          <h2>Device Registry</h2>
          <input
            style={{ width: 220 }}
            placeholder="Search devices…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>{search ? 'No devices match your search.' : 'No devices discovered yet.'}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name / Host</th>
                  <th>MAC</th>
                  <th>IP</th>
                  <th>Type</th>
                  <th>Manufacturer</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>First Seen</th>
                  <th>Last Seen</th>
                  <th>Obs.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const online = isOnline(d.last_seen)
                  return (
                    <tr key={d.device_id}>
                      <td>
                        <div>{d.user_name || <span className="text-muted">—</span>}</div>
                        {d.hostname && <div className="text-muted mono" style={{ fontSize: 11 }}>{d.hostname}</div>}
                      </td>
                      <td className="mono">{d.primary_mac}</td>
                      <td className="mono">{d.current_ip || '—'}</td>
                      <td>{d.device_type || <span className="text-muted">—</span>}</td>
                      <td>{d.manufacturer || <span className="text-muted">—</span>}</td>
                      <td>{d.location || <span className="text-muted">—</span>}</td>
                      <td>
                        <span className={`badge ${online ? 'badge-online' : 'badge-offline'}`}>
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="text-muted">{timeAgo(d.first_seen)}</td>
                      <td className="text-muted">{timeAgo(d.last_seen)}</td>
                      <td className="text-muted">{d.observation_count ?? '—'}</td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(d)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.device_id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <EditModal
          device={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </>
  )
}
