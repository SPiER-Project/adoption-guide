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
    await waitFor(() => expect(screen.getByTestId('scope').textContent).toBe('in-context'))
    // The whole point: NOT 14. A SMART token is bound to one patient, so a
    // 14-row caseload would be a claim this connection cannot support.
    expect(Number(screen.getByTestId('count').textContent)).toBe(1)
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
