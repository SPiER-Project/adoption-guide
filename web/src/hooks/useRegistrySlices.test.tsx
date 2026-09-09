/**
 * @vitest-environment jsdom
 *
 * The `FhirDataSource` seam, at the population scale — step C (#390).
 *
 * What this covers is the wiring, not the helpers: that the population lens and
 * the measure dashboard read through whatever source the provider made active,
 * rather than the concrete `localDataSource` they used to import. Nothing tested
 * that before, because neither page had a test at all, which is exactly how they
 * stayed local-only under SMART for as long as they did.
 *
 * Four properties, each of which was broken or absent before this step:
 *
 *  1. a synchronous source (the local demo store) hydrates on first paint;
 *  2. an ASYNC-ONLY source — no `getSliceSync`, which is what a real server is —
 *     resolves through `getSlice`. This is the path that did not exist: the pages
 *     called the optional sync read and nothing else;
 *  3. under SMART the cohort narrows to the patient in context, because a token is
 *     bound to one patient. It must NOT silently keep serving local rows;
 *  4. one unreadable patient (a 403 for a foreign subject) does not blank the page.
 *
 * ⚠️ Each test injects a FRESH `LocalDataSource` through `PatientProvider`'s
 * `dataSource` prop and calls `cleanup()`. `localDataSource` is a module singleton
 * that reads `localStorage` only in its constructor, so `localStorage.clear()`
 * leaves its in-memory store intact and state leaks between tests in one file —
 * the #371 trap.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PatientProvider } from '../context/PatientProvider'
import { SmartContext } from '../context/SmartContext'
import { LocalDataSource } from '../lib/dataSource/localDataSource'
import { useRegistrySlices } from './useRegistrySlices'
import type { FhirDataSource } from '@spier/core/lib/dataSource/types'
import type { PatientSlice } from '@spier/core/types/fhir'

const SMART_STUB = {
  client: null,
  patient: null,
  error: null,
  setSmartData: () => {},
  setError: () => {},
}

const EMPTY: PatientSlice = { responses: [], observations: [], carePlans: [], riskAlerts: [] }

/** Reports what the hook returned, so assertions read off the DOM. */
function Probe() {
  const { entries, scope, isLoading } = useRegistrySlices()
  return (
    <div>
      <span data-testid="scope">{scope}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="count">{entries.length}</span>
      <span data-testid="ids">{entries.map(e => e.patient.id).join(',')}</span>
      <span data-testid="observations">
        {entries.reduce((n, e) => n + (e.slice.observations?.length ?? 0), 0)}
      </span>
    </div>
  )
}

function renderProbe(source: FhirDataSource, smart: Partial<typeof SMART_STUB> = {}) {
  return render(
    <MemoryRouter initialEntries={['/population']}>
      <SmartContext.Provider value={{ ...SMART_STUB, ...smart } as never}>
        <PatientProvider dataSource={source}>
          <Probe />
        </PatientProvider>
      </SmartContext.Provider>
    </MemoryRouter>,
  )
}

/** An async-only source: no `getSliceSync`, which is what an HTTP server is. */
function asyncSource(slices: Record<string, PatientSlice>, failFor: string[] = []): FhirDataSource {
  return {
    getSlice: (id) =>
      failFor.includes(String(id))
        ? Promise.reject(new Error('403 foreign patient'))
        : Promise.resolve(slices[String(id)] ?? EMPTY),
    saveResponse: () => Promise.resolve(),
    saveArtifact: () => Promise.resolve(),
    subscribe: () => () => {},
  }
}

describe('useRegistrySlices — the population read goes through the seam', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('hydrates the whole registry from a synchronous source on first paint', async () => {
    renderProbe(new LocalDataSource())
    // No `waitFor`: a sync source must be populated on the first render, which is
    // the behaviour the direct `localDataSource` import used to provide.
    expect(screen.getByTestId('scope').textContent).toBe('registry')
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(Number(screen.getByTestId('count').textContent)).toBe(14)
    // Seeded scenario data really arrived, rather than 14 empty slices.
    await waitFor(() =>
      expect(Number(screen.getByTestId('observations').textContent)).toBeGreaterThan(0),
    )
  })

  it('resolves through getSlice when the source has NO synchronous read', async () => {
    const source = asyncSource({
      'patient-001': { ...EMPTY, observations: [{ resourceType: 'Observation' } as never] },
    })
    renderProbe(source)
    // The path that did not exist before: the pages only ever called getSliceSync.
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    expect(screen.getByTestId('scope').textContent).toBe('registry')
    expect(Number(screen.getByTestId('count').textContent)).toBe(14)
    expect(Number(screen.getByTestId('observations').textContent)).toBe(1)
  })

  it('narrows to the patient in context under SMART, instead of serving local rows', async () => {
    const smart = {
      client: { patient: { id: 'patient-011' } },
      patient: { id: 'patient-011', name: [{ family: 'Alvarez', given: ['Maria'] }] },
    }
    renderProbe(new LocalDataSource(), smart as never)
    // ⚠️ **Wait on the COUNT, not on `scope`.** `scope` is derived in a `useMemo`,
    // so it reads 'in-context' on the very first render — before the effect that
    // loads the slice has run. Waiting on it therefore waits for nothing, and the
    // assertions below raced the effect: they passed locally every time and CI
    // failed with `expected +0 to be 1`, which is the signature of a test whose
    // wait target is synchronous.
    //
    // The count is the value the effect actually produces, so waiting on it waits
    // for the thing under test. The whole point of that value: NOT 14. A SMART
    // token is bound to one patient, so a 14-row caseload would be a claim this
    // connection cannot support.
    await waitFor(() => expect(Number(screen.getByTestId('count').textContent)).toBe(1))
    expect(screen.getByTestId('scope').textContent).toBe('in-context')
    expect(screen.getByTestId('ids').textContent).toBe('patient-011')
  })

  it('keeps the page populated when one patient is unreadable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const source = asyncSource(
      { 'patient-002': { ...EMPTY, observations: [{ resourceType: 'Observation' } as never] } },
      ['patient-001'],
    )
    renderProbe(source)
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'))
    // A rejected read becomes an empty slice for that patient, not a blank page.
    expect(Number(screen.getByTestId('count').textContent)).toBe(14)
    expect(Number(screen.getByTestId('observations').textContent)).toBe(1)
    spy.mockRestore()
  })
})

