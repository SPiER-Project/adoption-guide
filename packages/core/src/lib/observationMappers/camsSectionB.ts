import { walkItems, getCodingAnswer, getYesNoBoolean, type MapperResult, type RiskAlert, type ObservationResource, type QuestionnaireResponseResource, type FhirResource } from './shared'
import { suicideRiskCategory } from '../conceptDomain'

export function mapCAMSSectionB(response: QuestionnaireResponseResource): MapperResult {
  const items = response?.item || []
  const observations: ObservationResource[] = []

  // Extract identified drivers (Problem #1-3)
  // `slug` exists because `label` cannot be one. The id used to be built as
  // `label.replace(/\s+/g, '-')`, which leaves the `#` — and `#` is not a legal
  // FHIR id character, so EVERY Condition this mapper has ever produced carried
  // an invalid id. The validator said so the first time one was emitted under a
  // profile claim (2026-09-17); before that the resource was checked by nothing.
  const driverLinkIds = [
    { descLinkId: 'driver-1-desc', typeLinkId: 'driver-1-type', label: 'Driver #1', slug: 'driver-1' },
    { descLinkId: 'driver-2-desc', typeLinkId: 'driver-2-type', label: 'Driver #2', slug: 'driver-2' },
    { descLinkId: 'driver-3-desc', typeLinkId: 'driver-3-type', label: 'Driver #3', slug: 'driver-3' },
  ]

  const conditions: FhirResource[] = []

  for (const driver of driverLinkIds) {
    const descItem = walkItems(items, driver.descLinkId)
    const typeItem = walkItems(items, driver.typeLinkId)
    const description = descItem?.answer?.[0]?.valueString
    const driverType = getCodingAnswer(typeItem)

    if (description) {
      conditions.push({
        resourceType: 'Condition',
        id: `cams-driver-${Date.now()}-${driver.slug}`,
        // The one non-Observation an instrument mapper produces, and the reason
        // this is a hand-built literal rather than a `makeObservation` call.
        // ⚠️ Claimed since 2026-09-17. Nothing had ever validated this resource:
        // it claimed no profile, and no fixture ran this mapper — which is how
        // the missing required category three lines below survived #302.
        meta: { profile: ['http://thespierproject.org/fhir/StructureDefinition/spier-cams-suicide-driver'] },
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
        },
        // Both categories are SPiER-local and canonical (#265). The demo used to
        // emit http://cams-care.com/… here — a vendor marketing-site URL that is
        // not a resolvable terminology server, and which disagreed with the IG
        // this app is meant to demonstrate. `ig/` is canonical for CodeSystems;
        // see SPiERCAMSSuicideDriver in ig/input/fsh/cams.fsh, where each of
        // these is now a named, bound slice on Condition.category.
        category: [
          {
            coding: [
              {
                system: 'http://thespierproject.org/fhir/CodeSystem/cams-driver-category',
                code: 'suicide-driver',
                display: 'Suicide Driver',
              },
            ],
          },
          ...(driverType ? [{
            coding: [{
              system: 'http://thespierproject.org/fhir/CodeSystem/cams-driver-type',
              code: driverType.code,
              display: driverType.display,
            }],
          }] : []),
          // ⚠️ REQUIRED 1..1 by SPiERCAMSSuicideDriver, and missing until
          // 2026-09-17. #271 made the concept-domain slice required on ~28
          // profiles and #302 fixed the runtime builders that had never written
          // it — but this one was missed, and could not be caught: the resource
          // claimed no profile, and a resource that claims nothing validates
          // against nothing. Adding the profile claim above without this line
          // would have turned a silent gap into a red validator.
          suicideRiskCategory(),
        ],
        code: { text: description },
        subject: { reference: 'Patient/demo-patient' },
        note: [
          { text: `${driver.label}: ${description}. Type: ${driverType?.display || 'Not classified'}. Identified during CAMS SSF-5 Section B assessment. Track on problem list until resolved.` },
        ],
      })
    }
  }

  // Store conditions as observations (they're really Conditions but we store them together for the demo)
  observations.push(...(conditions as ObservationResource[]))

  // Check for ideation, plan, preparation
  const ideationPresent = getYesNoBoolean(walkItems(items, 'ideation-present'))
  const planPresent = getYesNoBoolean(walkItems(items, 'plan-present'))

  const driverCount = conditions.length

  const riskAlert: RiskAlert = planPresent
    ? {
        tool: 'CAMS Section B',
        level: 'high',
        summary: `CAMS: Suicidal plan identified, ${driverCount} driver(s)`,
        detail: `Clinician assessment indicates presence of suicidal plan. ${driverCount} suicide driver(s) identified for problem list. Immediate stabilization planning recommended.`,
        suggestedAction: { label: 'Start Stabilization Plan', path: '/patient/assessments/cams-stabilization-plan' },
      }
    : ideationPresent
    ? {
        tool: 'CAMS Section B',
        level: 'moderate',
        summary: `CAMS: Ideation present, ${driverCount} driver(s)`,
        detail: `Clinician assessment indicates suicidal ideation without specific plan. ${driverCount} suicide driver(s) identified. Continue CAMS framework with driver-focused treatment.`,
        suggestedAction: { label: 'Start Stabilization Plan', path: '/patient/assessments/cams-stabilization-plan' },
      }
    : {
        tool: 'CAMS Section B',
        level: driverCount > 0 ? 'low' : 'none',
        summary: `CAMS: ${driverCount} driver(s) identified, no active ideation/plan`,
        detail: `No active suicidal ideation or plan reported. ${driverCount} driver(s) identified for monitoring.`,
      }

  return { observations, riskAlert }
}
