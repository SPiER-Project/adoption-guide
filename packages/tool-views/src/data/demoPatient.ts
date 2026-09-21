export interface PatientDisplay {
  fullName: string
  dob: string
  /**
   * Whole years, as a string, or `''` when the date of birth is unknown.
   *
   * A string rather than a number so every field on this shape renders the
   * same way — and so "unknown" is one falsy value rather than a `null` each
   * caller has to remember to test. The clinical landing screen names the
   * patient with age rather than date of birth (clinical-app audit §4.1): a
   * clinician reading a suicide-risk recommendation is placing the patient,
   * not verifying their identity against a wristband, and on a phone the
   * panel's one identity line has room for one of the two.
   */
  age: string
  mrn: string
  gender: string
}

/**
 * Whole years between a FHIR `date` and today, or `''` when it is not a date.
 *
 * Deliberately calendar arithmetic rather than a millisecond division: a
 * birthday is a date, not a duration, and dividing by 365.25 puts a patient a
 * day either side of their birthday in the wrong year. Local time on both
 * sides, because `birthDate` has no timezone and a UTC reading of it shifts
 * the day backwards for anyone west of Greenwich.
 */
export function ageInYears(birthDate: string | undefined, today: Date = new Date()): string {
  if (!birthDate) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate)
  if (!match) return ''
  const [, y, m, d] = match
  const born = { year: Number(y), month: Number(m), day: Number(d) }
  let years = today.getFullYear() - born.year
  const monthNow = today.getMonth() + 1
  if (monthNow < born.month || (monthNow === born.month && today.getDate() < born.day)) years -= 1
  return years >= 0 && years < 150 ? String(years) : ''
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
  /** Pre-parsed MRN on the SMART summary (see smartPatient.ts). */
  mrn?: string
}

export function formatPatientDisplay(patient: PatientLike | null | undefined): PatientDisplay {
  // Handle SMART on FHIR patient format (pre-parsed in SmartContext)
  if (patient?.name && typeof patient.name === 'string') {
    return {
      fullName: patient.name,
      dob: patient.dob || 'Unknown',
      age: ageInYears(patient.dob),
      // The resource id is the LAST resort: it is not an MRN, and showing it
      // as one made the SMART banner disagree with the local one.
      mrn: patient.mrn || patient.id || 'Unknown',
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
    age: ageInYears(patient?.birthDate),
    mrn: patient?.identifier?.[0]?.value || 'Unknown',
    gender: patient?.gender
      ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
      : 'Unknown',
  }
}
