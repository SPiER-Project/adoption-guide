// Concept Layer — Cross-Instrument Suicide-Risk Harmonization
//
// The instrument-agnostic representation every suicide-risk tool maps INTO, so
// a consumer can act on a result without understanding the instrument that
// produced it. Modelled on the HL7 Gravity Project, built on SDC extraction.
//
// The reader-facing reasoning is PUBLISHED — each block below names the page it
// belongs to. Do not restate any of it here.
//
// ⚠️ The concept rides on the GENERIC LOINC 93374-7, never an instrument item
// code — an instrument code would make the value readable only by something
// that already knows the instrument, which defeats the layer.
//
// ⚠️ EVERY instrument-result → tier crosswalk is a clinical-equivalence claim
// and NONE has SME sign-off. The examples here are illustrative only.


CodeSystem: SPiERSuicideRiskTier
Id: spier-suicide-risk-tier
Title: "SPiER Suicide Risk Tier"
Description: "Instrument-agnostic suicide-risk severity tiers. Every SPiER screening/assessment instrument maps its native result or disposition into exactly this set, so downstream systems consume one common, ordered concept regardless of which tool was administered. Lower-fidelity instruments map to the widest defensible tier (recorded as a 'wider' equivalence in the per-instrument ConceptMap); the layer never fabricates precision the instrument cannot support."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #no-risk "No risk identified" "Screen negative; no suicidal ideation, behavior, or history endorsed. Clinical judgment can always override a negative screen."
* #low "Low risk" "Minimal indicators; passive ideation without intent, plan, or recent behavior."
* #moderate "Moderate risk" "Suicidal ideation or relevant history endorsed without acute features; brief suicide safety assessment indicated."
* #high "High risk" "Significant active ideation, intent, or recent behavior; full safety evaluation indicated."
* #imminent "Imminent risk" "Active suicidal ideation right now, or intent/plan with means; STAT/urgent safety evaluation required and the patient should not be left alone."

// SAFE-T has the clinician ASSIGN a tier, so its answerOptions restate each
// tier's defining features inline — choosing between definitions, not labels.
// `Coding.display` must match the CodeSystem, hence these designations.
* #low ^designation[+].language = #en
* #low ^designation[=].value = "Low — thoughts of death; no plan, intent, or behavior; manageable risk factors, strong protective factors"
* #moderate ^designation[+].language = #en
* #moderate ^designation[=].value = "Moderate — suicidal ideation with plan, but no intent or behavior; multiple risk factors, few protective factors"
* #high ^designation[+].language = #en
* #high ^designation[=].value = "High — suicidal ideation with plan, method, and intent to carry out; severe symptoms or acute precipitating event"


ValueSet: SPiERSuicideRiskTierVS
Id: spier-suicide-risk-tier-vs
Title: "SPiER Suicide Risk Tier Value Set"
Description: "The bindable set of instrument-agnostic suicide-risk tiers. Bound (required) to the value of the SPiER Suicide Risk Concept Observation."
* ^status = #draft
* ^experimental = true
* include codes from system SPiERSuicideRiskTier


// --- Concept domain (category) -------------------------------------
// The Gravity domain tag, so a consumer can filter across instruments.

CodeSystem: SPiERConceptDomain
Id: spier-concept-domain
Title: "SPiER Concept Domain"
Description: "Domain categories for SPiER harmonized concept Observations, used as Observation.category so consumers can query the concept layer by domain independent of the originating instrument."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #suicide-risk "Suicide risk" "The Observation expresses an instrument-agnostic suicide-risk concept. It indicates the domain addressed; it does not by itself confirm a clinical finding."


ValueSet: SPiERConceptDomainVS
Id: spier-concept-domain-vs
Title: "SPiER Concept Domain Value Set"
Description: "Bindable set of SPiER concept-domain categories."
* ^status = #draft
* ^experimental = true
* include codes from system SPiERConceptDomain


// --- How a tier is arrived at -------------------------------------
//
// Every instrument yields the same tier on 93374-7, but not the same way, and
// the difference decides whether a filler must collect an answer. See
// how-to-read.md, "Where the tier comes from", for the per-instrument table.
//
// ⚠️ Marking a `computed` item `required` is a DEFECT, not strictness: it asks
// a clinician for a value nothing produces and nothing consumes. Three C-SSRS
// Questionnaires did, leaving two SPiER-authored QuestionnaireResponses
// non-conformant for months with every gate green. This CodeSystem makes the
// intent machine-readable rather than a matter of knowing the instrument.

