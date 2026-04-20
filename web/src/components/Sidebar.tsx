import { NavLink } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import '../css/Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { clearDemoData, loadDemoScenario } = usePatient()

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Chart</h4>
            <NavLink to="/chart/dashboard" className="sidebar-link" onClick={onClose}>
              <span className="sidebar-icon">&#9634;</span>
              Dashboard
            </NavLink>
            <NavLink to="/chart/screenings" className="sidebar-link" onClick={onClose} end>
              <span className="sidebar-icon">&#9997;&#65039;</span>
              Clinical Tools
            </NavLink>
            <NavLink to="/chart/careplan" className="sidebar-link" onClick={onClose}>
              <span className="sidebar-icon">&#128203;</span>
              Care Plans
            </NavLink>
            <NavLink to="/chart/encounters" className="sidebar-link" onClick={onClose}>
              <span className="sidebar-icon">&#128197;</span>
              Encounters
            </NavLink>
          </div>

          <div className="sidebar-section">
            <h4 className="sidebar-section-title">Reference</h4>
            <NavLink to="/chart/implementation-guide" className="sidebar-link" onClick={onClose}>
              <span className="sidebar-icon">&#128218;</span>
              Implementation Guide
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-load-btn" onClick={() => { loadDemoScenario(); onClose() }}>
            Load Demo Scenario
          </button>
          <button className="sidebar-clear-btn" onClick={() => { clearDemoData(); onClose() }}>
            Clear Demo Data
          </button>
          <span className="sidebar-version">SPiER v0.1.0</span>
        </div>
      </aside>
    </>
  )
}
