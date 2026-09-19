import { describe, expect, it } from 'vitest'
import { MEASURE_SPECS, type MeasureEvaluation } from '@spier/core/lib/measures'
import {
  alertsForPatient,
  coveredGroupKeys,
  groupAlertsByPatient,
  type PopulationAlert,
} from './populationAlerts'
import type { DerivedRegistryRow } from '@spier/core/lib/registry'

function row(over: Partial<DerivedRegistryRow> = {}): DerivedRegistryRow {
  return {
    id: 'patient-001',
    displayName: 'Jane Doe',
    dob: '1990-01-15',
    mrn: '1',
    gender: 'Female',
    recommendedNextStep: { stageId: 's', label: 'l', rationale: 'r' },
    currentStage: null,
    completedStages: [],
    currentRiskLevel: 'moderate',
    lastActivity: null,
    episodeOpen: true,
    episodeTier: null,
    openTaskCount: 0,
    overdueTaskCount: 0,
    nextTaskDue: null,
    nextAppointment: null,
    noShowCount: 0,
    awaitingNoShowFollowUp: false,
    unreachedStreak: 0,
    openReferralCount: 0,
    lastAssessment: null,
    // A row fixture must carry every field, so the cast below is gone: an added
    // DerivedRegistryRow field should fail the typecheck here, not blow up at
    // runtime the way `as DerivedRegistryRow` let it.
    reassessment: { kind: 'no-cadence', reason: 'test fixture' },
    ...over,
  }
}

/** One evaluation with a single group at the given membership. */
function evalOf(
  measureId: string,
  code: string,
  inDenominator: boolean,
  inNumerator: boolean,
): MeasureEvaluation {
  return {
    measureId,
    measureUrl: `http://thespierproject.org/fhir/Measure/${measureId}`,
    title: measureId,
    groups: [{ code, display: code, populations: {}, inDenominator, inNumerator, removedByException: false }],
  }
}

describe('alertsForPatient', () => {
  it('raises an alert for a failed measure group and carries its provenance', () => {
    const alerts = alertsForPatient(row(), [
      evalOf('SPiERSafetyPlanBeforeDischarge', 'safety-plan-completed', true, false),
    ])
    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe('red')
    expect(alerts[0].source).toEqual({
      measureId: 'SPiERSafetyPlanBeforeDischarge',
      groupCode: 'safety-plan-completed',
    })
  })

  it('stays silent when the patient met the numerator', () => {
    expect(
      alertsForPatient(row(), [
        evalOf('SPiERSafetyPlanBeforeDischarge', 'safety-plan-completed', true, true),
      ]),
    ).toEqual([])
  })

  it('stays silent when the patient is not in the denominator at all', () => {
    // Not eligible is not the same as failing. A measure whose cohort excludes
    // this patient must not produce an alert about them.
    expect(
      alertsForPatient(row(), [
        evalOf('SPiERSafetyPlanBeforeDischarge', 'safety-plan-completed', false, false),
      ]),
    ).toEqual([])
  })

  it('suppresses "no patient copy" when the safety plan itself is missing', () => {
    // You cannot hand over a copy of a plan that was never written — reporting
    // both describes one failure twice.
    const alerts = alertsForPatient(row(), [
      evalOf('SPiERSafetyPlanBeforeDischarge', 'safety-plan-completed', true, false),
      evalOf('SPiERSafetyPlanBeforeDischarge', 'patient-copy-documented', true, false),
    ])
    expect(alerts.map(a => a.source?.groupCode)).toEqual(['safety-plan-completed'])
  })

  it('reports the patient-copy gap on its own when the plan does exist', () => {
    const alerts = alertsForPatient(row(), [
      evalOf('SPiERSafetyPlanBeforeDischarge', 'safety-plan-completed', true, true),
      evalOf('SPiERSafetyPlanBeforeDischarge', 'patient-copy-documented', true, false),
    ])
    expect(alerts.map(a => a.source?.groupCode)).toEqual(['patient-copy-documented'])
  })

  it('collapses the nested follow-up windows to the worse breach', () => {
    // 7-day and 30-day nest: no visit in 30 days means none in 7 either.
    const alerts = alertsForPatient(row(), [
      evalOf('SPiERFollowUpTimeliness', 'follow-up-within-7-days', true, false),
      evalOf('SPiERFollowUpTimeliness', 'follow-up-within-30-days', true, false),
    ])
    expect(alerts.map(a => a.source?.groupCode)).toEqual(['follow-up-within-30-days'])
    expect(alerts[0].severity).toBe('red')
  })

  it('keeps the 7-day breach when the 30-day window was met', () => {
    const alerts = alertsForPatient(row(), [
      evalOf('SPiERFollowUpTimeliness', 'follow-up-within-7-days', true, false),
      evalOf('SPiERFollowUpTimeliness', 'follow-up-within-30-days', true, true),
    ])
    expect(alerts.map(a => a.source?.groupCode)).toEqual(['follow-up-within-7-days'])
    expect(alerts[0].severity).toBe('yellow')
  })

  it('adds row-derived alerts with no measure source', () => {
    const alerts = alertsForPatient(row({ overdueTaskCount: 2, awaitingNoShowFollowUp: true }), [])
    expect(alerts.map(a => a.source)).toEqual([null, null])
    expect(alerts.find(a => a.severity === 'red')?.label).toBe('2 overdue tasks')
  })

  it('sorts red before yellow', () => {
    const alerts = alertsForPatient(row({ overdueTaskCount: 1 }), [
      evalOf('SPiERLethalMeansCounselingCompleted', 'lethal-means-counseling', true, false),
    ])
    expect(alerts.map(a => a.severity)).toEqual(['red', 'yellow'])
  })
})

describe('groupAlertsByPatient', () => {
  const mk = (patientId: string, patientName: string, severity: 'red' | 'yellow'): PopulationAlert => ({
    patientId,
    patientName,
    severity,
    label: `${patientId}-${severity}`,
    detail: 'd',
    source: null,
  })

  it('groups by patient and puts any red group ahead of yellow-only ones', () => {
    const groups = groupAlertsByPatient([
      mk('p2', 'B', 'yellow'),
      mk('p2', 'B', 'yellow'),
      mk('p2', 'B', 'yellow'),
      mk('p1', 'A', 'red'),
    ])
    // p1 has ONE alert and p2 has three, but p1 outranks it on severity — a
    // single urgent item must not sit below a pile of routine ones.
    expect(groups.map(g => g.patientId)).toEqual(['p1', 'p2'])
    expect(groups[0].severity).toBe('red')
    expect(groups[1].alerts).toHaveLength(3)
  })

  it('omits patients with no alerts entirely', () => {
    expect(groupAlertsByPatient([])).toEqual([])
  })
})

describe('measure coverage', () => {
  it('has copy for every group of every published measure', () => {
    // The population alerts panel must not silently drop a real failure because
    // a Measure was added in FSH without a label here. This is the same
    // both-directions contract measureGaps.test.ts holds for the dashboard.
    const published = MEASURE_SPECS.flatMap(spec =>
      spec.groups.map(g => `${spec.id}/${g.code}`),
    ).sort()
    expect(coveredGroupKeys()).toEqual(published)
  })
})
