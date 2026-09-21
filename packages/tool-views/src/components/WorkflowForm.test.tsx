/**
 * @vitest-environment jsdom
 *
 * The recorder frame's two beats: which chart it says a submit lands in, and
 * what it offers once one has.
 *
 * ⚠️ **The load-bearing test is "no scratch-chart notice under a launch"**
 * (clinical-app audit §1.8, §5 rule 6). Under a live SMART session every
 * recorder opened by telling the clinician *"No patient selected — this will be
 * recorded in the scratch chart"*, because the frame keyed the hint on
 * `activePatientId`, which is read off the route and is null on the launch's
 * landing route. `SmartDataSource` was meanwhile resolving the launch patient
 * and writing to their chart, so the notice was false and the data was right —
 * the worst pairing, because the screen contradicts the thing it just did.
 *
 * So the three states are asserted as three, not as "null or not null": a
 * session with a patient says nothing, a session WITHOUT one (a worklist
 * launch, which has a server and no chart) says the write has nowhere to land,
 * and only the local no-patient case is a scratch chart.
 *
 * ⚠️ **And "one next action", asserted as a COUNT.** §4.6's shape is one act,
 * one way back; the notice used to carry "View in chart" plus, on one
 * recorder, a second link. A test that only looked for the new button would
 * pass with the old ones still beside it.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { evaluatePathway, type PathwayRecord } from '@spier/core/lib/pathwayEvaluation'
import { phq9Questionnaire } from '@spier/core/data/questionnaires'
import type { FhirResource } from '@spier/core/types/fhir'
import { WorkflowForm } from './WorkflowForm'
import { PatientContext, type PatientContextType } from '../context/PatientContext'
import { PresentationProvider } from '../context/PresentationProvider'
import { SurfaceLinksContext, type SurfaceLinks } from '../context/SurfaceLinksContext'

afterEach(cleanup)

const LINKS: SurfaceLinks = {
  parent: { label: 'Patient Chart', href: '/patient/record' },
  chartHref: '/patient/record',
  registryHref: '/population/caseload',
  launchHref: slug => `/patient/assessments/${slug}`,
}

/** A guide-shaped surface: no chart, no caseload, and the tool pages instead. */
const GUIDE_LINKS: SurfaceLinks = {
  parent: { label: 'Tools', href: '/guide/tools' },
  chartHref: null,
  registryHref: null,
  launchHref: () => null,
}

/**
 * ⚠️ **An EMPTY chart on purpose.** The pathway's first row is "no screen on
 * file → screen", so an empty record is the one whose next action is stable
 * whatever else changes about the demo population — and the three notice
 * states below are about the patient in context, which an empty chart does not
 * disturb.
 */
const EMPTY: Pick<
  PatientContextType,
  'responses' | 'observations' | 'carePlans' | 'riskAlerts' | 'communications' | 'procedures' | 'episodes'
> = {
  responses: [],
  observations: [],
  carePlans: [],
  riskAlerts: [],
  communications: [],
  procedures: [],
  episodes: [],
}

function patientValue(session: {
  isSmartSession: boolean
  isSmartConnected: boolean
  activePatientId: string | null
}): PatientContextType {
  return {
    ...EMPTY,
    ...session,
    dataSource: {} as PatientContextType['dataSource'],
    patient: { resourceType: 'Patient' } as PatientContextType['patient'],
    patientDisplay: {} as PatientContextType['patientDisplay'],
    populationPatient: null,
    populationPatients: [],
    walkthrough: [],
    encounters: [],
    flags: [],
    tasks: [],
    documentReferences: [],
    serviceRequests: [],
    appointments: [],
    consents: [],
    addCarePlan: () => {},
    addResponse: () => {},
    addArtifact: () => {},
    isSliceLoading: false,
    dataSourceError: null,
    writebackReport: null,
  }
}

