/**
 * Shared SMART patient-context helper — fetches the launch patient and
 * reduces the FHIR Patient to the pre-parsed summary shape SmartContext
 * stores (name as a display string, not a HumanName array; see
 * formatPatientDisplay's SMART branch). Used by both the OAuth redirect
 * screen and SmartContext's session rehydration.
 */
import type Client from 'fhirclient/lib/Client'

export interface SmartPatientSummary {
  id?: string
  name?: string
  dob?: string
  gender?: string
  [key: string]: unknown
}

export async function readSmartPatientSummary(client: Client): Promise<SmartPatientSummary> {
  if (!client.patient.id) return {}
  const patientData = await client.patient.read()
  const name = patientData.name?.[0]
  const formattedName = name
    ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
    : 'Unknown Name'
  return {
    id: patientData.id,
    name: formattedName,
    dob: patientData.birthDate,
    gender: patientData.gender,
  }
}
