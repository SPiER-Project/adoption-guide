import { NavLink, useLocation } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import '../css/Sidebar.css'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface LensChild {
  to: string
  label: string
}

interface Lens {
  to: string
  label: string
  icon: string
  matchPrefix: string
  children?: LensChild[]
}

const LENSES: Lens[] = [
  {
    to: '/',
    label: 'Home',
    icon: '⌂', // house
    matchPrefix: '__exact__', // never matches via prefix; uses `end` instead
  },
  {
    to: '/implementation-guide',
    label: 'Implementation Guide',
    icon: '\u{1F4DA}', // books
    matchPrefix: '/implementation-guide',
    children: [
      { to: '/implementation-guide/pathway', label: 'Pathway' },
      { to: '/implementation-guide/tool-configuration', label: 'Tool Configuration' },
      { to: '/implementation-guide/data-dictionary', label: 'Data Dictionary' },
      { to: '/implementation-guide/adoption-rubric', label: 'Adoption Rubric' },
      { to: '/implementation-guide/roadmap', label: 'Roadmap' },
    ],
  },
  {
    to: '/population',
    label: 'Population View',
    icon: '\u{1F465}', // busts in silhouette
    matchPrefix: '/population',
  },
  {
    to: '/patient/chart',
    label: 'Patient View',
    icon: '\u{1F464}', // bust
    matchPrefix: '/patient',
  },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { clearDemoData, loadDemoScenario } = usePatient()
  const location = useLocation()

  const isLensActive = (lens: Lens) => {
    if (lens.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(lens.matchPrefix)
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <nav className="sidebar-nav">
          {LENSES.map(lens => {
            const expanded = isLensActive(lens) && !!lens.children?.length
            return (
              <div key={lens.to} className="sidebar-section">
                <NavLink
                  to={lens.to}
                  className={({ isActive }) =>
                    `sidebar-link sidebar-link--lens ${
                      isActive || isLensActive(lens) ? 'active' : ''
                    }`
                  }
                  end={lens.to === '/'}
                  onClick={onClose}
                >
                  <span className="sidebar-icon">{lens.icon}</span>
                  {lens.label}
                </NavLink>
                {expanded && lens.children!.map(child => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={({ isActive }) =>
                      `sidebar-link sidebar-link--child ${isActive ? 'active' : ''}`
                    }
                    onClick={onClose}
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
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
