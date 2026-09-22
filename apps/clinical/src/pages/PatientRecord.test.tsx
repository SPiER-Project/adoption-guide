/**
 * @vitest-environment jsdom
 *
 * One record, opened — the four properties that make this page worth having.
 *
 *  1. **The answers are there, and they are QUESTIONS and answers.** The gap
 *     this page closes is that a clinician could read "PHQ-9 · Jul 31" and not
 *     one thing the patient said. The captured responses carry `linkId` and an
 *     answer and no question text at all, so rendering the response alone gives
 *     nine answers to nine unnamed questions — the join to the Questionnaire is
 *     the feature, not an implementation detail, and it is what this asserts.
 *  2. **Every row on both lists opens.** `check:surface-links` cannot see these
 *     links: the target is computed (`/patient/on-file/${key}`), which that gate
 *     states as its own blind spot. So the reachability is pinned here, in both
 *     directions — every row has an address, and every address resolves to the
 *     row it came from.
 *  3. **The two lists agree about a record's address.** The stage rail and
 *     *What's on file* are two components over the same artifacts; a record
 *     reached from one must be the same page as from the other, or the same
 *     record has two URLs and the browser has two histories for it.
 *  4. **No resource type anywhere on it.** The clinical surface names no wire
 *     format (clinical-app audit §1.9), and this page renders more of a
 *     resource than anything else on that surface does.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, renderHook } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { groupArtifactsByStage } from '@spier/core/lib/patientPathway'
import { workflowArtifactsOf } from '@spier/core/lib/registry'
import { useOnFileGroups } from '../lib/onFileGroups'
import { recordPath } from '../lib/recordKeys'
import { ArtifactCards } from '../components/ChartArtifacts'

const scenario = POPULATION_SCENARIOS['patient-001']

const input = {
  episodes: scenario.episodes ?? [],
  encounters: scenario.encounters ?? [],
  responses: scenario.responses,
  observations: scenario.observations,
  carePlans: scenario.carePlans,
  communications: scenario.communications ?? [],
  serviceRequests: scenario.serviceRequests ?? [],
  procedures: scenario.procedures ?? [],
  documentReferences: scenario.documentReferences ?? [],
  appointments: scenario.appointments ?? [],
  consents: scenario.consents ?? [],
  flags: scenario.flags ?? [],
  tasks: scenario.tasks ?? [],
}

vi.mock('@spier/tool-views/context/PatientContext', () => ({
  usePatient: () => ({
    ...input,
    riskAlerts: scenario.riskAlerts,
  }),
}))

const { PatientRecord } = await import('./PatientRecord')

afterEach(cleanup)

function open(key: string) {
  return render(
    <MemoryRouter initialEntries={[`/patient/on-file/${key}`]}>
      <Routes>
        <Route path="/patient/on-file/:recordKey" element={<PatientRecord />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Every row *What's on file* lists, as the page itself resolves them. */
function rows() {
  const { result } = renderHook(() => useOnFileGroups(input))
  return result.current.flatMap(g => g.rows)
}

