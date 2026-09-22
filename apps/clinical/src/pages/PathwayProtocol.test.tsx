/**
 * @vitest-environment jsdom
 *
 * The embedded view of the published pathway (Phase 4 of
 * docs/plans/suicide-safer-care-pathway.md).
 *
 * What is worth gating here is not "does it render" — the shared renderer is
 * already exercised by `CarePathway.test.tsx` — but the three properties that
 * make this a *different page* rather than a duplicate, each of which is a rule
 * from the plan that a later edit could quietly undo:
 *
 *  1. **The protocol is in words, and the provenance strip is not on this
 *     surface at all.** The demo claim inside an EHR is that the app carried a
 *     published artifact in with it — which is the INTEGRATION LEAD's question,
 *     and they read it on the guide. A clinician met a canonical URL in
 *     monospace before the protocol (clinical-app audit §1.9), so the strip is
 *     `useInspect()`-gated and this page never provides inspection.
 *  2. **No patient-contextual rendering.** The embedded surface has patient
 *     context available and this view deliberately does not use it. Asserted
 *     from the outside — the page renders with no patient provider at all, so a
 *     future `usePatient()` in this graph fails here rather than in a demo.
 *  3. **No simulator.** Beside a real chart, a synthetic screener that derives a
 *     risk tier is one glance from being read as a screening just performed.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PathwayProtocol } from './PathwayProtocol'

afterEach(cleanup)

/**
 * No PatientProvider, no SmartProvider, no ToolConfigProvider — deliberately.
 * A definition view needs none of them, and rendering it bare is what turns
 * "holds no patient data" from a comment into a failing test.
 */
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/patient/pathway']}>
      <PathwayProtocol />
    </MemoryRouter>,
  )
}

const CANONICAL = 'http://thespierproject.org/fhir/PlanDefinition/SPiERSuicideSaferCarePathway'

describe('PathwayProtocol — the pathway in the embedded panel', () => {
  it('renders the same protocol the guide does, from the artifact', () => {
    renderPage()
    expect(screen.getByText('Screen for suicide risk')).toBeDefined()
    expect(screen.getByText('Assess suicide risk after a positive screen')).toBeDefined()
    expect(screen.getByText(/Apply the obligations for the patient.s current risk tier/)).toBeDefined()
    // All three tiers in one table, no column selected: nothing here derives
    // a tier, so nothing may be highlighted as though something did.
    expect(screen.getByText('Low risk')).toBeDefined()
    expect(screen.getByText('Moderate risk')).toBeDefined()
    expect(screen.getByText('High risk')).toBeDefined()
    expect(document.querySelector('.pathway-matrix')).not.toBeNull()
    expect(document.querySelector('.pathway-matrix__cell--active')).toBeNull()
    expect(document.querySelector('.pathway-matrix__cell--dimmed')).toBeNull()
  })

  it('shows the protocol in words — no FHIRPath, no canonical URL, no drawer', () => {
    renderPage()
    // The gates and canonicals render only in the guide's PathwayCodeDrawer,
    // which returns null without inspection, and this page never provides it.
    // A clinician reads what the tier IS, not the expression that computes it.
    expect(document.querySelector('details')).toBeNull()
    expect(document.body.textContent).not.toMatch(/%episode|%phq9Item9Observation/)
    expect(document.querySelector('.pathway-spine')!.textContent).not.toContain(
      'http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs',
    )
    // ...and the canonical is nowhere on the page either: the provenance strip
    // is the implementer's, and it renders under inspection only.
    expect(screen.queryByText(CANONICAL)).toBeNull()
  })

  it('names no canonical URL, version or publication status without inspection', () => {
    // ⚠️ This asserted the OPPOSITE until 2026-09-21, and the change is the
    // decision rather than a relaxation — see the header. The strip still
    // exists and `/guide/pathway/protocol` still leads with it.
    renderPage()
    expect(document.querySelector('.pathway-provenance')).toBeNull()
    const text = document.body.textContent ?? ''
    expect(text).not.toContain('thespierproject.org')
    expect(text).not.toMatch(/experimental/)
    // The protocol itself is still the page.
    expect(document.querySelector('.pathway-spine')).not.toBeNull()
  })

  it('says it is the definition and points at the rail for the patient', () => {
    renderPage()
    expect(screen.getByText(/not where this patient/)).toBeDefined()
    const back = screen.getByRole('link', { name: /where this patient is/ })
    expect(back.getAttribute('href')).toBe('/patient/record')
  })

  it('offers a way back out — the only one the panel has', () => {
    renderPage()
    // PageHeader `up`: in panel chrome there is no sidebar, so this is the exit.
    // ⚠️ Matched on "Patient Chart" since 2026-09-09, and the rename is the
    // point rather than an incidental edit: the eyebrow used to say "Patient
    // View" — a lens that no longer exists — while `up` already pointed at the
    // chart. The trail now names what it links to, which is what PageHeader's
    // contract asks for.
    const up = screen.getByRole('link', { name: /Patient Chart/ })
    expect(up.getAttribute('href')).toBe('/patient/record')
  })

  it('does not carry the C-SSRS simulator', () => {
    renderPage()
    expect(screen.queryByText('Try a C-SSRS result')).toBeNull()
    expect(document.querySelector('.pathway-sim')).toBeNull()
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0)
  })

  it('still labels what the artifact deliberately does not encode', () => {
    renderPage()
    expect(screen.getByText('Pending clinical definition')).toBeDefined()
    expect(screen.getByText('Step-down criteria')).toBeDefined()
  })
})
