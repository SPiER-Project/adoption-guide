/**
 * Population-view filter predicates that are worth testing away from React
 * (deck panel 11, issue #278).
 *
 * Only age lives here so far. The deck asks for nine filters; clinic, PCP,
 * behavioral-health care manager and psychiatric consultant all need the
 * care-team role model SPiER has no `CareTeam` or `PractitionerRole` for, and
 * diagnosis and insurance need `Condition` queries and `Coverage`. Age is the
 * one addition derivable from data `patients.json` already carries.
 */

/**
 * Whole years at `on`, or null when the date of birth is unusable.
 *
 * Compares month/day rather than dividing elapsed milliseconds: a patient whose
 * birthday is later this month is still the younger age, and the ms form gets
 * that wrong around leap years. Age bands drive a clinical filter — pediatric
 * versus adult instrument selection hangs off exactly this boundary — so the
 * off-by-one matters more here than the arithmetic is worth saving.
 */
export function ageOf(dob: string, on: Date = new Date()): number | null {
  const born = new Date(dob)
  if (Number.isNaN(born.getTime())) return null
  let age = on.getUTCFullYear() - born.getUTCFullYear()
  const monthDelta = on.getUTCMonth() - born.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < born.getUTCDate())) age--
  return age >= 0 ? age : null
}

export interface AgeBand {
  value: string
  label: string
  /** Inclusive lower bound. */
  min: number
  /** Inclusive upper bound; omitted means open-ended. */
  max?: number
}

/**
 * Bands chosen to match where SPiER's instrument choice actually changes rather
 * than as round decades: the ASQ and the C-SSRS pediatric/adolescent version
 * are the under-18 tools, and 18–24 is the band the deck's own screening
 * discussion treats separately.
 */
export const AGE_BANDS: AgeBand[] = [
  { value: 'under-18', label: 'Under 18', min: 0, max: 17 },
  { value: '18-24', label: '18–24', min: 18, max: 24 },
  { value: '25-44', label: '25–44', min: 25, max: 44 },
  { value: '45-64', label: '45–64', min: 45, max: 64 },
  { value: '65-plus', label: '65+', min: 65 },
]

export function bandOf(age: number | null): AgeBand | null {
  if (age === null) return null
  return AGE_BANDS.find(b => age >= b.min && (b.max === undefined || age <= b.max)) ?? null
}

/**
 * True when a patient falls in the named band. An unparseable date of birth
 * matches no band, so a broken record is hidden by an active age filter rather
 * than silently included in every band.
 */
export function matchesAgeBand(dob: string, bandValue: string, on: Date = new Date()): boolean {
  return bandOf(ageOf(dob, on))?.value === bandValue
}
