/**
 * @vitest-environment jsdom
 *
 * What the generated safety plan claims about where it went.
 *
 * ⚠️ **The claim was false in the one setting that matters** (clinical-app
 * audit §4.6, item 3). The panel read *"Nothing about this patient has been
 * sent anywhere or saved to any server"* on every render — including the render
 * that follows a Stanley-Brown submit against a connected EHR, which is the
 * exact moment `addCarePlan` has just written the plan to that server. A demo
 * caveat that is wrong during an evaluation is worse than no caveat, because
 * the one person reading it closely is the site deciding whether to trust the
 * write.
 *
 * So the claim is per session and is about where a completed plan GOES, not
 * about whether one particular write landed — that is the data source's to
 * report (`dataSourceError`, and the writeback scorecard on the chart).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { GeneratedCarePlan } from '@spier/core/lib/carePlanMappers'
import { CarePlanDisplay } from './CarePlanDisplay'
import { InspectContext } from '../context/InspectContext'
import { PatientContext, type PatientContextType } from '../context/PatientContext'

afterEach(cleanup)

const PLAN: GeneratedCarePlan = {
  isEmpty: false,
  resource: { resourceType: 'CarePlan', id: 'safety-plan-1' } as GeneratedCarePlan['resource'],
  activities: [
    {
      stepTitle: 'Warning signs',
      description: 'Racing thoughts at night.',
      sectionCode: { system: 'http://loinc.org', code: '96782-8' },
    },
  ],
}

function renderPlan(isSmartSession: boolean, inspect = false) {
  const patient = { isSmartSession } as unknown as PatientContextType
  return render(
    <PatientContext.Provider value={patient}>
      <InspectContext.Provider value={inspect}>
        <CarePlanDisplay carePlan={PLAN} />
      </InspectContext.Provider>
    </PatientContext.Provider>,
  )
}

const NOTHING_SENT = /sent anywhere/i

describe('what the safety plan says about where it went', () => {
  it('says nothing has been sent when nothing has', () => {
    renderPlan(false)
    expect(screen.getByText(NOTHING_SENT)).toBeTruthy()
    expect(screen.getByText(/Demo only/i)).toBeTruthy()
  })

  it('does NOT say that under a live session — audit §4.6 item 3', () => {
    renderPlan(true)
    expect(screen.queryByText(NOTHING_SENT)).toBeNull()
    expect(screen.getByText(/written to the\s+connected EHR/i)).toBeTruthy()
  })
})

describe('the concept id beside a step', () => {
  /**
   * ⚠️ Found while fixing the notice above, and it is §1.9's class: the chip
   * renders `LOINC: 96782-8` beside a safety-plan step, to a clinician, on a
   * surface where `useInspect()` is always false. `check:jargon`'s clinical
   * scan cannot see it — the code is a runtime value and the word beside it is
   * a bare system name with no digits after it — so it survived that sweep.
   */
  it('is not shown to a clinician', () => {
    const { container } = renderPlan(false)
    expect(container.querySelector('.careplan-step-code')).toBeNull()
    expect(container.textContent).not.toContain('96782-8')
  })

  it('is shown inside the Adoption Guide, where it is what the reader came for', () => {
    const { container } = renderPlan(false, true)
    expect(container.querySelector('.careplan-step-code')?.textContent).toContain('96782-8')
  })
})