/**
 * The cohort read (#401). What separates a worklist session from a chart one is
 * no longer a guess this hook makes — it is what the source answers.
 *
 * ⚠️ The `null` case is the one that matters. A source that cannot serve a
 * cohort must leave the page saying "one patient", never showing bundled rows
 * beside a live connection (blocker 1, #390) and never showing an empty caseload
 * as though the panel were empty.
 */
describe('useRegistrySlices — listCohort decides the cohort', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  /**
   * ⚠️ These drive the REAL `SmartDataSource`, not an injected fake, and they
   * have to: `PatientProvider` builds a `SmartDataSource` whenever a SMART
   * client exists, so a client stub deliberately wins over the `dataSource`
   * prop. The stub is therefore a fake *client* — which is the better test
   * anyway, since it exercises the roster request and the FHIR→registry mapping
   * rather than trusting them.
   *
   * `patient.id` must exist as a property even when null: `PatientProvider`
   * reads `smartClient?.patient.id`.
   */
  function clientServing(
    patientId: string | null,
    roster: Array<Record<string, unknown>> | Error,
  ) {
    return {
      patient: { id: patientId },
      request: (arg: unknown) => {
        const url = typeof arg === 'string' ? arg : String((arg as { url?: string })?.url ?? '')
        if (url === 'Patient') {
          return roster instanceof Error ? Promise.reject(roster) : Promise.resolve(roster)
        }
        // Every per-patient slice search: empty, so the test is about the cohort.
        return Promise.resolve([])
      },
    } as never
  }

  /** `isSmartConnected` is derived from the SMART patient having a NAME. */
  const smartPatient = (id: string) => ({ id, name: [{ family: 'Test' }] }) as never

  const FHIR_ROSTER = [
    {
      resourceType: 'Patient',
      id: 'srv-1',
      name: [{ given: ['Server'], family: 'One' }],
      gender: 'female',
      birthDate: '1990-01-01',
      identifier: [{ system: 'http://thespierproject.org/fhir/identifier/mrn', value: '111' }],
    },
    {
      resourceType: 'Patient',
      id: 'srv-2',
      name: [{ given: ['Server'], family: 'Two' }],
      gender: 'male',
      birthDate: '1985-02-02',
    },
  ]

  it('serves the roster the SERVER returned, not the bundled registry', async () => {
    // A worklist launch: a client, no patient. The ids are the server's, so a
    // bundled fallback would show as `patient-0NN` rows instead of these.
    renderProbe(asyncSource({}), { client: clientServing(null, FHIR_ROSTER), patient: null })
    // ⚠️ Both assertions inside `waitFor`, and the second one is why. `scope`
    // flips the moment the cohort resolves, but `ids` comes from `entries`,
    // which the per-patient slice reads fill a tick later. Asserting ids right
    // after the scope settles passed in isolation and failed under full-suite
    // load — a race in the test, not in the hook.
    await waitFor(() => {
      expect(screen.getByTestId('scope').textContent).toBe('registry')
      expect(screen.getByTestId('ids').textContent).toBe('srv-1,srv-2')
    })
  })

  it('falls back to the patient in context on a CHART launch', async () => {
    // A patient-bound token 403s for anyone else, so `listCohort` declines
    // without even asking — `client.patient.id` is the question.
    renderProbe(asyncSource({}), {
      client: clientServing('patient-002', FHIR_ROSTER),
      patient: smartPatient('patient-002'),
    })
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('in-context'))
    expect(screen.getByTestId('ids').textContent).toBe('patient-002')
  })

  it('treats a REFUSED roster as "cannot answer", not as a page error', async () => {
    // A server that declines the roster is answering the question. The honest
    // rendering is the same one-patient state, not the error state.
    renderProbe(asyncSource({}), {
      client: clientServing(null, new Error('403 forbidden')),
      patient: null,
    })
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('in-context'))
    // No patient in context either, so the honest answer is an empty cohort —
    // which the page's scope notice explains rather than presenting as a panel.
    expect(screen.getByTestId('count').textContent).toBe('0')
  })
})
