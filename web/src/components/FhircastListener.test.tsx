/**
 * @vitest-environment jsdom
 *
 * The FHIRcast follow policy — panel step 6.
 *
 * ⚠️ **Step 6 inverted half of this component's rule, and the inversion is the
 * thing to protect.** It used to ignore every incoming event under a live SMART
 * session, on the grounds that "the connected EHR owns patient context, not this
 * simulation". True of a `BroadcastChannel`, which reaches other tabs of *this
 * app*. False of a hub the EHR itself told us about: there, an event under SMART
 * *is* the EHR reporting its own context change.
 *
 * So the rule was never "ignore under SMART" — it was "do not let a simulation
 * override the system of record", and the two transports fall on opposite sides.
 * Every case below is one cell of that table, and a regression to the old flat
 * rule fails the first two.
 *
 * The transport is mocked, not the policy: these tests hand the component events
 * with a `via` and assert what it does. Whether a hub event can actually arrive
 * is `lib/fhircastHub.test.ts`'s job, and whether it crosses an origin was
 * checked in a browser (plan §6.2).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { FhircastEvent, FhircastTransportKind, PatientOpenPayload } from '../lib/fhircast'

type Handler = (p: PatientOpenPayload, e: FhircastEvent, via: FhircastTransportKind) => void

/** The handler the component registers, captured so tests can drive it. */
let captured: Handler | null = null
const navigate = vi.fn()
const marked: string[] = []

vi.mock('../lib/fhircast', () => ({
  subscribePatientOpen: (handler: Handler) => {
    captured = handler
    return () => { captured = null }
  },
  markFollowing: (id: string) => { marked.push(id) },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

/** SMART state is per-test, so the mock reads a mutable holder. */
const smart: { patient: { id?: string; name?: string } | null } = { patient: null }
vi.mock('../context/SmartContext', () => ({ useSmart: () => smart }))

const { FhircastListener } = await import('./FhircastListener')

const EVENT = {} as FhircastEvent

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <FhircastListener />
    </MemoryRouter>,
  )
}

function deliver(patientId: string, via: FhircastTransportKind, displayName?: string) {
  act(() => { captured?.({ patientId, displayName }, EVENT, via) })
}

beforeEach(() => {
  captured = null
  navigate.mockClear()
  marked.length = 0
  smart.patient = null
})
afterEach(cleanup)

describe('a hub event under SMART — the EHR speaking', () => {
  beforeEach(() => { smart.patient = { id: 'patient-011', name: 'Maria Alvarez' } })

  it('is FOLLOWED, where the old flat rule ignored it', () => {
    // The same patient the session is scoped to, viewed from elsewhere in the
    // app: navigating to their chart is exactly what a subscribed app should do.
    renderAt('/patient/chart')
    deliver('patient-011', 'hub', 'Maria Alvarez')
    expect(navigate).toHaveBeenCalledWith('/patient/chart/patient-011')
    expect(marked).toEqual(['patient-011'])
    expect(screen.getByRole('status').textContent).toContain('Maria Alvarez')
  })

  it('names the hub rather than calling itself simulated', () => {
    // "(simulated)" was accurate for every event this component could receive
    // before step 6. Saying it about a real EHR's hub event would be a false
    // claim in the UI.
    renderAt('/patient/chart')
    deliver('patient-011', 'hub', 'Maria Alvarez')
    const text = screen.getByRole('status').textContent ?? ''
    expect(text).toContain('connected EHR')
    expect(text).not.toContain('simulated')
  })

  it('warns instead of navigating when the host opens ANOTHER patient', () => {
    // ⚠️ The constraint that makes an embedded panel different: the access token
    // is bound to one patient, so "follow" cannot mean "read that patient".
    // Navigating would render a chart of 403s.
    renderAt('/patient/chart')
    deliver('patient-012', 'hub', 'Ana Ruiz')
    expect(navigate).not.toHaveBeenCalled()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Ana Ruiz')
    expect(alert.textContent).toMatch(/relaunch/i)
  })

  it('warns even off a chart route, because stale data is the danger', () => {
    // The "never interrupt other work" guard is about NAVIGATION. Someone
    // half-way through an assessment for a patient the EHR has closed is
    // precisely who needs to be told.
    renderAt('/patient/assessments/asq')
    deliver('patient-012', 'hub', 'Ana Ruiz')
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeDefined()
  })

  it('does not interrupt other work to follow its OWN patient', () => {
    renderAt('/guide/measures')
    deliver('patient-011', 'hub')
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('a BroadcastChannel event — another tab of this app', () => {
  it('is ignored under SMART, which is the rule that did NOT change', () => {
    // A simulation must never override the system of record.
    smart.patient = { id: 'patient-011', name: 'Maria Alvarez' }
    renderAt('/patient/chart')
    deliver('patient-012', 'broadcast', 'Ana Ruiz')
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('is followed when standalone and on a chart route', () => {
    renderAt('/patient/chart')
    deliver('patient-012', 'broadcast', 'Ana Ruiz')
    expect(navigate).toHaveBeenCalledWith('/patient/chart/patient-012')
    expect(screen.getByRole('status').textContent).toContain('simulated')
  })

  it('is ignored off a chart route, so it never interrupts other work', () => {
    renderAt('/guide/rubric')
    deliver('patient-012', 'broadcast')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not re-navigate to the chart already open', () => {
    renderAt('/patient/chart/patient-012')
    deliver('patient-012', 'broadcast')
    expect(navigate).not.toHaveBeenCalled()
  })
})
