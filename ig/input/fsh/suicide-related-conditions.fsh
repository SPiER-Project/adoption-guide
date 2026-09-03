// Suicide-related problem-list Conditions
//
// One place where the suicide-related SNOMED concepts are picked, so the
// concept layer and the problem list cannot pick them twice and differently.
// The reasoning is PUBLISHED and is the substance of this file — do not restate
// it. conformance.md carries the scoping decision (what SPiER asserts and what
// it refuses to), being conformance statements; design-decisions.md carries the
// enumerated-vs-subsumption choice, the per-group reasoning, and why depression
// (35489007) is verified but deliberately not a member.
//
// ⚠️ VERIFY EVERY SCTID AT SOURCE before adding one — $lookup for the Fully
// Specified Name AND $validate-code with the exact display. A code meaning
// something adjacent validates silently: 86849004 is widely mis-cited as
// "suicide attempt", but its FSN is "Suicidal poisoning (disorder)", which
// would narrow every attempt on the problem list to a poisoning. 82313006 is
// correct, and that pairing is the negative control for the nightly terminology
// gate. Record new codes in docs/terminology-manifest.json or it stops watching
// them.

// Membership, ordering and the per-group reasoning are on design-decisions.md.
// ⚠️ The grouping is not cosmetic: the self-harm pair implies no suicidal
// intent, which is why it is not folded into the ideation group.

ValueSet: SPiERSuicideRelatedProblem
Id: spier-suicide-related-problem-vs
Title: "SPiER Suicide-Related Problem"
Description: "Verified SNOMED CT concepts for suicide-related findings that may appear on a patient's problem list. Every member was checked against the publishing authority by $lookup and $validate-code, and the guide says so because the alternative has a price — a real code that means something adjacent validates cleanly while narrowing the finding. Enumerated rather than defined as a subsumption query so that a person reviewed each member; extensible, so a site with a finding outside the list is not blocked. Ordered as the clinical progression a pathway walks. See the Design decisions page for why depression is verified but not a member."
* ^status = #draft
* ^experimental = true

// Risk status.
* http://snomed.info/sct#225444004 "At increased risk for suicide"

// Ideation through attempt.
* http://snomed.info/sct#6471006 "Suicidal thoughts"
* http://snomed.info/sct#247650009 "Planning suicide"
* http://snomed.info/sct#304594002 "Suicidal intent"
* http://snomed.info/sct#425104003 "Suicidal behavior"
* http://snomed.info/sct#82313006 "Suicide attempt"

// History — deliberately a distinct code, not a resolved `Suicide attempt`.
* http://snomed.info/sct#23233009 "Previous known suicide attempt"

// Self-harm — behaviour and injury are different assertions; neither implies
// suicidal intent.
* http://snomed.info/sct#248062006 "Self-injurious behavior"
* http://snomed.info/sct#276853009 "Self inflicted injury"



Profile: SPiERSuicideRelatedCondition
Parent: Condition
Id: spier-suicide-related-condition
Title: "SPiER Suicide-Related Condition"
Description: "A suicide-related finding asserted by a clinician and carried on the patient's problem list. This profile is for clinician assertions only — a positive screening or assessment result is a SPiERSuicideRiskConcept Observation, and SPiER does not derive a Condition from one. `verificationStatus` is required so that a consumer can tell an assertion apart from a provisional or differential one without inferring it from context. The `code` binding is extensible rather than required: the enumerated set is the reviewed one, but a real problem list will eventually carry a suicide-related finding nobody anticipated, and blocking it would push sites into `code.text` — losing the coding for the nine concepts that ARE covered along with the one that is not."
* ^status = #draft
* ^experimental = true

* clinicalStatus 1..1
* verificationStatus 1..1
* category 1..*
* category.coding 1..*
* code 1..1
// Extensible, not required — see the profile Description for why.
* code from SPiERSuicideRelatedProblem (extensible)

// Must-Support — producer SHALL populate, consumer SHALL process.
* clinicalStatus MS
* verificationStatus MS
* category MS
// Standard `problem-list-item` category + the domain tag, so this resource is
// retrievable with the rest of the record by category alone.
* insert ProblemListAndSuicideRiskCategory
* code MS
* subject MS
* subject 1..1
* subject only Reference(Patient)



Instance: ExampleSuicidalIdeationProblem
InstanceOf: SPiERSuicideRelatedCondition
Title: "Example — Suicidal Ideation on the Problem List"
Description: "A clinician-asserted, confirmed suicidal-ideation problem. Note what is NOT here: no derivedFrom, no link to a screening result. This is an assertion in its own right, made after assessment — not a transformation of the ASQ that prompted it."
Usage: #example
* clinicalStatus = http://terminology.hl7.org/CodeSystem/condition-clinical#active "Active"
* verificationStatus = http://terminology.hl7.org/CodeSystem/condition-ver-status#confirmed "Confirmed"
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://snomed.info/sct#6471006 "Suicidal thoughts"
* subject = Reference(Patient/example)
* recordedDate = "2026-03-14"
* note[+].text = "Asserted after a clarifying C-SSRS assessment, not off the initial screen. The screen result is recorded separately as a SPiERSuicideRiskConcept Observation."


Instance: ExamplePreviousSuicideAttemptProblem
InstanceOf: SPiERSuicideRelatedCondition
Title: "Example — History of Suicide Attempt on the Problem List"
Description: "A history-of finding, active as a standing risk factor. Carried as `Previous known suicide attempt` with clinicalStatus active, rather than as a resolved `Suicide attempt` — the attempt is over, the history is not."
Usage: #example
* clinicalStatus = http://terminology.hl7.org/CodeSystem/condition-clinical#active "Active"
* verificationStatus = http://terminology.hl7.org/CodeSystem/condition-ver-status#confirmed "Confirmed"
* category[suicideRisk] = SPiERConceptDomain#suicide-risk
* code = http://snomed.info/sct#23233009 "Previous known suicide attempt"
* subject = Reference(Patient/example)
* recordedDate = "2026-03-14"