const LAUNCH_WITH_PATIENT = { isSmartSession: true, isSmartConnected: true, activePatientId: null }
const LAUNCH_NO_PATIENT = { isSmartSession: true, isSmartConnected: false, activePatientId: null }
const LOCAL_NO_PATIENT = { isSmartSession: false, isSmartConnected: false, activePatientId: null }
const LOCAL_WITH_PATIENT = {
  isSmartSession: false,
  isSmartConnected: false,
  activePatientId: 'patient-001',
}

/**
 * ⚠️ **The fixtures are built here rather than read from the demo population,
 * and that is a package boundary rather than a preference.**
 * `packages/tool-views/tsconfig.json` says in as many words that this package
 * has no business resolving `@spier/demo-population`; the two records below are
 * the smallest ones that exercise what is being asserted.
 */
const PHQ9_CANONICAL = String(phq9Questionnaire.url)

/** A completed screen, as far as the evaluator's first pathway row is concerned. */
const A_SCREEN = {
  resourceType: 'QuestionnaireResponse',
  id: 'response-just-written',
  status: 'completed',
  questionnaire: PHQ9_CANONICAL,
  authored: new Date().toISOString(),
} as unknown as FhirResource

/**
 * A chart on which the published pathway and the mapper's own hint name
 * DIFFERENT acts.
 *
 * ⚠️ **Needed because a plant passed without it.** The first version of "the
 * beat is the pathway's answer" ran on an empty chart, which carries no
 * `RiskAlert` at all — so rewiring `NextStep` to prefer
 * `riskAlert.suggestedAction`, the exact defect §4.6 removed, left every
 * assertion green. A test for "A and not B" has to run where A and B disagree.
 */
const HINT_LABEL = 'Start Safety Plan'
const DISAGREEING: PathwayRecord = {
  riskAlerts: [
    {
      tool: 'PHQ-9',
      level: 'moderate',
      summary: 'a summary',
      detail: 'a detail',
      suggestedAction: { label: HINT_LABEL, path: '/patient/assessments/stanley-and-brown' },
    },
  ],
}

function renderForm(
  session: Parameters<typeof patientValue>[0],
  props: { notice?: string; record?: PathwayRecord; justRecorded?: FhirResource[] } = {},
  links: SurfaceLinks = LINKS,
) {
  return render(
    <MemoryRouter>
      {/* The code drawer the frame always renders asks for it; it changes
          nothing either beat below asserts. */}
      <PresentationProvider initialMode="panel">
      <PatientContext.Provider value={{ ...patientValue(session), ...props.record }}>
        <SurfaceLinksContext.Provider value={links}>
          <WorkflowForm
            title="Log a Caring Contact"
            lede="Logs a caring contact."
            draft={{}}
            draftTitle="a draft"
            notice={props.notice}
            justRecorded={props.justRecorded}
          >
            <p>the form</p>
          </WorkflowForm>
        </SurfaceLinksContext.Provider>
      </PatientContext.Provider>
      </PresentationProvider>
    </MemoryRouter>,
  )
}

const SCRATCH = /recorded in the scratch chart/i
const NO_CHART = /no chart to record against/i

describe('which chart the frame says a submit lands in', () => {
  it('says nothing under a launch that carries a patient — audit rule 6', () => {
    renderForm(LAUNCH_WITH_PATIENT)
    expect(screen.queryByText(SCRATCH)).toBeNull()
    expect(screen.queryByText(NO_CHART)).toBeNull()
  })

  it('says nothing when a patient is open locally', () => {
    renderForm(LOCAL_WITH_PATIENT)
    expect(screen.queryByText(SCRATCH)).toBeNull()
    expect(screen.queryByText(NO_CHART)).toBeNull()
  })

  it('still names the scratch chart with no session and no patient', () => {
    renderForm(LOCAL_NO_PATIENT)
    expect(screen.getByText(SCRATCH)).toBeTruthy()
  })

  it('says there is no chart under a launch that carries no patient', () => {
    renderForm(LAUNCH_NO_PATIENT)
    expect(screen.getByText(NO_CHART)).toBeTruthy()
    // Not the scratch chart: under a session the write goes to the server or
    // fails, and it never lands in the demo's local store.
    expect(screen.queryByText(SCRATCH)).toBeNull()
  })
})

