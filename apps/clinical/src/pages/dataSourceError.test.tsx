/**
 * @vitest-environment jsdom
 *
 * The chart's error banner says what happened in a clinician's words, whatever
 * the EHR threw.
 *
 * ⚠️ **Every error here is one core REALLY throws**, not a hand-typed string.
 * The leak this guards was invisible to every gate because the message is
 * assembled at runtime: `SmartDataSource` builds "Writeback failed — no resource
 * was created. QuestionnaireResponse: Failed to create QuestionnaireResponse —
 * HTTP 422: …", and fhirclient's own `HttpError` appends the server's
 * OperationOutcome to its status line. A test that typed those strings would
 * certify the banner against copy nobody produces. So this mounts the REAL
 * `SmartPatientProvider`, which builds the REAL `SmartDataSource` over a client whose
 * requests fail with fhirclient's REAL `HttpError`, and drives the two
 * entry points that reach `dataSourceError` — the slice load and the save — to
 * every failure kind. Both pages that render the banner are mounted.
 *
 * The word list is `scripts/lib/fhir-vocabulary.mjs`, the one `check:jargon`
 * reads, matched with a plural — the scorecard's test once matched
 * `Observation\b`, which "2 Observations written" walks straight past.
 *
 * Each case also asserts that the failure's `detail` DOES carry the wire
 * vocabulary. Without that, a fake that threw clean messages would pass this
 * test and prove nothing.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useEffect } from 'react'
import { render, cleanup, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HttpError from 'fhirclient/HttpError'
import { SmartPatientProvider } from '@spier/app-shell/context/SmartPatientProvider'
import { SmartContext, type SmartContextType } from '@spier/app-shell/context/SmartContext'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { SurfaceLinksContext } from '@spier/tool-views/context/SurfaceLinksContext'
import { nativeQr } from '@spier/core/lib/observationMappers/__fixtures__/nativeQr'
import type { DataSourceFailure } from '@spier/core/lib/dataSource/failure'
import type { SmartClient } from '@spier/core/types/smartClient'
import type { QuestionnaireResponseResource } from '@spier/core/types/fhir'
import { RESOURCE_TYPES } from '../../../../scripts/lib/fhir-vocabulary.mjs'
import { CLINICAL_SURFACE_LINKS } from '../surfaceLinks'

vi.mock('@spier/tool-views/context/PresentationContext', () => ({
  usePresentation: () => ({ chromeMode: 'ehr', hostDrawsPatientBanner: false }),
}))
vi.mock('../context/ToolConfigContext', () => ({
  useToolConfig: () => ({ isToolEnabled: () => true }),
}))

// jsdom implements neither, and the chart's scroll hook calls both on mount.
Element.prototype.scrollTo = () => {}
window.scrollTo = () => {}

const { PatientChart } = await import('./PatientChart')
const { PatientOnFile } = await import('./PatientOnFile')

afterEach(cleanup)

const CSSRS_SCREENER = 'http://thespierproject.org/fhir/Questionnaire/C-SSRS-Screener'
const PATIENT_ID = 'smart-pt-1'

/**
 * What the clinician must not read: every resource type (singular OR plural),
 * the server's outcome resource, a transport status and its number, and the
 * name of the launch protocol.
 */
const WIRE_WORDS: RegExp[] = [
  ...[...RESOURCE_TYPES, 'OperationOutcome', 'CapabilityStatement'].map(t => new RegExp(`\\b${t}s?\\b`)),
  /HTTP/i,
  /\b[45]\d\d\b/,
  /\bSMART\b/,
]

const wireIn = (text: string) => WIRE_WORDS.filter(re => re.test(text)).map(String)

/** A failed request exactly as fhirclient produces one: `checkResponse` → `parse()`. */
async function httpError(status: number, statusText: string, diagnostics: string): Promise<Error> {
  const body = {
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'error', code: 'processing', diagnostics }],
  }
  const response = new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'content-type': 'application/fhir+json' },
  })
  return new HttpError(response).parse()
}

interface Faults {
  /** Fail every chart search with this status. */
  search?: [number, string]
  /** Fail a POST of these resource types with this status. */
  post?: { types: string[]; status: [number, string] }
  /** Launch with no patient in context. */
  noPatient?: boolean
}

const LADDER_TYPES = ['QuestionnaireResponse', 'Observation', 'DocumentReference', 'Condition']