CodeSystem: SPiERTierDerivation
Id: spier-tier-derivation
Title: "SPiER Tier Derivation"
Description: "How a suicide-risk tier is arrived at for a given instrument item: computed from other responses, or assigned by the clinician. Determines whether a filler is expected to collect an answer."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #computed "Computed from responses" "The tier is derived from other items in the same instrument. A filler MUST NOT be required to supply it, and an absent answer is expected rather than missing data. C-SSRS works this way."
* #clinician-assigned "Assigned by the clinician" "The tier is a clinical judgment the instrument asks for directly, and a consumer reads it from the response. An absent answer IS missing data. SAFE-T and PSS-Full work this way."


ValueSet: SPiERTierDerivationVS
Id: spier-tier-derivation-vs
Title: "SPiER Tier Derivation Value Set"
Description: "Bindable set of tier-derivation modes."
* ^status = #draft
* ^experimental = true
* include codes from system SPiERTierDerivation


Extension: TierDerivation
Id: tier-derivation
Title: "Tier Derivation"
Description: "On a Questionnaire item that carries a suicide-risk tier (LOINC 93374-7): whether the tier is computed from other responses or assigned by the clinician. A `computed` item must not be marked `required`, because no filler produces it."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "Questionnaire.item"
* value[x] only code
* valueCode from SPiERTierDerivationVS (required)


// --- The domain category, as a reusable rule -----------------------
//
// Gravity's leverage is not the domain list; it is the SAME code riding on
// `.category` of every resource in the chain, so one query assembles the whole
// record. See quick-starts.md for the searches and design-decisions.md for why
// the slice is 1..1 and why domain and pathway-stage are orthogonal axes.
//
// ⚠️ Written ONCE and inserted, never copied — ~28 profiles' worth of a
// discriminator that must stay byte-identical, since a domain query works only
// while every one of them agrees. Three properties are load-bearing:
//
//  * `#pattern` on `$this`, slicing `#open` — the US Core vitals idiom. Open
//    slicing is what lets standard categories sit ALONGSIDE the domain code
//    rather than compete with it; a blanket extensible binding on the whole
//    array would warn on exactly those legitimate neighbours.
//  * SPLIT IN TWO, so a profile that ALREADY slices `category` can take the
//    slice without re-declaring the slicing and either duplicating the
//    discriminator or fighting the existing one. SPiERInformationSharingConsent
//    is that case and inserts only the second half.
//  * PARAMETERIZED on the element name: not every resource type spells the slot
//    `category` — R4 `Appointment` has none, and carries `serviceCategory`.

RuleSet: SuicideRiskDomainSlicingOn(element)
* {element} 1..*
* {element} ^slicing.discriminator.type = #pattern
* {element} ^slicing.discriminator.path = "$this"
* {element} ^slicing.rules = #open
* {element} ^slicing.description = "Open slicing so resource-specific categories coexist with the SPiER concept-domain tag."

RuleSet: SuicideRiskDomainSliceOn(element)
* {element} contains suicideRisk 1..1
* {element}[suicideRisk] = SPiERConceptDomain#suicide-risk
* {element}[suicideRisk] ^short = "SPiER concept domain — suicide risk"
* {element}[suicideRisk] ^definition = "Marks this resource as part of the suicide-safer care record, so a consumer can retrieve the whole chain by domain without knowing which instrument or workflow step produced it. Screening-level: it indicates the domain addressed, not a confirmed clinical finding."

RuleSet: SuicideRiskDomainSlicing
* insert SuicideRiskDomainSlicingOn(category)

RuleSet: SuicideRiskDomainSlice
* insert SuicideRiskDomainSliceOn(category)

// The common case — a profile whose `category` is not yet sliced.
RuleSet: SuicideRiskDomainCategory
* insert SuicideRiskDomainSlicing
* insert SuicideRiskDomainSlice

// --- Standard categories, as NAMED slices ---------------------------
//
// ⚠️ A standard category MUST be a named slice, never `category[+]`. The domain
// slice is `1..1` on a `#pattern`-discriminated `$this`, so SUSHI resolves it
// onto index 0 and OVERWRITES whatever a whole-value `category[+] = <coding>`
// wrote there. 23 of 25 example Instances were losing their `survey` /
// `procedure` / `problem-list-item` / SNOMED category exactly that way, and
// nothing caught it — a missing optional category is not a validation error, so
// a clean validator run was never evidence the category survived.
//
// A SUB-element write (`category[+].text`) is the one safe form: the coding
// merges into that same CodeableConcept and both survive. SUSHI prints the
// IDENTICAL advisory for both shapes, which is why check-sushi-output.mjs
// allows it for `Communication` only — if another resource type emits it, read
// the generated JSON before touching that allowlist.
//
// Each slice assigns its value at `1..1`, so SUSHI populates it into every
// instance and instances do NOT restate it. Slicing stays `#open`, so naming
// one standard category still permits any number of unsliced others.

