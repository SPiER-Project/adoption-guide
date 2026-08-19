/**
 * Shared SMART patient-context helper — fetches the launch patient and
 * reduces the FHIR Patient to the pre-parsed summary shape SmartContext
 * stores (name as a display string, not a HumanName array; see
 * formatPatientDisplay's SMART branch). Used by both the OAuth redirect
 * screen and SmartContext's session rehydration.
 */
import type Client from 'fhirclient/lib/Client'
import { MRN_SYSTEM } from './fhircast'

export interface SmartPatientSummary {
  id?: string
  name?: string
  dob?: string
  gender?: string
  /**
   * Medical record number, from `Patient.identifier`. Without this the banner
   * fell back to the resource id and displayed "MRN patient-011" against a
   * Patient whose actual MRN is 11011 — the same chart shows the real number
   * on the local data source, so the two sources disagreed on screen. Found by
   * launching the deployed mock EHR in a browser; no test could see it,
   * because nothing asserted what the banner renders.
   */
  mrn?: string
  [key: string]: unknown
}

export async function readSmartPatientSummary(client: Client): Promise<SmartPatientSummary> {
  if (!client.patient.id) return {}
  const patientData = await client.patient.read()
  const name = patientData.name?.[0]
  const formattedName = name
    ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
    : 'Unknown Name'
  // Prefer SPiER's own MRN namespace; fall back to the first identifier that
  // has a value, since a real EHR will not use our system.
  const identifiers: Array<{ system?: string; value?: string }> = patientData.identifier ?? []
  const mrn = identifiers.find(i => i?.system === MRN_SYSTEM)?.value
    ?? identifiers.find(i => i?.value)?.value

  return {
    id: patientData.id,
    name: formattedName,
    dob: patientData.birthDate,
    gender: patientData.gender,
    mrn,
  }
}
