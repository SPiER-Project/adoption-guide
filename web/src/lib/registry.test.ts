import { describe, it, expect } from 'vitest'
import { deriveRegistryRow, type RegistryPatient } from './registry'
import type { PatientSlice, StoredResponse, ObservationResource, CarePlanResource, CommunicationResource } from '../types/fhir'
import type { RiskAlert } from './observationMappers'

describe('deriveRegistryRow', () => {
  const patient: RegistryPatient = {
    id: 'p1',
    displayName: 'Test Patient',
    dob: '1980-01-01',
    mrn: '12345',
    gender: 'other',
    recommendedNextStep: { stageId: 'triage', label: 'Triage', rationale: 'Because.' }
  }

  const emptySlice: PatientSlice = {
    responses: [],
    observations: [],
    carePlans: [],
    riskAlerts: [],
    communications: []
  }

  it('handles empty slice', () => {
    const row = deriveRegistryRow(patient, emptySlice)

    // Patient demographic fields are passed through
    expect(row.id).toBe(patient.id)
    expect(row.displayName).toBe(patient.displayName)
    expect(row.dob).toBe(patient.dob)
    expect(row.mrn).toBe(patient.mrn)
    expect(row.gender).toBe(patient.gender)
    expect(row.recommendedNextStep).toBe(patient.recommendedNextStep)

    // Derived fields with no data
    expect(row.lastActivity).toBeNull()
    expect(row.currentRiskLevel).toBe('none')

    // derivePathwayStatus with no artifacts should mean the pathway is not started, so first stage active
    // We expect currentStage to be defined (typically the first stage if empty)
    expect(row.currentStage).toBeTruthy()
    expect(row.completedStages).toEqual([])
  })

  it('derives lastActivity from multiple candidates, picking the newest date', () => {
    const oldObservation: ObservationResource = {
      resourceType: 'Observation',
      id: 'obs1',
      effectiveDateTime: '2023-01-01T10:00:00Z',
      code: { text: 'Old Observation' }
    }

    const newerCarePlan: CarePlanResource = {
      resourceType: 'CarePlan',
      id: 'cp1',
      authored: '2023-01-02T10:00:00Z', // intentionally newer than the observation
      title: 'Newer Care Plan'
    }

    const newestCommunication: CommunicationResource = {
      resourceType: 'Communication',
      id: 'comm1',
      sent: '2023-01-03T10:00:00Z', // newest
      reasonCode: [{ text: 'Follow-up Call' }]
    }

    const slice: PatientSlice = {
      ...emptySlice,
      observations: [oldObservation],
      carePlans: [newerCarePlan],
      communications: [newestCommunication]
    }

    const row = deriveRegistryRow(patient, slice)

    expect(row.lastActivity).toEqual({
      date: '2023-01-03T10:00:00Z',
      label: 'Follow-up Call'
    })
  })

  it('prioritizes QuestionnaireResponse over derived Observation for lastActivity', () => {
    // A StoredResponse
    const response: StoredResponse = {
      id: 'qr1', // the FHIR ID would be qr1
      questionnaireName: 'Suicide Screen',
      completedAt: '2023-01-02T12:00:00Z',
      resource: { resourceType: 'QuestionnaireResponse', id: 'qr1' }
    }

    // An observation that says it's derived from the response
    const derivedObservation: ObservationResource = {
      resourceType: 'Observation',
      id: 'obs1',
      effectiveDateTime: '2023-01-02T12:00:01Z', // Technically 1 second newer
      code: { text: 'Screening Result Observation' },
      derivedFrom: [{ reference: 'QuestionnaireResponse/qr1' }]
    }

    // A careplan that is older than both
    const olderCarePlan: CarePlanResource = {
      resourceType: 'CarePlan',
      id: 'cp1',
      authored: '2023-01-01T10:00:00Z',
      title: 'Older Care Plan'
    }

    const slice: PatientSlice = {
      ...emptySlice,
      responses: [response],
      observations: [derivedObservation],
      carePlans: [olderCarePlan]
    }

    const row = deriveRegistryRow(patient, slice)

    // The derived observation should be ignored. The next newest is the response itself.
    expect(row.lastActivity).toEqual({
      date: '2023-01-02T12:00:00Z',
      label: 'Suicide Screen'
    })
  })

  it('determines the highest risk level from riskAlerts', () => {
    const lowRisk: RiskAlert = { tool: 'ASQ', level: 'low', summary: 'Some reason', detail: 'Some detail' }
    const moderateRisk: RiskAlert = { tool: 'PHQ-9', level: 'moderate', summary: 'Some other reason', detail: 'Some detail' }

    const slice: PatientSlice = {
      ...emptySlice,
      riskAlerts: [lowRisk, moderateRisk]
    }

    const row = deriveRegistryRow(patient, slice)

    // highestRiskLevel is expected to return 'moderate' given 'low' and 'moderate'
    expect(row.currentRiskLevel).toBe('moderate')
  })

  it('handles various label derivations for communications and observations', () => {
    const commNoReason: CommunicationResource = {
      resourceType: 'Communication',
      sent: '2023-01-01T10:00:00Z',
      category: [{ text: 'Category Text' }]
    }
    const row1 = deriveRegistryRow(patient, { ...emptySlice, communications: [commNoReason] })
    expect(row1.lastActivity?.label).toBe('Category Text')

    const commNoTextCode: CommunicationResource = {
      resourceType: 'Communication',
      sent: '2023-01-01T10:00:00Z',
      category: [{ coding: [{ display: 'Coding Display' }] }]
    }
    const row2 = deriveRegistryRow(patient, { ...emptySlice, communications: [commNoTextCode] })
    expect(row2.lastActivity?.label).toBe('Coding Display')

    const obsNoTextCode: ObservationResource = {
      resourceType: 'Observation',
      effectiveDateTime: '2023-01-01T10:00:00Z',
      code: { coding: [{ display: 'Observation Coding' }] }
    }
    const row3 = deriveRegistryRow(patient, { ...emptySlice, observations: [obsNoTextCode] })
    expect(row3.lastActivity?.label).toBe('Observation Coding')
  })

  it('handles missing communications array (undefined)', () => {
    const sliceWithUndefinedComms = { ...emptySlice }
    delete sliceWithUndefinedComms.communications

    const cp: CarePlanResource = {
      resourceType: 'CarePlan',
      id: 'stanley-brown-1', // careplanLabel falls back to this specific title
      authored: '2023-01-01T10:00:00Z'
    }

    const row = deriveRegistryRow(patient, { ...sliceWithUndefinedComms, carePlans: [cp] } as PatientSlice)

    expect(row.lastActivity).toEqual({
      date: '2023-01-01T10:00:00Z',
      label: 'Stanley-Brown Safety Plan'
    })
  })
})
