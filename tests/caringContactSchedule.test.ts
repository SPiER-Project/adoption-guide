import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CARING_CONTACT_SCHEDULE, caringContactState } from '@spier/core/lib/caringContactSchedule'
import {
  CARE_TRANSITION_PROFILES,
  CARING_CONTACT_WINDOW_DAYS,
  MEASURE_SPECS,
  evaluateMeasure,
  type MeasurementPeriod,
} from '@spier/core/lib/measures'
import { CARING_CONTACT_PROFILE } from '@spier/core/lib/followUp'
import type { CommunicationResource, PatientSlice } from '@spier/core/types/fhir'

/**
 * The caring-contact schedule and the caring-contact adherence measure, held
 * to one another (#628).
 *
 * The schedule says when a contact is due; the measure says whether the site
 * sent one. They are separate artifacts and nothing published ties them, so a
 * schedule that closed its last window on day 35 would let the app call a
 * patient on schedule whom the measure counts as a miss. Three ways that
 * could happen, one test each, and then the property itself, run.
 */
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const T = Date.parse('2026-08-01T12:00:00Z')
const PERIOD: MeasurementPeriod = { start: '2026-01-01T00:00:00.000Z', end: '2026-12-31T23:59:59.999Z' }
const ADHERENCE = MEASURE_SPECS.find(m => m.id === 'SPiERCaringContactAdherence')

const handoff = {
  resourceType: 'Communication',
  status: 'completed',
  meta: { profile: [CARE_TRANSITION_PROFILES.communication] },
  sent: new Date(T).toISOString(),
} as CommunicationResource

const contactAt = (offset: number) =>
  ({
    resourceType: 'Communication',
    status: 'completed',
    meta: { profile: [CARING_CONTACT_PROFILE] },
    sent: new Date(T + offset).toISOString(),
  }) as CommunicationResource

describe('the caring-contact schedule agrees with the adherence measure', () => {
  it('counts a series from the same records the measures index a transition on', () => {
    expect([...CARING_CONTACT_SCHEDULE.transitionProfiles].sort()).toEqual(
      Object.values(CARE_TRANSITION_PROFILES).sort(),
    )
  })

  it('closes every window inside the measure’s window', () => {
    expect(CARING_CONTACT_SCHEDULE.slots.length).toBeGreaterThan(0)
    for (const slot of CARING_CONTACT_SCHEDULE.slots) {
      expect(slot.byHours, `${slot.id} closes after the measure stops counting`).toBeLessThanOrEqual(
        CARING_CONTACT_WINDOW_DAYS * 24,
      )
    }
  })

  it('reads the measure’s window from the same number the CQL states', () => {
    // The CQL is the published definition; measures.ts is the app's copy of it.
    const cql = readFileSync(resolve(__dirname, '../ig/input/cql/SPiERSuicideSaferCareMeasures.cql'), 'utf8')
    const define = cql.slice(cql.indexOf('define "Caring Contact Within 30 Days"'))
    const days = /"Index Transition Date"\s*\+\s*(\d+)\s*days/.exec(define)?.[1]
    expect(Number(days)).toBe(CARING_CONTACT_WINDOW_DAYS)
  })

  it('never calls a patient sent a contact whom the measure counts as a miss — run, over every offset', () => {
    expect(ADHERENCE).toBeDefined()
    // A contact every 12 hours from the transition to day 40: inside, on and
    // past each window's edge.
    for (let offset = 0; offset <= 40 * DAY; offset += 12 * HOUR) {
      const slice = { communications: [handoff, contactAt(offset)] } as PatientSlice
      const state = caringContactState(slice, new Date(T + 41 * DAY))
      const counted = state.kind === 'complete' && state.sent > 0
      const group = evaluateMeasure(ADHERENCE!, slice, PERIOD).groups[0]
      expect(group.inNumerator, `contact at +${offset / HOUR}h`).toBe(counted)
    }
  })
})