describe('the confirmation beat', () => {
  it('is absent until something has been recorded', () => {
    const { container } = renderForm(LOCAL_WITH_PATIENT)
    expect(container.querySelector('.next-step')).toBeNull()
  })

  it('offers exactly one action and one way back — audit §4.6', () => {
    const { container } = renderForm(LOCAL_WITH_PATIENT, { notice: 'Caring contact recorded.' })
    const beat = container.querySelector('.next-step')
    expect(beat).toBeTruthy()
    const labels = [...within(beat as HTMLElement).getAllByRole('link')].map(a => a.textContent)
    expect(labels).toHaveLength(2)
    expect(labels.at(-1)).toBe('Back to chart')
    // The old shape, gone: the notice's own "View in chart" and the second
    // link one recorder carried beside it.
    expect(screen.queryByText('View in chart')).toBeNull()
  })

  it('is the act the evaluator names, not a copy of it', () => {
    // ⚠️ Asserted against `evaluatePathway` rather than against the words,
    // like `ChartLanding.test.tsx`: the point of §4.6 is that the form and the
    // chart give the SAME answer, and a hardcoded expectation here would pass
    // on the day the two diverged.
    const expected = evaluatePathway({}).primary
    expect(expected?.tool).toBeTruthy()
    const { container } = renderForm(LOCAL_WITH_PATIENT, { notice: 'Caring contact recorded.' })
    const beat = container.querySelector('.next-step')
    expect(beat?.textContent).toContain(expected?.title)
    expect(within(beat as HTMLElement).getAllByRole('link')[0].textContent).toBe(expected?.tool?.label)
  })

  it('is the pathway\u2019s act and not the mapper\u2019s hint, where they disagree', () => {
    const expected = evaluatePathway(DISAGREEING).primary
    expect(expected?.tool?.label, 'the fixture must give the pathway something to name').toBeTruthy()
    expect(expected?.tool?.label).not.toBe(HINT_LABEL)

    const { container } = renderForm(LOCAL_WITH_PATIENT, {
      notice: 'Caring contact recorded.',
      record: DISAGREEING,
    })
    const beat = container.querySelector('.next-step')
    expect(within(beat as HTMLElement).getAllByRole('link')[0].textContent).toBe(expected?.tool?.label)
    expect(beat?.textContent).not.toContain(HINT_LABEL)
  })

  it('counts what this submit wrote, before the chart has echoed it', () => {
    // ⚠️ The save is asynchronous, and against a SMART server it is a round
    // trip. Without the fold, a clinician who has just completed the screen is
    // told — for as long as the write takes — to complete the screen.
    const onAnEmptyChart = evaluatePathway({}).primary
    expect(onAnEmptyChart?.kind).toBe('screen')

    const before = renderForm(LOCAL_WITH_PATIENT, { notice: 'Recorded.' })
    expect(before.container.querySelector('.next-step')?.textContent).toContain(onAnEmptyChart?.title)
    cleanup()

    const after = renderForm(LOCAL_WITH_PATIENT, { notice: 'Recorded.', justRecorded: [A_SCREEN] })
    expect(after.container.querySelector('.next-step')?.textContent).not.toContain(
      onAnEmptyChart?.title,
    )
  })

  it('offers no way back on a surface with no chart', () => {
    const { container } = renderForm(
      LOCAL_WITH_PATIENT,
      { notice: 'Caring contact recorded.' },
      GUIDE_LINKS,
    )
    const beat = container.querySelector('.next-step')
    expect(beat).toBeTruthy()
    expect(within(beat as HTMLElement).queryAllByRole('link')).toHaveLength(0)
    expect(beat?.textContent).not.toContain('Back to chart')
  })
})

