import { NavLink, Outlet } from 'react-router-dom'
import '../css/ImplementationGuide.css'

const TABS = [
  { to: 'overview', label: 'Overview' },
  { to: 'pathway', label: 'Pathway' },
  { to: 'tool-configuration', label: 'Tool Configuration' },
  { to: 'data-dictionary', label: 'Data Dictionary' },
  { to: 'adoption-readiness', label: 'Adoption Readiness' },
  { to: 'adoption-rubric', label: 'Adoption Rubric' },
  { to: 'roadmap', label: 'Roadmap' },
]

export function ImplementationGuide() {
  return (
    <div className="implementation-guide">
      <header className="ig-header">
        <h2 className="ig-title">Implementation Guide</h2>
        <nav className="ig-tabs">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `ig-tab-btn ${isActive ? 'ig-tab-btn--active' : ''}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="ig-content">
        <Outlet />
      </main>
    </div>
  )
}