describe('an opened record', () => {
  it('shows the questions the instrument asked and the answers given to them', () => {
    const { container } = open('form-p001-phq9')
    const text = container.textContent ?? ''
    // The question comes from the Questionnaire; the response carries only `q1`.
    expect(text).toContain('Little interest or pleasure in doing things')
    expect(text).toContain('Thoughts that you would be better off dead')
    // …and the answers, in the words the instrument offers.
    expect(text).toContain('Nearly every day')
    expect(container.querySelectorAll('.record-answers__line')).toHaveLength(9)
  })

  it('groups a safety plan by the steps the instrument publishes', () => {
    const { container } = open('form-p001-sb')
    const headings = [...container.querySelectorAll('.record-answers__heading')].map(
      h => h.textContent ?? '',
    )
    // Seven steps, not the repeating sub-groups inside three of them — a reader
    // scanning for the lethal-means step finds it where the instrument put it.
    expect(headings).toHaveLength(7)
    expect(headings[0]).toContain('STEP 1')
    expect(headings[5]).toContain('STEP 6')
    // Four warning signs are four answers to ONE question, joined as the plan
    // built from them joins them.
    expect(container.textContent).toContain(
      'Feeling trapped, chest tightness, racing thoughts at night, withdrawing from friends',
    )
  })

  it('shows what a result says, and what a form produced', () => {
    const result = open('result-p001-phq9-total')
    expect(result.container.querySelector('.record-reading__value')?.textContent).toBe('18')
    expect(result.container.textContent).toContain('Moderately Severe depression')
    // …and the two directions agree: the form lists the result, the result
    // links back to the form.
    expect(result.container.querySelector('.record-links a')?.getAttribute('href')).toContain(
      'form-p001-phq9',
    )
    cleanup()
    const form = open('form-p001-phq9')
    const produced = [...form.container.querySelectorAll('.record-links a')].map(a =>
      a.getAttribute('href'),
    )
    expect(produced.some(h => h?.includes('result-p001-phq9-total'))).toBe(true)
  })

  it('shows a plan as its steps, and a handoff as the few facts it carries', () => {
    const plan = open('plan-p001-stanley-brown')
    expect(plan.container.textContent).toContain('Step 6: Lethal Means Safety')
    cleanup()
    const referral = open('referral-p001-referral')
    const text = referral.container.textContent ?? ''
    expect(text).toContain('Riverside Behavioral Health')
    expect(text).toContain('Post-discharge follow-up')
  })

  it('says so when the key names nothing on this chart, rather than rendering an empty page', () => {
    const { container } = open('result-not-a-record')
    expect(container.textContent).toContain('This is not on the open chart')
    expect(container.querySelector('.record-answers')).toBeNull()
  })

  it('names no resource type', () => {
    for (const key of ['form-p001-phq9', 'result-p001-phq9-total', 'plan-p001-stanley-brown']) {
      const { container } = open(key)
      const text = container.textContent ?? ''
      for (const type of [
        'QuestionnaireResponse', 'DocumentReference', 'ServiceRequest', 'EpisodeOfCare',
        'CarePlan', 'Observation', 'Communication',
      ]) {
        expect(text, `"${type}" is on the ${key} page`).not.toContain(type)
      }
      cleanup()
    }
  })
})

describe('every record on file can be opened', () => {
  it('gives every row an address that resolves to that row', () => {
    const all = rows()
    expect(all.length).toBeGreaterThan(10)
    for (const row of all) {
      expect(row.href, `${row.name} has no address`).toBeTruthy()
      const key = row.href!.replace('/patient/on-file/', '')
      const { container } = open(key)
      expect(
        container.textContent,
        `${row.href} does not open ${row.name}`,
      ).not.toContain('This is not on the open chart')
      expect(container.querySelector('.page-header__title')?.textContent).toBe(row.name)
      cleanup()
    }
  })

  it('gives the stage rail the same addresses as the list', () => {
    const artifacts = {
      responses: scenario.responses,
      carePlans: scenario.carePlans,
      observations: scenario.observations,
      communications: scenario.communications ?? [],
      workflowArtifacts: workflowArtifactsOf({
        documentReferences: scenario.documentReferences ?? [],
        serviceRequests: scenario.serviceRequests ?? [],
        appointments: scenario.appointments ?? [],
        consents: scenario.consents ?? [],
        procedures: scenario.procedures ?? [],
      }),
    }
    const onFile = new Set(rows().map(r => r.href))
    const stageLinks: string[] = []
    for (const group of groupArtifactsByStage(artifacts)) {
      const { container } = render(
        <MemoryRouter>
          <ArtifactCards
            responses={group.responses}
            carePlans={group.carePlans}
            observations={group.observations}
            communications={group.communications}
            workflowArtifacts={group.workflowArtifacts}
          />
        </MemoryRouter>,
      )
      stageLinks.push(
        ...[...container.querySelectorAll('.stage-artifact-name a')].map(
          a => a.getAttribute('href') ?? '',
        ),
      )
      cleanup()
    }
    expect(stageLinks.length).toBeGreaterThan(10)
    for (const href of stageLinks) {
      expect(onFile, `the rail links ${href}, which is on no row of the list`).toContain(href)
    }
  })

  it('never builds an address for an artifact with no id', () => {
    expect(recordPath({ resourceType: 'Observation' })).toBeNull()
  })
})
