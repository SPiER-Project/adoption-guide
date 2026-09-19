import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { cx } from '@spier/ui/cx'
import '@spier/app-shell/css/Sidebar.css'

/**
 * The clinician's navigation: the two SMART apps and the app's own settings.
 *
 * ⚠️ **This was the `{!IS_DEMO && …}` branch of one Sidebar**, and splitting it
 * out is what let the surface flag retire. The two navigations were never
 * variants of each other — the guide's is a reading order through published
 * material, with an outbound "Try it" zone and a link to the spec; this one is
 * four destinations inside a chart a clinician was launched into. Holding both
 * in one component meant `data/guideSections.ts` and `data/surfaces.ts` read as
 * shared code when they are guide material, which is the measurement that
 * decided the split (`packages/app-shell/README.md`).
 *
 * ⚠️ No `usePatient()`, inherited from the component this came from and worth
 * keeping: a sidebar that reads no patient context cannot be the thing that
 * leaks one.
 *
 * ⚠️ **The IG is deliberately absent.** `services/clinical` does not serve
 * `/ig/` at all, so a link to it fell through to the SPA fallback and reopened
 * SPiER in a new tab titled "The SPiER Project". The IG is ~4,000 files of
 * implementer documentation and this surface has no implementer on it — see
 * `services/clinical/README.md`.
 */
const LINKS = [
  { to: '/patient/record', label: 'Patient record' },
  { to: '/population/caseload', label: 'Caseload' },
  { to: '/population/measures', label: 'Measures' },
  { to: '/settings', label: 'Settings' },
]

type SidebarProps = {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  // Dismiss the mobile overlay on Escape, mirroring the click-away behaviour.
  // The listener is only attached while the sidebar is open.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={cx('sidebar', isOpen && 'sidebar--open')}>
        <nav className="sidebar-nav" aria-label="SPiER">
          {LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx('sidebar-link', 'sidebar-link--lens', isActive && 'active')
              }
              onClick={onClose}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