function fakeClient(faults: Faults): SmartClient {
  let n = 0
  const client = {
    patient: { id: faults.noPatient ? undefined : PATIENT_ID },
    async request(arg: unknown) {
      if (arg === 'metadata') {
        return {
          resourceType: 'CapabilityStatement',
          rest: [{ mode: 'server', resource: LADDER_TYPES.map(type => ({ type, interaction: [{ code: 'create' }] })) }],
        }
      }
      if (typeof arg === 'string') {
        if (faults.search) {
          const [status, text] = faults.search
          throw await httpError(status, text, `${arg.split('?')[0]} search failed`)
        }
        return []
      }
      const req = arg as { url: string; method?: string; body?: string }
      const resource = JSON.parse(req.body ?? '{}') as { resourceType: string }
      if (faults.post?.types.includes(resource.resourceType)) {
        const [status, text] = faults.post.status
        throw await httpError(status, text, `${resource.resourceType}.item[0]: unknown linkId`)
      }
      return { body: { ...resource, id: `srv-${++n}` }, response: { headers: new Headers() } }
    },
  }
  return client as unknown as SmartClient
}

type Probe = { submit: (qr: QuestionnaireResponseResource) => void; error: DataSourceFailure | null }

/** Hands the provider's save entry point and its current error back to the test. */
function Harness({ onProbe }: { onProbe: (p: Probe) => void }) {
  const { addResponse, dataSourceError } = usePatient()
  useEffect(() => {
    onProbe({ submit: qr => addResponse('C-SSRS Screener', qr), error: dataSourceError })
  }, [addResponse, dataSourceError, onProbe])
  return null
}

function mount(faults: Faults) {
  const probe: { current: Probe | null } = { current: null }
  const smart: SmartContextType = {
    client: fakeClient(faults),
    patient: faults.noPatient ? null : { id: PATIENT_ID, name: 'Test Patient' },
    error: null,
    setSmartData: () => {},
    setError: () => {},
  }
  // ONE provider over both pages: a save error lives in the provider that
  // saved, so a page under a second provider would never show it.
  const { container } = render(
    <MemoryRouter initialEntries={['/patient/record']}>
      <SmartContext.Provider value={smart}>
        <SmartPatientProvider>
          <SurfaceLinksContext.Provider value={CLINICAL_SURFACE_LINKS}>
            <div data-page="chart">
              <PatientChart />
            </div>
            <div data-page="on-file">
              <PatientOnFile />
            </div>
            <Harness onProbe={p => (probe.current = p)} />
          </SurfaceLinksContext.Provider>
        </SmartPatientProvider>
      </SmartContext.Provider>
    </MemoryRouter>,
  )
  const pages = [...container.querySelectorAll('[data-page]')]
  return { probe, pages }
}

/** The one danger notice each page draws, once the failure has landed. */
async function banners(pages: ReturnType<typeof mount>['pages']): Promise<string[]> {
  return waitFor(() =>
    pages.map(page => {
      const found = page.querySelectorAll('.notice--danger')
      expect(found, page.getAttribute('data-page') ?? '').toHaveLength(1)
      return found[0].textContent ?? ''
    }),
  )
}

const submission = () => ({ ...nativeQr(CSSRS_SCREENER, { q1: true, q2: true }), id: 'client-qr-1' })

const CASES: Array<{
  name: string
  faults: Faults
  submit?: boolean
  kind: DataSourceFailure['kind']
  title: string
}> = [
  {
    name: 'a chart read the server fails',
    faults: { search: [500, 'Internal Server Error'] },
    kind: 'not-loaded',
    title: 'Could not load this chart from the EHR.',
  },
  {
    name: 'a chart read the server forbids',
    faults: { search: [403, 'Forbidden'] },
    kind: 'not-authorized',
    title: 'The EHR refused access.',
  },
  {
    name: 'a launch with no patient in it',
    faults: { noPatient: true },
    kind: 'no-patient',
    title: 'No patient is open.',
  },
  {
    name: 'a save where every write is rejected',
    faults: { post: { types: LADDER_TYPES, status: [422, 'Unprocessable Entity'] } },
    submit: true,
    kind: 'nothing-saved',
    title: 'Not saved to the EHR.',
  },
  {
    name: 'a save where every write is forbidden',
    faults: { post: { types: LADDER_TYPES, status: [403, 'Forbidden'] } },
    submit: true,
    kind: 'not-authorized',
    title: 'The EHR refused access.',
  },
  {
    name: 'a save that fails before the form is written',
    faults: { post: { types: ['Encounter'], status: [422, 'Unprocessable Entity'] } },
    submit: true,
    kind: 'save-failed',
    title: 'Not saved to the EHR.',
  },
]

describe('the chart error banner names no wire format, from the errors core actually throws', () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const { probe, pages } = mount(c.faults)
      if (c.submit) {
        await waitFor(() => expect(probe.current).not.toBeNull())
        act(() => probe.current!.submit(submission()))
      }

      const texts = await banners(pages)
      // The harness publishes from an effect, which can trail the paint.
      const error = await waitFor(() => {
        expect(probe.current?.error?.kind).toBe(c.kind)
        return probe.current!.error!
      })
      // The input really was wire vocabulary — otherwise this proves nothing.
      expect(wireIn(error.detail), error.detail).not.toEqual([])

      for (const text of texts) {
        expect(text.startsWith(c.title), text).toBe(true)
        expect(wireIn(text), text).toEqual([])
      }
    })
  }
})