RuleSet: SurveyCategorySlice
* category contains survey 1..1
* category[survey] = http://terminology.hl7.org/CodeSystem/observation-category#survey
* category[survey] ^short = "Standard HL7 observation category — survey"
* category[survey] ^definition = "Marks this as a survey/assessment-derived Observation. Named rather than left to a numeric index so the value is not overwritten by the domain slice, and so the profile satisfies us-core-observation-screening-assessment's required `survey` slice."

// A survey-derived instrument Observation: `survey` + the domain tag.
RuleSet: SurveyAndSuicideRiskCategory
* insert SuicideRiskDomainSlicing
* insert SurveyCategorySlice
* insert SuicideRiskDomainSlice

// The other three standard categories, same treatment. Each keeps the display
// its instances already used, so naming the slice preserves the coding exactly
// rather than reducing it to a bare code.

RuleSet: ProcedureAndSuicideRiskCategory
* insert SuicideRiskDomainSlicing
* category contains procedure 1..1
* category[procedure] = http://terminology.hl7.org/CodeSystem/observation-category#procedure
* category[procedure] ^short = "Standard HL7 observation category — procedure"
* insert SuicideRiskDomainSlice

RuleSet: ProblemListAndSuicideRiskCategory
* insert SuicideRiskDomainSlicing
* category contains problemList 1..1
* category[problemList] = http://terminology.hl7.org/CodeSystem/condition-category#problem-list-item "Problem List Item"
* category[problemList] ^short = "Standard HL7 condition category — problem list item"
* insert SuicideRiskDomainSlice

// The safety-plan CarePlans. The two NARRATIVE plans additionally carry the
// LOINC document type; the CAMS plans carry only the SNOMED artifact code.
RuleSet: TreatmentEscalationPlanSlice
* category contains treatmentEscalationPlan 1..1
* category[treatmentEscalationPlan] = http://snomed.info/sct#735324008 "Treatment escalation plan (record artifact)"
* category[treatmentEscalationPlan] ^short = "SNOMED CT record-artifact type — treatment escalation plan"

RuleSet: SafetyPlanAndSuicideRiskCategory
* insert SuicideRiskDomainSlicing
* insert TreatmentEscalationPlanSlice
* insert SuicideRiskDomainSlice

// `suicidePreventionNote` is 1..1 — required on the two NARRATIVE safety plans
// (Stanley-Brown, CRP) and nothing else. The CAMS plans share the runtime
// factory but not the code, and use the plain rule set above.
// design-decisions.md carries the caveat that makes it defensible: `87626-8` is
// a document-type concept carried for discoverability, NOT a claim that the
// plan is a document.
//
// ⚠️ What 1..1 buys is NOT "the build catches this everywhere". min=1 with a
// fixed value means SUSHI AUTO-POPULATES the slice, so no FSH-authored Instance
// can violate it. It bites only on HAND-AUTHORED FHIR, which never passes
// through SUSHI — the population scenarios and FHIR-Resources/, where one
// safety plan had omitted the code invisibly to every offline gate.
//
// The explicit `category[suicidePreventionNote] = …` lines in stanley-brown.fsh
// and crp.fsh are redundant but kept: assigned BY SLICE NAME they resolve onto
// this slice rather than appending a duplicate, and keep the example readable
// instead of relying on an invisible auto-fill.

RuleSet: SafetyPlanNoteAndSuicideRiskCategory
* insert SuicideRiskDomainSlicing
* insert TreatmentEscalationPlanSlice
* category contains suicidePreventionNote 1..1
* category[suicidePreventionNote] = http://loinc.org#87626-8 "Suicide prevention note"
* category[suicidePreventionNote] ^short = "LOINC document type — suicide prevention note"
* insert SuicideRiskDomainSlice

// `Appointment` only. `serviceCategory` is 0..* with an `example` binding, so a
// SPiER code is conformant. The searched VALUE is unchanged; the parameter NAME
// differs, which is why quick-starts.md lists Appointment separately.
RuleSet: SuicideRiskDomainServiceCategory
* insert SuicideRiskDomainSlicingOn(serviceCategory)
* insert SuicideRiskDomainSliceOn(serviceCategory)


