// Coding verification status
//
// SPiER's hand-authored Questionnaires (FHIR-Resources/) annotate individual
// codings with whether the code has been checked against an authoritative
// source. It is a provenance marker for the *authoring* process, not clinical
// data: a Questionnaire is only eligible to leave `status: draft` once no
// coding on it still reads `unverified`. See FHIR-Resources/ASQ/README.md for
// how it is used in practice.
//
// The extension was in use across five Questionnaires (ASQ, BSSA, PSS-3,
// PSS-Full, SAFE-T) for months without ever being defined, which
// `validator_cli` reports as ~35 "extension could not be found so is not
// allowed here" errors. Defining it here — rather than dropping the
// annotations — keeps the marker machine-readable and publishes it with the IG.

CodeSystem: SPiERCodingVerificationStatusCodes
Id: spier-coding-verification-status
Title: "SPiER Coding Verification Status Codes"
Description: "Whether a coding used in a SPiER artifact has been checked against the authority that publishes it."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #verified "Verified" "The code and its display were checked against the publishing authority (e.g. looked up in LOINC or SNOMED CT) and are correct as written."
* #unverified "Unverified" "The code is believed correct but has not been checked against the publishing authority. Blocks the artifact from leaving draft status."
* #no-standard-binding "No Standard Binding" "No published code exists for this concept in any standard terminology, so a SPiER-local code is used deliberately. Terminal state — this does not block leaving draft status."


ValueSet: SPiERCodingVerificationStatus
Id: spier-coding-verification-status-vs
Title: "SPiER Coding Verification Status"
Description: "Verification states a coding in a SPiER artifact can be in."
* ^status = #draft
* ^experimental = true
* include codes from system SPiERCodingVerificationStatusCodes


Extension: CodingVerificationStatus
Id: coding-verification-status
Title: "Coding Verification Status"
Description: "Whether this coding has been checked against the authority that publishes it. An authoring-provenance marker: a SPiER artifact may not leave draft status while any coding on it is still `unverified`."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "Coding"
* value[x] only code
* valueCode from SPiERCodingVerificationStatus (required)
