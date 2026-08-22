import { describe, it, expect } from 'vitest'
import { deriveRegistryRow, type RegistryPatient } from '@spier/core/lib/registry'
import type {
  AppointmentResource,
  CarePlanResource,
  CommunicationResource,
  ConsentResource,
  ObservationResource,
  PatientSlice,
  ServiceRequestResource,
  StoredResponse,
} from '@spier/core/types/fhir'
import type { RiskAlert } from '@spier/core/lib/observationMappers'

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

  // ─── Stage 5/6 rollup (TL-034 / TL-035 / TL-017) ───────────────
  describe('follow-up rollup', () => {
    const now = new Date('2026-07-28T12:00:00.000Z')

    const appointment = (
      id: string,
      start: string,
      status: string,
      provider?: string,
    ): AppointmentResource => ({
      resourceType: 'Appointment',
      id,
      status,
      start,
      description: 'Follow-up',
      participant: [
        { actor: { reference: 'Patient/p1' }, status: 'accepted' },
        ...(provider ? [{ actor: { display: provider }, status: 'accepted' }] : []),
      ],
    })

    it('is empty when the patient has no handoff artifacts', () => {
      const row = deriveRegistryRow(patient, emptySlice, now)
      expect(row.nextAppointment).toBeNull()
      expect(row.noShowCount).toBe(0)
      expect(row.awaitingNoShowFollowUp).toBe(false)
      expect(row.unreachedStreak).toBe(0)
      expect(row.openReferralCount).toBe(0)
    })

    it('surfaces the next booked visit with its provider', () => {
      const row = deriveRegistryRow(
        patient,
        {
          ...emptySlice,
          appointments: [
            appointment('past', '2026-07-01T14:00:00.000Z', 'fulfilled'),
            appointment('next', '2026-08-04T14:00:00.000Z', 'booked', 'Riverside BH'),
          ],
        },
        now,
      )
      expect(row.nextAppointment).toEqual({
        date: '2026-08-04T14:00:00.000Z',
        status: 'booked',
        provider: 'Riverside BH',
      })
    })

    it('counts open referrals but not completed or revoked ones', () => {
      const referral = (id: string, status: string): ServiceRequestResource => ({
        resourceType: 'ServiceRequest',
        id,
        status,
        intent: 'order',
        authoredOn: '2026-07-20T15:05:00Z',
      })
      const row = deriveRegistryRow(
        patient,
        {
          ...emptySlice,
          serviceRequests: [
            referral('a', 'active'),
            referral('b', 'draft'),
            referral('c', 'completed'),
            referral('d', 'revoked'),
          ],
        },
        now,
      )
      expect(row.openReferralCount).toBe(2)
    })

    it('flags an outstanding no-show and counts unreached outreach', () => {
      const outreach = (id: string, sent: string, outcome: string): CommunicationResource => ({
        resourceType: 'Communication',
        id,
        status: 'completed',
        sent,
        extension: [
          {
            url: 'http://thespierproject.org/fhir/StructureDefinition/outreach-outcome',
            valueCodeableConcept: {
              coding: [{ system: 'http://thespierproject.org/fhir/CodeSystem/spier-outreach-outcome', code: outcome }],
            },
          },
        ],
      })
      const row = deriveRegistryRow(
        patient,
        {
          ...emptySlice,
          appointments: [appointment('missed', '2026-07-22T14:00:00.000Z', 'noshow')],
          communications: [
            outreach('o1', '2026-07-23T10:00:00.000Z', 'no-answer'),
            outreach('o2', '2026-07-24T10:00:00.000Z', 'unable-to-reach'),
          ],
        },
        now,
      )
      expect(row.awaitingNoShowFollowUp).toBe(true)
      expect(row.noShowCount).toBe(1)
      expect(row.unreachedStreak).toBe(2)
    })
  })

  describe('lastActivity with handoff artifacts', () => {
    const now = new Date('2026-07-28T12:00:00.000Z')

    it('dates a still-upcoming appointment by when it was booked, not the visit', () => {
      // Regression guard: Appointment.start for a booked follow-up is in the
      // FUTURE, and a naive newest-wins would report a visit that hasn't
      // happened as the patient's most recent activity — pushing every real
      // event off the row.
      const row = deriveRegistryRow(
        patient,
        {
          ...emptySlice,
          communications: [
            {
              resourceType: 'Communication',
              id: 'c1',
              sent: '2026-07-27T10:00:00.000Z',
              reasonCode: [{ text: 'Caring contact' }],
            } as CommunicationResource,
          ],
          appointments: [
            {
              resourceType: 'Appointment',
              id: 'future',
              status: 'booked',
              start: '2026-09-01T14:00:00.000Z',
              _savedAt: '2026-07-20T09:00:00.000Z',
            } as AppointmentResource,
          ],
        },
        now,
      )
      expect(row.lastActivity).toEqual({
        date: '2026-07-27T10:00:00.000Z',
        label: 'Caring contact',
      })
    })

    it('dates a past appointment by the visit itself and labels its outcome', () => {
      const row = deriveRegistryRow(
        patient,
        {
          ...emptySlice,
          appointments: [
            {
              resourceType: 'Appointment',
              id: 'past',
              status: 'noshow',
              start: '2026-07-22T14:00:00.000Z',
              description: 'Post-discharge follow-up',
            } as AppointmentResource,
          ],
        },
        now,
      )
      expect(row.lastActivity).toEqual({
        date: '2026-07-22T14:00:00.000Z',
        label: 'Post-discharge follow-up (no-show)',
      })
    })

    it('advances the pathway from a handoff artifact alone', () => {
      // A Consent stages itself via meta.tag, so Coordinate Handoffs counts as
      // touched even with no Questionnaire activity at all.
      const row = deriveRegistryRow(
        patient,
        {
          ...emptySlice,
          consents: [
            {
              resourceType: 'Consent',
              id: 'consent1',
              status: 'active',
              dateTime: '2026-07-20T14:55:00.000Z',
              meta: {
                tag: [
                  {
                    system: 'http://thespierproject.org/fhir/CodeSystem/spier-pathway-stage',
                    code: 'coordinate-handoffs',
                  },
                ],
              },
              provision: { type: 'permit' },
            } as ConsentResource,
          ],
        },
        now,
      )
      expect(row.completedStages).toContain('coordinate-handoffs')
      expect(row.currentStage).toBe('track-follow-up')
      expect(row.lastActivity?.label).toBe('Information-sharing consent — permitted')
    })
  })
})
