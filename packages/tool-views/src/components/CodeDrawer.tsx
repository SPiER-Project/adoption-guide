/**
 * CodeDrawer — where the generated FHIR lives, in both chromes.
 *
 * ── The measured problem ──────────────────────────────────────────────────
 *
 * `.form-wrapper` is `flex-direction: row` with `flex-wrap`, and below 1024px
 * `.debug-sidebar` becomes `flex: 1 1 100%; position: static`. So in a panel it
 * does not sit beside the form — it **wraps below it**. The step-0 spike measured
 * its top at 5604px on an expanded C-SSRS Full; on this branch, 2968px.
 *
 * That is not "cramped", it is **unreachable**: the FHIR view is the thing the
 * demo exists to show, and mid-demo nobody scrolls three thousand pixels to find
 * it. Panel plan §9.1 finding 3, and §2's argument for a bottom drawer —
 * reachability, not overflow.
 *
 * ── What this does ────────────────────────────────────────────────────────
 *
 * EHR chrome: renders **exactly** the `<aside className="debug-sidebar">` it
 * replaced, so the desktop layout is byte-for-byte unchanged. The sidebar works
 * fine when there is room beside the form; nothing about it needed fixing there.
 *
 * Panel chrome: a bottom-anchored drawer, collapsed to a bar until asked for.
 * Always one tap away regardless of scroll position, which is the whole point.
 *
 * ── On §2's "three tabs" ──────────────────────────────────────────────────
 *
 * §2 specifies a tab bar (Definition | Live response | Written). This delivers
 * those as the `FhirJsonViewer` accordions the views already pass as children,
 * rather than a tab bar, for a reason worth stating: **10 of the 12 views that
 * use this have exactly one section**, so a tab bar would render a single tab
 * almost everywhere. The accordion is already the sectioning affordance, and
 * `FhirJsonViewer` already carries the title a tab would show. If a view ever
 * needs genuine tabs, this is the component to grow them in.
 *
 * ── Who sees it at all (2026-09-17) ────────────────────────────────────────
 *
 * ⚠️ **Nobody, outside the Adoption Guide.** The reasoning above is about where
 * the drawer sits when it renders; this is about whether it renders. Inspection
 * is on inside `/guide` and off everywhere else — see
 * `context/InspectContext.ts`. A clinician launching an instrument from a chart,
 * from a CDS card, or by browsing `/patient/record` gets the form and nothing
 * else; the guide's tool pages (`/guide/tools/TL-0NN`) render the same views
 * with the drawer.
 *
 * The gate is HERE as well as on `FhirJsonViewer` because this component draws
 * chrome of its own — an `<aside>` in EHR chrome, a bottom bar in panel chrome.
 * Letting the children return null would leave an empty drawer bar that opens
 * onto nothing, which reads worse than either outcome.
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { usePresentation } from '../context/PresentationContext'
import { useInspect } from '../context/InspectContext'
import '../css/CodeDrawer.css'
import { cx } from '@spier/ui/cx'

export function CodeDrawer({
  children,
  /** Bar label in panel chrome. Names what is inside without opening it. */
  label = 'FHIR',
}: {
  children: ReactNode
  label?: string
}) {
  const { chromeMode } = usePresentation()
  const inspect = useInspect()
  const [open, setOpen] = useState(false)

  // The whole drawer, chrome included — see the note at the top of this file.
  if (!inspect) return null

  // Unchanged from what the 12 views rendered inline before this component
  // existed. Deliberately not "improved" — a regression here is a regression in
  // the chrome that already worked.
  if (chromeMode !== 'panel') {
    return <aside className="debug-sidebar">{children}</aside>
  }

  return (
    <aside className={cx('code-drawer', open && 'code-drawer--open')}>
      <button
        className="code-drawer__handle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="code-drawer-body"
      >
        <span className="code-drawer__handle-icon" aria-hidden="true">
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
        <span className="code-drawer__handle-label">{label}</span>
        <span className="code-drawer__handle-hint">
          {open ? 'Hide' : 'Show generated FHIR'}
        </span>
      </button>
      {/* Kept mounted when closed would preserve accordion state, but it also
          keeps a large <pre> in the layout. Unmounted instead: the drawer is a
          demo affordance, and a panel scrolling a long instrument should not pay
          for JSON nobody is looking at. */}
      {open && (
        <div className="code-drawer__body" id="code-drawer-body">
          {children}
        </div>
      )}
    </aside>
  )
}
