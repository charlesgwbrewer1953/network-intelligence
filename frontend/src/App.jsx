import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Devices from './pages/Devices'
import Scans from './pages/Scans'
import Diagnostics from './pages/Diagnostics'
import Topology from './pages/Topology'
import Networks from './pages/Networks'
import './App.css'

function NavItem({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <div className="dk-brand">demographiKon</div>
            <div className="brand-sub">Network Intelligence</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <NavItem to="/" label="Dashboard" icon="◈" />
          <NavItem to="/devices" label="Devices" icon="⊡" />
          <NavItem to="/scans" label="Scans" icon="◎" />
          <NavItem to="/diagnostics" label="Diagnostics" icon="◇" />
          <NavItem to="/networks" label="Networks" icon="◉" />
          <NavItem to="/topology" label="Topology" icon="⬡" />
        </nav>
        <div className="sidebar-footer">v{__APP_VERSION__}</div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/scans" element={<Scans />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/networks" element={<Networks />} />
          <Route path="/topology" element={<Topology />} />
        </Routes>
      </main>
    </div>
  )
}
