/**
 * Per-patient alerts for the Population view (deck panel 8, issue #278).
 *
 * ─── Where these come from, and where they deliberately do not ───
 *
 * The dashboard deck specifies eight named alert rules. Only ONE of them
 * ("Safety Plan missing") is computable today, so this module does NOT try to
 * reproduce that list — a panel that showed six rules permanently reading zero
 * would assert a clean caseload it has no evidence for, which is the failure
 * mode `measureGaps.ts` was written to avoid one layer up.
 *
 * What it does instead: **transposes the Stage-8 measure engine.**
 * `evaluateAllMeasures` already computes, per patient and per measure group,
 * whether that patient landed in the denominator and whether they met the
 * numerator. A patient who is `inDenominator && !inNumerator` is a patient who
 * was eligible for something and did not get it — which is exactly an alert.
 * `MeasureDashboard` renders those same evaluations aggregated by measure; this
 * renders them grouped by patient.
 *
 * The consequence worth stating: every alert here is traceable to a published
 * `Measure`, so none of them can drift from what Stage 8 reports, and a measure
 * added in FSH shows up here for free. The cost is that alerts SPiER has no
 * measure for do not appear at all. `UNAVAILABLE_RULES` names those explicitly
 * so the panel can say what it is not watching rather than implying it watches
 * everything.
 *
 * ⚠️ Do not add a hand-rolled rule engine beside this. If a new alert is
 * wanted, the question to answer first is "what measure asserts it" — that is
 * what keeps the population view and the measure dashboard from disagreeing
 * about the same patient.
 */
import type { MeasureEvaluation } from './measures'
import type { DerivedRegistryRow } from './registry'

export type AlertSeverity = 'red' | 'yellow'

export interface PopulationAlert {
  patientId: string
  patientName: string
  severity: AlertSeverity
  /** What is wrong, as a short phrase. */
  label: string
  /** One sentence of why, safe to show a clinician. */
  detail: string
  /**
   * The measure group this was derived from, or null when it comes from the
   * registry row itself. Rendered as provenance — an alert with no traceable
   * source is an alert nobody can audit.
   */
  source: { measureId: string; groupCode: string } | null
}

/** How a failed measure group presents. Keyed `${measureId}/${groupCode}`. */
const GROUP_ALERTS: Record<
  string,
  { severity: AlertSeverity; label: string; detail: string }
> = {
  'SPiERSafetyPlanBeforeDischarge/safety-plan-completed': {
    severity: 'red',
    label: 'Safety plan missing at transition',
    detail:
      'A care transition is documented, but no active Stanley-Brown or Crisis Response Plan existed on or before it.',
  },
  'SPiERSafetyPlanBeforeDischarge/patient-copy-documented': {
    severity: 'yellow',
    label: 'Patient has no copy of the safety plan',
    detail:
      'A safety plan exists, but no discharge packet records that the patient left with their own copy.',
  },
  'SPiERRiskStatusDocumented/risk-status-documented': {
    severity: 'red',
    label: 'No coded risk level in the episode',
    detail:
      'The suicide-safer care episode is open with no risk-concept Observation dated inside it, so the current tier is not discrete data.',
  },
  'SPiERLethalMeansCounselingCompleted/lethal-means-counseling': {
    severity: 'yellow',
    label: 'Lethal means counseling not recorded',
    detail:
      'No completed means-safety counseling Procedure is documented during the episode.',
  },
  'SPiERFollowUpTimeliness/outreach-within-48-hours': {
    severity: 'red',
    label: 'No outreach within 48 hours of transition',
    detail: 'No outreach attempt is recorded in the 48 hours after the care transition.',
  },
  'SPiERFollowUpTimeliness/follow-up-within-7-days': {
    severity: 'yellow',
    label: 'No follow-up visit within 7 days',
    detail: 'No follow-up appointment was attended in the 7 days after the care transition.',
  },
  'SPiERFollowUpTimeliness/follow-up-within-30-days': {
    severity: 'red',
    label: 'No follow-up visit within 30 days',
    detail: 'No follow-up appointment was attended in the 30 days after the care transition.',
  },
  'SPiERCaringContactAdherence/caring-contact-within-30-days': {
    severity: 'yellow',
    label: 'No caring contact sent',
    detail:
      'No caring contact was sent within 30 days of the transition, and the patient has not opted out.',
  },
  'SPiERReferralCompletion/referral-completion': {
    severity: 'yellow',
    label: 'Referral loop not closed',
    detail: 'A suicide-safety referral was made and has not been recorded as completed.',
  },
  'SPiERReassessmentOnTime/reassessment-on-time': {
    severity: 'yellow',
    // Distinct from the row-derived "Reassessment overdue by N days" alert below,
    // and both can be true. This one is historical — the LAST reassessment was
    // late — while the row-derived one is about the NEXT one being overdue now. A
    // patient can have caught up (this fires, that does not) or be currently
    // adrift after an on-time history (that fires, this does not).
    label: 'Last reassessment was late',
    detail:
      'The most recent gap between risk assessments was longer than the cadence published for the tier the patient was in at the time.',
  },
  'SPiERScreenToAssessment/screen-to-assessment': {
    severity: 'red',
    label: 'Positive screen not clarified within 24 hours',
    detail:
      'A positive suicide-risk screen has no clarifying assessment recorded within 24 hours.',
  },
}

