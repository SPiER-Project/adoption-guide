export const DEMO_PATIENT = {
  resourceType: 'Patient' as const,
  id: 'demo-patient',
  name: [
    {
      use: 'official' as const,
      given: ['Jane'],
      family: 'Doe',
    },
  ],
  birthDate: '1990-01-15',
  gender: 'female' as const,
  identifier: [
    {
      system: 'http://hospital.example.org/mrn',
      value: '12345',
    },
  ],
}

export type DemoPatient = typeof DEMO_PATIENT

export interface PatientDisplay {
  fullName: string
  dob: string
  mrn: string
  gender: string
}

/**
 * Loose shape accepted by formatPatientDisplay — covers both the SMART context's
 * pre-parsed patient (name as a string) and a raw FHIR Patient resource (name as
 * an array of HumanName).
 */
interface PatientLike {
  name?: string | Array<{ given?: string[]; family?: string }>
  dob?: string
  id?: string
  gender?: string
  birthDate?: string
  identifier?: Array<{ value?: string }>
}

export function formatPatientDisplay(patient: PatientLike | null | undefined): PatientDisplay {
  // Handle SMART on FHIR patient format (pre-parsed in SmartContext)
  if (patient?.name && typeof patient.name === 'string') {
    return {
      fullName: patient.name,
      dob: patient.dob || 'Unknown',
      mrn: patient.id || 'Unknown',
      gender: patient.gender || 'Unknown',
    }
  }

  // Handle FHIR Patient resource format (name is an array of HumanName)
  const name = Array.isArray(patient?.name) ? patient.name[0] : undefined
  const fullName = name
    ? `${(name.given || []).join(' ')} ${name.family || ''}`.trim()
    : 'Unknown Patient'

  return {
    fullName,
    dob: patient?.birthDate || 'Unknown',
    mrn: patient?.identifier?.[0]?.value || 'Unknown',
    gender: patient?.gender
      ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
      : 'Unknown',
  }
}
