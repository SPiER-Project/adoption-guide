/**
 * @vitest-environment jsdom
 *
 * The published protocol page — the implementer's half of the Care Pathway
 * split (adoption-guide UX audit §4.2, 2026-09-20).
 *
 * Three properties make it a different page from the explainer, and each is a
 * rule a later edit could quietly undo:
 *
 *  1. **It renders the whole artifact.** The spine's steps, the tier table,
 *     the pending strip and the provenance canonical are all here.
 *  2. **It is the one page in the guide that says "rendered from the published
 *     PlanDefinition"** — once (§5 rule 5).
 *  3. **The FHIRPath gates and canonical URLs are in the drawer, and the drawer
 *     exists only under inspection.** Rendered without the guide layout's
 *     provider — as a clinician's surface would — the page shows the protocol
 *     in words and not one expression.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CarePathwayProtocol } from './CarePathwayProtocol'
import { InspectContext } from '@spier/tool-views/context/InspectContext'

afterEach(cleanup)

const CANONICAL = 'http://thespierproject.org/fhir/PlanDefinition/SPiERSuicideSaferCarePathway'
const FHIRPATH = /%episode\.extension\('http:\/\/thespierproject\.org\/fhir\/StructureDefinition\/episode-current-risk-tier'\)/

function renderPage(inspect: boolean) {
  const page = <CarePathwayProtocol />
  return render(
    <MemoryRouter initialEntries={['/guide/pathway/protocol']}>
      {inspect ? <InspectContext.Provider value>{page}</InspectContext.Provider> : page}
    </MemoryRouter>,
  )
}

describe('CarePathwayProtocol — the published protocol', () => {
  it('renders the whole artifact: steps, tier table, pending strip and provenance', () => {
    renderPage(true)
    // Scoped to the spine: the drawer lists the same step titles again.
    const spine = within(document.querySelector('.pathway-spine') as HTMLElement)
    expect(spine.getByText('Screen for suicide risk')).toBeDefined()
    expect(spine.getByText('Assess suicide risk after a positive screen')).toBeDefined()
    expect(spine.getByText(/Apply the obligations for the patient.s current risk tier/)).toBeDefined()
    expect(spine.getByText('Clinician guidance')).toBeDefined()
    expect(document.querySelector('.pathway-matrix')).not.toBeNull()
    expect(screen.getByText('Pending clinical definition')).toBeDefined()
    expect(screen.getByText(CANONICAL)).toBeDefined()
    // No column lit: nothing on this page derives a tier.
    expect(document.querySelector('.pathway-matrix__cell--active')).toBeNull()
    expect(document.querySelector('.pathway-matrix__cell--dimmed')).toBeNull()
  })

  it('says "rendered from the published PlanDefinition" exactly once, and names its reader', () => {
    renderPage(true)
    const lede = document.querySelector('.care-pathway__lede')?.textContent ?? ''
    expect(lede.startsWith('If you are wiring this into an EHR')).toBe(true)
    const prose = [...document.querySelectorAll('p')].map(p => p.textContent ?? '').join('\n')
    expect(prose.match(/rendered from the published PlanDefinition/g)).toHaveLength(1)
  })

  it('keeps the FHIRPath gates and canonical URLs in the drawer, out of the spine', () => {
    renderPage(true)
    // Not in the spine or the table...
    const spine = document.querySelector('.pathway-spine')!
    expect(spine.textContent).not.toMatch(FHIRPATH)
    expect(spine.textContent).not.toContain('http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs')
    // ...but in the drawer, once per tier gate, with the trigger and the canonicals beside them.
    const summary = screen.getByText('The gates and references, as written')
    fireEvent.click(summary)
    const drawer = summary.closest('details')!
    const exprs = [...drawer.querySelectorAll('pre')].map(pre => pre.textContent ?? '')
    expect(exprs.filter(e => FHIRPATH.test(e))).toHaveLength(3)
    expect(exprs.some(e => e.includes('%phq9Item9Observation.value >= 1'))).toBe(true)
    expect(exprs.some(e => e.includes('44260-8'))).toBe(true)
    expect(exprs).toContain('http://thespierproject.org/fhir/ActivityDefinition/ShareCrisisResources')
    expect(exprs).toContain('http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs')
  })

  it('renders no drawer and no expression at all without inspection — the clinician\'s answer', () => {
    renderPage(false)
    expect(screen.getByText('Screen for suicide risk')).toBeDefined()
    expect(document.querySelector('details')).toBeNull()
    expect(screen.queryByText('The gates and references, as written')).toBeNull()
    expect(document.body.textContent).not.toMatch(FHIRPATH)
    expect(document.body.textContent).not.toMatch(/%phq9Item9Observation/)
  })
})