/**
 * Deck rules with no measure behind them, and what each waits on. Rendered by
 * the panel so "4 alerts" cannot be misread as "everything else is fine".
 */
export const UNAVAILABLE_RULES: Array<{ rule: string; waitingOn: string }> = [
  { rule: 'Safety plan due for review', waitingOn: 'a safety-plan review interval, which the deck does not state' },
  { rule: 'Psychiatric consultation overdue', waitingOn: 'the care-team role model (phase 4)' },
  { rule: 'PCP review overdue', waitingOn: 'the care-team role model (phase 4)' },
  { rule: 'Missing emergency contact', waitingOn: 'an emergency-contact consent artifact' },
]

/**
 * Groups whose failure is implied by another group's failure, and so must not
 * be reported twice. Key is suppressed when value is also failing.
 *
 * Both entries are clinical, not cosmetic:
 *  - You cannot hand a patient a copy of a safety plan that was never written,
 *    so "no patient copy" alongside "no safety plan" describes one failure.
 *  - The follow-up windows nest: a patient with no visit inside 30 days also
 *    has none inside 7. Reporting both inflates the count and buries the worse
 *    breach behind the milder one.
 */
const IMPLIED_BY: Record<string, string> = {
  'SPiERSafetyPlanBeforeDischarge/patient-copy-documented':
    'SPiERSafetyPlanBeforeDischarge/safety-plan-completed',
  'SPiERFollowUpTimeliness/follow-up-within-7-days':
    'SPiERFollowUpTimeliness/follow-up-within-30-days',
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { red: 0, yellow: 1 }

/**
 * Alerts for one patient, from their measure evaluations plus their registry row.
 *
 * `evaluations` is the output of `evaluateAllMeasures` for this patient over
 * whatever measurement period the caller chose — the period is the caller's
 * decision because "alerts in the last 30 days" and "alerts ever" are both
 * legitimate readings and the view exposes the choice.
 */
export function alertsForPatient(
  row: DerivedRegistryRow,
  evaluations: MeasureEvaluation[],
): PopulationAlert[] {
  const failing = new Set<string>()
  for (const ev of evaluations) {
    for (const g of ev.groups) {
      if (g.inDenominator && !g.inNumerator) failing.add(`${ev.measureId}/${g.code}`)
    }
  }

  const alerts: PopulationAlert[] = []
  for (const key of failing) {
    const implied = IMPLIED_BY[key]
    if (implied && failing.has(implied)) continue
    const spec = GROUP_ALERTS[key]
    // No copy for a measure group means a Measure was added in FSH without a
    // matching entry here. populationAlerts.test.ts fails in that case rather
    // than letting the panel silently drop a real failure.
    if (!spec) continue
    const [measureId, groupCode] = key.split('/')
    alerts.push({
      patientId: row.id,
      patientName: row.displayName,
      severity: spec.severity,
      label: spec.label,
      detail: spec.detail,
      source: { measureId, groupCode },
    })
  }

  // Row-derived alerts. These are not measure failures — they are workflow
  // state the registry already tracks, and they carry source: null to say so.
  if (row.overdueTaskCount > 0) {
    alerts.push({
      patientId: row.id,
      patientName: row.displayName,
      severity: 'red',
      label: `${row.overdueTaskCount} overdue task${row.overdueTaskCount === 1 ? '' : 's'}`,
      detail: 'An open safety task on this episode is past its due date.',
      source: null,
    })
  }
  // Reassessment cadence (#279). Both of these were UNAVAILABLE_RULES until the
  // interval rule existed; they are row-derived rather than measure-derived
  // because "due in two days" is not a thing a measure can express — a measure
  // scores what already happened.
  if (row.reassessment.kind === 'scheduled') {
    if (row.reassessment.status === 'overdue') {
      const late = Math.abs(row.reassessment.daysUntilDue)
      alerts.push({
        patientId: row.id,
        patientName: row.displayName,
        severity: 'red',
        label: `Reassessment overdue by ${late} day${late === 1 ? '' : 's'}`,
        detail: `Due ${row.reassessment.dueDate} on the ${row.reassessment.intervalDays}-day cadence published for this risk tier.`,
        source: null,
      })
    } else if (row.reassessment.status === 'due-today' || row.reassessment.status === 'due-soon') {
      alerts.push({
        patientId: row.id,
        patientName: row.displayName,
        severity: 'yellow',
        label:
          row.reassessment.status === 'due-today'
            ? 'Reassessment due today'
            : `Reassessment due in ${row.reassessment.daysUntilDue} day${row.reassessment.daysUntilDue === 1 ? '' : 's'}`,
        detail: `Due ${row.reassessment.dueDate} on the ${row.reassessment.intervalDays}-day cadence published for this risk tier.`,
        source: null,
      })
    }
  }

  if (row.awaitingNoShowFollowUp) {
    alerts.push({
      patientId: row.id,
      patientName: row.displayName,
      severity: 'yellow',
      label: 'No-show — outreach due',
      detail: 'The most recent appointment was a no-show and no outreach has been recorded since.',
      source: null,
    })
  }

  return alerts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.label.localeCompare(b.label),
  )
}

export interface PatientAlertGroup {
  patientId: string
  patientName: string
  alerts: PopulationAlert[]
  /** Worst severity present — drives the group's badge. */
  severity: AlertSeverity
}

/**
 * Group alerts by patient, worst-first. Patients with no alerts are omitted
 * entirely rather than listed as clean: the panel is a worklist, and an empty
 * row for every healthy patient would bury the four that need attention.
 */
export function groupAlertsByPatient(alerts: PopulationAlert[]): PatientAlertGroup[] {
  const byPatient = new Map<string, PopulationAlert[]>()
  for (const a of alerts) {
    const list = byPatient.get(a.patientId)
    if (list) list.push(a)
    else byPatient.set(a.patientId, [a])
  }
  return [...byPatient.values()]
    .map(list => ({
      patientId: list[0].patientId,
      patientName: list[0].patientName,
      alerts: list,
      severity: list.some(a => a.severity === 'red') ? ('red' as const) : ('yellow' as const),
    }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        b.alerts.length - a.alerts.length ||
        a.patientName.localeCompare(b.patientName),
    )
}

/** Every measure-group key this module has copy for — used by the drift test. */
export function coveredGroupKeys(): string[] {
  return Object.keys(GROUP_ALERTS).sort()
}
