---
name: fhir-questionnaire-quality
description: Review, author, or improve FHIR R4 Questionnaire resources for interoperability quality. Use this skill whenever a user is working with a `.json` Questionnaire resource, asks for feedback on a FHIR form/questionnaire/survey, wants to convert a paper assessment or validated instrument (PHQ-9, ASQ, GAD-7, AUDIT-C, Columbia Protocol, etc.) into a FHIR Questionnaire, or needs to check that a Questionnaire is portable across EHRs. Trigger even when the user says "form" or "survey" rather than "questionnaire" — if the artifact is a FHIR Questionnaire resource or destined to become one, this skill applies. Also trigger when reviewing QuestionnaireResponse contracts or the Observation transformation that sits downstream of a Questionnaire.
---

# FHIR Questionnaire Quality Review

This skill evaluates FHIR R4 Questionnaire resources against the standards that actually matter for cross-EHR portability: coded bindings on questions and answers, correct use of conditional logic, self-contained code system definitions, and clear clinical context. It is designed for the real-world case where a clinically valid instrument (ASQ, PHQ-9, GAD-7, AUDIT, Columbia Protocol, safety plans, etc.) has been drafted as FHIR but not yet coded to the level of rigor an HIE, EHR integration team, or standards reviewer will expect.

## When this skill applies

- Reviewing an existing Questionnaire resource for portability quality
- Authoring a new Questionnaire from a validated clinical instrument
- Debugging why a Questionnaire's data isn't landing discretely in a receiving EHR
- Preparing a Questionnaire for USCDI+ or an HL7 Implementation Guide
- Sanity-checking a Questionnaire against a FHIR validator's complaints

## What "quality" means here

A FHIR Questionnaire has four jobs:

1. **Render** a form a clinician can fill out
2. **Capture** responses in a structured way
3. **Identify** each question and answer with codes that downstream systems can recognize
4. **Document** the clinical context so receiving systems know when and where it applies

Most Questionnaires do (1) and (2) well. Job (3) — coded identification — is where interoperability actually lives, and it's the most common failure mode. Job (4) is where discoverability lives. A Questionnaire that renders beautifully but has no LOINC codes on its questions is, from an interoperability standpoint, indistinguishable from a freeform local form.

## Review checklist

Work through these in order. The earlier items have the highest leverage.

### 1. Coded identification on every item (highest leverage)

Every `item` that represents a real question must carry a `code` array pointing to a standard identifier — LOINC for the overwhelming majority of clinical questions. The Questionnaire root itself should also carry a `code` binding to the panel-level concept when one exists.

**Look for:**
- Is there a `code` array on each question item? If not, this is the first thing to fix.
- Does the code system make sense? LOINC is the correct choice for nearly all clinical questions. SNOMED sometimes applies for highly clinical concepts. Avoid local code systems for standard questions.
- Is the code's `display` text consistent with the question's `text`? Drift here creates confusion.
- Does the Questionnaire's root have its own `code` element? For panels (PHQ-9, ASQ, GAD-7, etc.), there's almost always a panel-level LOINC code that belongs here.

**Important nuance:** When the user hasn't independently verified a LOINC mapping, treat candidate codes as unverified rather than dropping them in silently. Recommend adding an inline comment or a verification checklist, and flag that wording drift between the Questionnaire and the LOINC definition causes silent portability failures. LOINC bindings target specific phrasings.

If a clinical concept genuinely has no LOINC binding, that's a finding worth surfacing — a LOINC submission may be warranted, and this should be noted as an open item rather than papered over with a local code.

### 2. Coded answer values for categorical questions

Boolean questions (`type: boolean`) are convenient for authoring but do not carry coded answer values in the resulting QuestionnaireResponse or downstream Observations. For any pilot or production use where answers need to be portable, convert these to `type: choice` with `answerValueSet` pointing at a standards-bound value set.

**The canonical Yes/No binding is SNOMED:**
- `Yes` → SNOMED `373066001` (Yes (qualifier value))
- `No` → SNOMED `373067005` (No (qualifier value))

For more nuanced answers (severity scales, frequency, etc.), bind to the relevant LOINC answer list or SNOMED subset.

**Review questions:**
- Are any `type: boolean` items serving as Yes/No clinical questions that will be transmitted? If so, recommend `choice` with a SNOMED-bound value set.
- Are `choice` items bound to an `answerValueSet` or just an inline `answerOption` list with local codes?
- If local codes are used in `answerOption`, is there a CodeSystem resource defining them? (See item 4.)

### 3. Conditional logic that preserves "asked vs. not asked"

Many clinical instruments have conditional follow-ups — the acute question in ASQ is only asked if any baseline question is positive; the recency question is only asked if the patient has attempted before. `enableWhen` and `enableBehavior` handle this correctly when used properly.

