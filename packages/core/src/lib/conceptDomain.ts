/**
 * The SPiER concept-domain category, for resources the app emits at runtime.
 *
 * #271 added a REQUIRED `category:suicideRisk` slice to 28 profiles — the Gravity
 * pattern that lets a consumer retrieve the whole suicide-safer care record by one
 * category value. The scenario fixtures and the IG examples were updated with it;
 * **the runtime builders were not**, so from #271 until now every Observation,
 * CarePlan, ServiceRequest, Communication, Consent, Flag, Procedure and
 * DocumentReference the app produced was non-conformant against the profile it
 * claimed.
 *
 * Nothing noticed because nothing validated runtime output. That is #302, and this
 * constant is part of its fix: the emitted corpus is now checked by the HL7
 * validator in CI (`scripts/validate-fhir.mjs --also web/.runtime-fhir`).
 *
 * The display is not a free choice — `validate-fhir.mjs` checks every
 * `Coding.display` on a SPiER-local system against the CodeSystem, so it must
 * match `CodeSystem-spier-concept-domain.json` exactly.
 */
export const CONCEPT_DOMAIN_SYSTEM = 'http://thespierproject.org/fhir/CodeSystem/spier-concept-domain'

export const SUICIDE_RISK_DOMAIN = {
  system: CONCEPT_DOMAIN_SYSTEM,
  code: 'suicide-risk',
  display: 'Suicide risk',
} as const

/**
 * One `CodeableConcept` carrying the domain code, ready to append to a
 * `category` array.
 *
 * Appended rather than replacing whatever clinical category the resource already
 * had: the slicing #271 defined is `#open` precisely so the standard category
 * (`survey`, `encounter-diagnosis`, a LOINC document type) coexists with the
 * domain tag instead of competing with it.
 */
export function suicideRiskCategory(): { coding: { system: string; code: string; display: string }[] } {
  return { coding: [{ ...SUICIDE_RISK_DOMAIN }] }
}
