# ASQ FHIR Questionnaire — Open Items

Tracking list of improvements to `/ASQ/fhir/questionnaires/questionnaire.json` and `/ASQ/README.md` identified during pilot prep review.

## Priority 1 — Required for pilot-ready artifact

### LOINC binding on every item

Every question item and the Questionnaire root should carry a `code` array pointing at the corresponding LOINC concept. Without these bindings, a receiving system has no way to recognize what `q1`, `q2`, etc. represent except by string-matching the question text — which defeats the point of using a standard instrument.

**⚠️ VERIFICATION NEEDED:** The exact LOINC-to-question mappings have not been independently verified against the official LOINC panel definition for 93373-9 (ASQ panel). The candidate codes below are drawn from prior conversation but need to be confirmed against LOINC's authoritative binding before the Questionnaire is promoted from `draft` to `active`. ASQ has gone through minor wording variants over time, and the LOINC bindings target specific phrasings. Mismatches here cause silent portability failures downstream.

| linkId | Question (current wording) | Candidate LOINC | Verified? |
|--------|----------------------------|-----------------|-----------|
| root Questionnaire | ASQ panel wrapper | 93373-9 | ☐ |
| q1 | Wished you were dead | 93246-7 | ☐ |
| q2 | You or family better off if you were dead | — (possibly no LOINC) | ☐ |
| q3 | Thoughts about killing yourself | 93247-5 | ☐ |
| q4 | Ever tried to kill yourself | 93248-3 | ☐ |
| q5 | Thoughts of killing yourself right now | 93249-1 | ☐ |
| result-category | Suicide risk level | 93374-7 | ☐ |

**Action:** Verify each row against the LOINC 93373-9 panel definition. If ASQ Q2 has no LOINC binding, flag as a potential LOINC submission as a pilot deliverable. Until verified, each item's `code` block carries the `http://spier.org/StructureDefinition/coding-verification-status` extension set to `unverified`.

> **Conflict to reconcile during verification:** The candidate codes above (93246-7, 93247-5, 93248-3, 93249-1) appear to overlap with **C-SSRS** LOINC codes already assigned in `web/src/data/catalog/dataElements.ts`. Separately, the SPiER data dictionary and observation mapper use a **different** ASQ LOINC series (93267-4, 93266-6, 93265-8, 93264-1, 93263-3) for the same questions. These two code sets cannot both be right — LOINC verification resolves which is correct.

### Switch q1–q5 from boolean to choice with SNOMED bindings ✅

*Completed in Questionnaire v1.1.0-pilot.* The five screening questions are now `type: choice` with `answerValueSet: http://spier.org/ValueSet/yes-no`, which binds to SNOMED CT:

- `Yes` → SNOMED `373066001`
- `No` → SNOMED `373067005`

The ValueSet resource lives at `/ASQ/fhir/valuesets/yes-no.json`. Downstream Observation generation now maps the coded answer directly from the QuestionnaireResponse `valueCoding`.

### Add `code` element to Questionnaire root ✅

*Completed in Questionnaire v1.1.0-pilot.* `Questionnaire.code` is set to LOINC `93373-9` with `verification-status: unverified`. This allows FHIR clients to query "does this repository have any ASQ screenings for this patient?" by panel code rather than string-matching on title — pending verification.

## Priority 2 — Self-documenting and validator-clean

### Add CodeSystem resources for local codes ✅

*Completed.* Three CodeSystem resources now live at `/ASQ/fhir/codesystems/`:

- `asq-attempt-recency.json`
- `asq-screening-result.json`
- `asq-age-group.json`

These cover every local `system` URL referenced from the Questionnaire. FHIR validators should no longer flag dangling references.

### Reconsider `asq-screening-result` as local vs. standard

The screening result (negative / non-acute-positive / acute-positive) should ideally bind to LOINC 93374-7's answer concepts rather than a SPiER-local code system. Worth investigating whether LOINC has associated answer concepts for 93374-7; if so, use those. If not, keep the local codes (now defined in `asq-screening-result.json`).

### Consider deriving `asq-age-group` rather than asking it

The youth/adult distinction is used for refusal interpretation. It could be derived from `Patient.birthDate` at interpretation time rather than carried as a Questionnaire item. This would remove one item from the form and eliminate a data-entry opportunity for clinician error.

### Add USCDI+ BH alignment section to the README ✅

*Completed.* The README now positions the artifact within the ONC/SAMHSA Behavioral Health IT Initiative, USCDI+ BH, the HL7 FHIR Behavioral Health Profiles IG, and LOINC panel 93373-9.

## Priority 3 — Polish and smaller concerns

### Status flags for pilot readiness

Currently `status: draft` and `experimental: true`. Some EHR FHIR clients refuse to operate against `draft` resources. The transition to `active` / `false` is gated on every coding extension reading `verified` (instead of `unverified`) — this is the mechanical promotion criterion.

### Add `useContext` to the Questionnaire ✅

*Completed.* `useContext` declares clinical focus (SNOMED `225337009` Suicide risk assessment) and venues (ER, Hospital, Outpatient Facility, Primary Care) so EHR FHIR clients can surface the Questionnaire in the right contexts.

### Broaden `q4-recent-attempt` answer options

Current options: "within 12 months" / "over 1 year ago." Consider adding:
- An "unknown" option — refusal or non-disclosure of timing is common
- Optionally, a specific-date option for cases where the patient discloses timing

### Policy decision on `q5-describe` free text

The 500-character free-text description carries PHI-sensitivity and portability concerns. Two questions:
1. Should this field transmit through the HIE at all in the pilot, or stay local to the originating site?
2. If transmitted, how does BSCC's sensitive-data handling apply to free text that isn't coded?

This is a policy decision rather than a FHIR decision, but the Questionnaire (and MOU) should make the policy explicit.

## Priority 4 — Pilot-adjacent

### Consider publishing a matching QuestionnaireResponse example

A worked example of a completed ASQ (both acute-positive and negative-screen cases) as `QuestionnaireResponse` resources would make the contract between Questionnaire and downstream Observation transformation concrete. Useful for EHR vendor discussions.

### Consider publishing Observation transformation guidance

Since the pilot targets discrete observations in the receiving EHR chart, document how a QuestionnaireResponse becomes a set of FHIR Observations (one per question, one for the result). This is the artifact MEDITECH and Cerner integration teams will actually build against.

---

## Quick reference — suggested order of operations

1. ☐ Verify LOINC mappings against the 93373-9 panel definition (resolve the conflict with existing C-SSRS / ASQ code sets in `dataElements.ts`)
2. ✅ Switch q1–q5 to `choice` with SNOMED-bound Yes/No ValueSet
3. ✅ Add `code` elements to all items and the root Questionnaire (candidate, unverified)
4. ✅ Add CodeSystem resources for local codes
5. ✅ Add USCDI+ BH alignment section to README
6. ☐ Address Priority 3 polish items (policy decisions on age-group derivation and `q5-describe` free text)
7. ☐ Flip `status` to `active` once every `coding-verification-status` reads `verified`
