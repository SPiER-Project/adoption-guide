/**
 * @vitest-environment jsdom
 *
 * The chart's guidance cards, as a clinician reads them, name no wire format.
 *
 * ⚠️ **Why this test exists beside `check:jargon`.** The clinical scan reads
 * string LITERALS in apps/clinical, packages/tool-views and packages/app-shell.
 * A guidance card's words are assembled at runtime in packages/core — partly
 * from the published pathway PlanDefinition — so no literal the scan reads ever
 * held "LOINC 93374-7", and the problem-list card shipped that sentence (and a
 * value-set canonical, and SNOMED CT ids) to the chart with the gate green.
 * Observed 2026-10-09 on a live SMART sandbox run and on the mock EHR.
 *
 * So this test mounts the real rail with the cards the REAL builder makes for
 * every demo patient, opens every clipped detail, and applies the ONE clinical
 * rule list `check:jargon` applies (`scripts/lib/reader-jargon.mjs`) — loaded,
 * not copied. A hand-written card string would certify a sentence the app
 * never produces (the PR #614 lesson, for the writeback scorecard).
 *
 * It also reads the builder's `detail` directly, because that same field is
 * what `services/cds` returns to a host EHR, whose clinician reads it too:
 * `detail` is clinician copy everywhere, and the wire facts it used to carry
 * live in the card's `extension` (see `problemListCard.ts`).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { STAGES } from '@spier/core/data/catalog'
import { buildCdsCards, isPathwayObligationCard } from '@spier/core/lib/cdsHooks'
import { PROBLEM_LIST_CARD_ID } from '@spier/core/lib/cdsHooks/problemListCard'
import type { StageArtifacts, StageStatus } from '@spier/core/lib/patientPathway'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { PresentationProvider } from '@spier/tool-views/context/PresentationProvider'
import { clinicalJargonIn } from '../../../../scripts/lib/reader-jargon.mjs'
import { PatientPathway } from './PatientPathway'

afterEach(cleanup)

const emptyGroups: StageArtifacts[] = STAGES.map(s => ({
  stageId: s.id,
  responses: [],
  carePlans: [],
  observations: [],
  communications: [],
  workflowArtifacts: [],
}))
const statuses: Record<string, StageStatus> = Object.fromEntries(STAGES.map(s => [s.id, 'complete']))

/** The guidance cards the chart draws for one demo patient — PatientChart's own filter. */
function guidanceCardsFor(patientId: string) {
  return buildCdsCards({ record: POPULATION_SCENARIOS[patientId], isToolEnabled: () => true }).filter(
    c => !isPathwayObligationCard(c),
  )
}

const PATIENTS = Object.keys(POPULATION_SCENARIOS).sort()
const WITH_PROBLEM_LIST_CARD = PATIENTS.filter(id =>
  guidanceCardsFor(id).some(c => c.extension?.['spier-card-id'] === PROBLEM_LIST_CARD_ID),
)

describe('guidance cards on the chart name no wire format', () => {
  it('has patients to read — a floor, so an empty population cannot pass', () => {
    // Patients 001, 006 and 009 carry a positive harmonized tier at the time of
    // writing; several more do. Fewer than three means the builder stopped
    // firing, and every assertion below would be reading nothing.
    expect(WITH_PROBLEM_LIST_CARD.length).toBeGreaterThanOrEqual(3)
  })

  it.each(PATIENTS)('%s: every rendered card reads as clinician copy', patientId => {
    const cards = guidanceCardsFor(patientId)
    const { container } = render(
      <MemoryRouter>
        <PresentationProvider initialMode="ehr">
          <PatientPathway stageGroups={emptyGroups} statuses={statuses} cards={cards} />
        </PresentationProvider>
      </MemoryRouter>,
    )
    // A clipped detail hides most of the card — open every one.
    for (const more of Array.from(container.querySelectorAll<HTMLButtonElement>('.cds-card-more'))) {
      fireEvent.click(more)
    }
    const rendered = Array.from(container.querySelectorAll('.cds-card')).map(el => el.textContent ?? '')
    expect(rendered.length).toBe(cards.length)
    const hits = rendered.map(text => clinicalJargonIn(text)).filter(Boolean)
    expect(hits).toEqual([])
  })

  it.each(WITH_PROBLEM_LIST_CARD)('%s: the problem-list card detail a host EHR receives is clinician copy too', id => {
    const card = guidanceCardsFor(id).find(c => c.extension?.['spier-card-id'] === PROBLEM_LIST_CARD_ID)!
    expect(card.detail?.length ?? 0).toBeGreaterThan(50)
    expect(clinicalJargonIn(`${card.summary}\n${card.detail}`)).toBeNull()
  })
})
