/**
 * CAMS drivers resolved at the Outcome/Disposition session.
 *
 * CAMS Section B records up to three suicide drivers, each a problem-list
 * Condition the published `SPiERCAMSSuicideDriver` profile says is tracked
 * "until resolved at CAMS disposition". Nothing resolved one: a driver, once
 * recorded, read as active forever. This is the other half: when an
 * Outcome/Disposition form is saved with disposition **`resolved`**, every
 * ACTIVE CAMS driver on the chart becomes `clinicalStatus = resolved`, with
 * `abatementDateTime` set to the form's completion.
 *
 * ⚠️ **NOT CLINICALLY REVIEWED. A clinician must review this rule before it is
 * made available externally** — see docs/decisions/cams-driver-resolution.md,
 * which holds the rule, the open questions, and the condition. It was merged
 * live by decision (2026-10-12), so the hosted demo applies it in the
 * meantime; that does not make it reviewed.
 *
 * The open questions, in short (the decision record has them in full):
 *  - **All drivers at once.** The form records resolution for the whole CAMS
 *    episode ("resolution criteria met") and asks nothing per driver, so every
 *    active driver is resolved together. A clinician may judge a driver still
 *    live at an episode's resolution.
 *  - **Only `resolved`.** `continue-cams`, `refer-adjunctive` and
 *    `higher-level-care` leave the drivers active. Whether a step-up or an
 *    adjunctive referral should change a driver's status is not decided here.
 *  - **The app, not the clinician, writes the status change.** It follows from
 *    a clinician's disposition, which is why it is not an inference of the kind
 *    #639 retired — but no clinician confirms each driver.
 *
 * Pure: it builds the updated Conditions and writes nothing. The save hook in
 * `packages/app-shell` decides when to call it and persists the result.
 */
import { CAMS_DISPOSITION_SYSTEM } from '@spier/fhir-artifacts/generated/disposition-codes.generated'
import { CAMS_DRIVER_CATEGORY } from './observationMappers/camsSectionB'
import type { ConditionResource, ObservationResource } from '../types/fhir'

interface Coding { system?: string; code?: string; display?: string }
interface CodeableConcept { coding?: Coding[]; text?: string }

const CONDITION_CLINICAL = 'http://terminology.hl7.org/CodeSystem/condition-clinical'

/** The note a resolved driver carries — what changed it and that it is unreviewed. */
export const DRIVER_RESOLVED_NOTE =
  'Marked resolved when the CAMS Outcome/Disposition session recorded the episode as resolved. ' +
  'This status change is applied automatically and has not been clinically reviewed.'

/** Whether a disposition form's derived Observations record a `resolved` disposition. */
export function camsDispositionResolved(observations: readonly ObservationResource[]): boolean {
  return observations.some((o) => {
    const value = (o as { valueCodeableConcept?: CodeableConcept }).valueCodeableConcept
    return value?.coding?.some(c => c.system === CAMS_DISPOSITION_SYSTEM && c.code === 'resolved') ?? false
  })
}

/** A CAMS driver: a Condition carrying the driver marker category. */
export function isCamsDriver(condition: ConditionResource): boolean {
  const categories = (condition as { category?: CodeableConcept[] }).category ?? []
  return categories.some(c =>
    c.coding?.some(cd => cd.system === CAMS_DRIVER_CATEGORY.system && cd.code === CAMS_DRIVER_CATEGORY.code),
  )
}

function clinicalStatusOf(condition: ConditionResource): string | undefined {
  return (condition as { clinicalStatus?: CodeableConcept }).clinicalStatus?.coding?.[0]?.code
}

/**
 * The active CAMS drivers among `conditions`, each marked resolved at
 * `resolvedAt`. Anything that is not an active CAMS driver — another problem on
 * the EHR's list, or a driver already resolved — is left out, so the caller
 * writes only what changed.
 */
export function resolveCamsDrivers(
  conditions: readonly ConditionResource[],
  resolvedAt: string,
): ConditionResource[] {
  return conditions
    .filter(c => isCamsDriver(c) && clinicalStatusOf(c) === 'active')
    .map((c) => {
      const notes = ((c as { note?: { text: string }[] }).note ?? [])
      return {
        ...c,
        clinicalStatus: {
          coding: [{ system: CONDITION_CLINICAL, code: 'resolved', display: 'Resolved' }],
        },
        abatementDateTime: resolvedAt,
        note: [...notes, { text: DRIVER_RESOLVED_NOTE }],
      }
    })
}