Profile: SPiERSuicideRiskConcept
Parent: Observation
Id: spier-suicide-risk-concept
Title: "SPiER Suicide Risk Concept Observation"
Description: "The instrument-agnostic, actionable suicide-risk concept derived from a completed screening/assessment. Carries the generic LOINC 93374-7 ('Suicide risk level'), a common risk-tier value, a universal interpretation flag, a domain category, and a derivedFrom link back to the source QuestionnaireResponse (and/or instrument-specific Observations). This is a screening-level, UNCONFIRMED concept that flags a need for follow-up — it does not confirm a diagnosis and should be verified by a care team member."
* ^status = #draft
* ^experimental = true
* status = #final (exactly)
* code = http://loinc.org#93374-7
// Standard `survey` category + the domain tag: retrievable with the rest of the
// record by category alone, and conformant to
// us-core-observation-screening-assessment.
* insert SurveyAndSuicideRiskCategory
* value[x] 1..1
* value[x] only CodeableConcept
* value[x] from SPiERSuicideRiskTierVS (required)
// Must-Support — producer SHALL populate, consumer SHALL process.
* status MS
* code MS
* subject MS
* effective[x] MS
* value[x] MS
* interpretation MS
* category[suicideRisk] MS
* derivedFrom MS
// Universal actionable flag. SPiER's examples use POS/NEG; the instrument layer
// uses A/H/L, and nothing enforces either — design-decisions.md records that
// split, which is unresolved rather than settled.
* interpretation 1..1
* interpretation from http://hl7.org/fhir/ValueSet/observation-interpretation (extensible)
// Provenance is mandatory: the concept is derived, never freestanding.
* derivedFrom 1..*
* subject 1..1
* subject only Reference(Patient)
* effective[x] 1..1
* effective[x] only dateTime or Period


// --- Illustrative examples (PENDING CLINICAL SIGN-OFF) -------------
// ASQ publishes only 3 dispositions, so this is a `wider` (lossy) mapping — it
// cannot resolve low vs moderate vs high. Illustrative, not ratified.

Instance: ExampleSuicideRiskConceptFromASQ
InstanceOf: SPiERSuicideRiskConcept
Title: "Example — Suicide Risk Concept derived from a non-acute positive ASQ"
Description: "Illustrative harmonized concept Observation: a non-acute positive ASQ screen mapped to the moderate tier, derived from the ASQ result Observation. Crosswalk pending clinical sign-off."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-06-05T14:20:00Z"
* derivedFrom[+] = Reference(ExampleASQResultNonAcutePositive)
* valueCodeableConcept = SPiERSuicideRiskTier#moderate "Moderate risk"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#POS "Positive"
* interpretation[=].text = "Non-acute positive ASQ screen mapped to the moderate tier (wider — ASQ cannot resolve finer severity). Illustrative; pending clinical sign-off."


Instance: ExampleSuicideRiskConceptFromCSSRS
InstanceOf: SPiERSuicideRiskConcept
Title: "Example — Suicide Risk Concept derived from a high-risk C-SSRS"
Description: "Harmonized concept Observation: a high-risk C-SSRS screener mapped to the high tier, derived from the C-SSRS risk-level Observation. Illustrative; pending clinical sign-off."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T11:00:00Z"
* derivedFrom[+] = Reference(ExampleCSSRSScreenerHighRisk)
* valueCodeableConcept = SPiERSuicideRiskTier#high "High risk"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#POS "Positive"


Instance: ExampleSuicideRiskConceptFromPHQ9
InstanceOf: SPiERSuicideRiskConcept
Title: "Example — Suicide Risk Concept derived from PHQ-9 Item 9"
Description: "Harmonized concept Observation: a PHQ-9 Item 9 score of 2 mapped to the moderate tier, derived from the PHQ-9 Item 9 Observation. Illustrative; pending clinical sign-off."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:30:00Z"
* derivedFrom[+] = Reference(ExamplePHQ9Item9Positive)
* valueCodeableConcept = SPiERSuicideRiskTier#moderate "Moderate risk"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#POS "Positive"


Instance: ExampleSuicideRiskConceptFromSBQR
InstanceOf: SPiERSuicideRiskConcept
Title: "Example — Suicide Risk Concept derived from SBQ-R"
Description: "Harmonized concept Observation: an SBQ-R total of 9 (above the inpatient cutoff) mapped to the high tier, derived from the SBQ-R total-score Observation. Illustrative; pending clinical sign-off."
Usage: #example
* status = #final
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://loinc.org#93374-7 "Suicide risk level"
* subject = Reference(Patient/example)
* effectiveDateTime = "2026-03-19T10:45:00Z"
* derivedFrom[+] = Reference(ExampleSBQRTotalScore9)
* valueCodeableConcept = SPiERSuicideRiskTier#high "High risk"
* interpretation[+] = http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation#POS "Positive"
