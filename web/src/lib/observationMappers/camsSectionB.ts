import { walkItems, getCodingAnswer, getBooleanAnswer, type MapperResult, type RiskAlert } from './shared'

export function mapCAMSSectionB(response: any): MapperResult {
  const items = response?.item || []
  const observations: any[] = []

  // Extract identified drivers (Problem #1-3)
  const driverLinkIds = [
    { descLinkId: 'driver-1-desc', typeLinkId: 'driver-1-type', label: 'Driver #1' },
    { descLinkId: 'driver-2-desc', typeLinkId: 'driver-2-type', label: 'Driver #2' },
    { descLinkId: 'driver-3-desc', typeLinkId: 'driver-3-type', label: 'Driver #3' },
  ]

  const conditions: any[] = []

  for (const driver of driverLinkIds) {
    const descItem = walkItems(items, driver.descLinkId)
    const typeItem = walkItems(items, driver.typeLinkId)
    const description = descItem?.answer?.[0]?.valueString
    const driverType = getCodingAnswer(typeItem)

    if (description) {
      conditions.push({
        resourceType: 'Condition',
        id: `cams-driver-${Date.now()}-${driver.label.replace(/\s+/g, '-')}`,
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }],
        },
        category: [
          {
            coding: [
              {
                system: 'http://cams-care.com/driver-category',
                code: 'suicide-driver',
                display: 'Suicide Driver',
              },
            ],
          },
          ...(driverType ? [{
            coding: [{
              system: 'http://cams-care.com/driver-type',
              code: driverType.code,
              display: driverType.display,
            }],
          }] : []),
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
  observations.push(...conditions)

  // Check for ideation, plan, preparation
  const ideationPresent = getBooleanAnswer(walkItems(items, 'ideation-present'))
  const planPresent = getBooleanAnswer(walkItems(items, 'plan-present'))

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