**Look for:**
- Does the conditional logic cover all triggering conditions? An `enableBehavior: "any"` with multiple `enableWhen` entries is the pattern for "if any of these are positive."
- Does the QuestionnaireResponse contract distinguish "not asked" from "answered No"? A conditional item that wasn't triggered should be **absent** from the response, not present with a negative value. Downstream systems need to handle absence semantically — a missing acute question in a suicide screening means "the screen was negative and follow-up wasn't needed," not "the clinician forgot to ask."
- Flag this distinction explicitly in the README or accompanying documentation. It's an easy place for receiving-system logic to go wrong.

### 4. Self-contained code system definitions

If the Questionnaire references local code systems (`http://yourorg.example/CodeSystem/...`), the actual CodeSystem resources must exist as sibling FHIR resources and be discoverable. FHIR validators flag dangling references. EHR FHIR clients may silently fail on them.

**Look for:**
- Every local `system` URL referenced in the Questionnaire should have a matching CodeSystem resource in the same IG/repo.
- Every local `answerValueSet` URL should have a matching ValueSet resource.
- Where a standard binding exists (LOINC, SNOMED), prefer it over a local code system.

### 5. Clinical context metadata

A Questionnaire that doesn't declare its clinical context is harder for EHR FHIR clients to surface appropriately.

**Look for:**
- `useContext` declaring venue (ED, inpatient, outpatient, telehealth) and clinical focus
- `subjectType` (usually `Patient`)
- Clear `description`, `purpose`, and `copyright` fields
- Public-domain and licensed instruments handled honestly — ASQ is public domain; PHQ-9 is freely available but copyrighted by Pfizer; the Columbia Protocol has usage terms. Document these accurately.

### 6. Publication status and experimental flags

- `status: draft` and `experimental: true` are correct during development but will prevent some EHR FHIR clients from operating against the resource. Plan the transition to `active` / `false` and name what gates that transition (typically: validation passes, coded bindings verified, at least one successful round-trip through QuestionnaireResponse).
- `version` should move with material changes. A pilot artifact's version history is itself a useful communication artifact for collaborators.

### 7. Downstream transformation clarity

A Questionnaire on its own isn't the end of the interoperability story — the QuestionnaireResponse eventually needs to become something the receiving EHR can display as discrete clinical data (Observations, most commonly). For pilot readiness, recommend publishing:

- One or more worked **QuestionnaireResponse** examples showing how a completed instrument looks
- **Transformation guidance** describing how a QuestionnaireResponse becomes a set of Observations (one per question, one for the summary result)
- Preservation of conditional-item semantics through the transformation (absent questions shouldn't become null observations)

## Common failure modes to watch for

- **String-matching dependency:** The Questionnaire has no `code` elements, so downstream systems recognize questions by `text` only. Any rewording breaks portability.
- **"Handled at transformation":** Coded answer bindings are deferred to a transformation layer instead of declared in the Questionnaire. This works until the transformation layer is someone else's code.
- **Local code systems where standards exist:** An `http://yourorg.example/CodeSystem/yes-no` where `373066001` / `373067005` would suffice.
- **Conditional-item null ambiguity:** The receiving system sees a missing acute question and doesn't know whether to treat it as "negative" or "not asked."
- **Panel-level LOINC absent from root:** Individual questions are coded but the Questionnaire root has no `code`, so a FHIR client can't query "do you have an ASQ for this patient?" except by title matching.
- **Draft status never promoted:** The Questionnaire remains `status: draft` indefinitely, quietly blocking downstream consumption.
- **Licensed instrument used without attribution:** PHQ-9, Columbia Protocol, and others have copyright or licensing notes that belong in `copyright`.

## Output format for reviews

When reviewing an existing Questionnaire, structure feedback as:

1. **What's working well** — name the good design decisions explicitly. This isn't politeness; it's a signal that the reviewer understands the artifact.
2. **Priority 1 gaps** — the handful of changes that materially move the Questionnaire from "draft" to "portable." These are typically coded bindings.
3. **Priority 2 gaps** — self-documenting and validator-clean improvements.
4. **Priority 3 polish** — smaller concerns that matter for completeness but not for core portability.
5. **Open questions or verification needed** — things the author needs to confirm that the reviewer can't (LOINC binding verification, copyright terms, local policy on PHI-sensitive fields).
6. **Suggested order of operations** — a short, prioritized checklist.

When authoring a new Questionnaire, work through the review checklist in order: start with coded identification, add coded answer bindings, add conditional logic, add code system resources, add clinical context, decide on status/version.

## What this skill does not do

- Clinical validation of the instrument itself — assume the clinical content is correct or flag clinical concerns separately. This skill is about interoperability quality, not clinical appropriateness.
- Verifying specific LOINC bindings against the LOINC database in real time. The skill should flag verification as an open item rather than assert codes it can't confirm.
- EHR-vendor-specific quirks (Epic's App Orchard requirements, Cerner's FHIR ingestion limits, etc.). These are project-specific findings that emerge during integration, not Questionnaire-level issues.
