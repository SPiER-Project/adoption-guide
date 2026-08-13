// =============================================================
// Suicide-related problem-list Conditions
// =============================================================
// The last open bullet of #43 ("Condition / Problem codes → SNOMED CT"), and
// the shared answer to #77's child task "Verify SNOMED SCTIDs for any
// clinical-finding concepts used". Both wanted the same codes; picking them
// twice was the risk, so they are picked once, here, and the concept layer and
// the problem list both point at this ValueSet.
//
// ─── The scoping decision, which is most of the work ─────────
//
// "Use SNOMED for Conditions" is only actionable once you answer a prior
// question: WHICH suicide-related Conditions does SPiER assert at all? Three
// answers, and the first two are refusals.
//
// 1. A SCREEN NEVER BECOMES A CONDITION. A positive ASQ, C-SSRS, PHQ-9 item 9
//    or SBQ-R produces a SPiERSuicideRiskConcept Observation and nothing else.
//    SPiER does not derive a Condition from it, and no mapper in web/src does.
//    A problem-list entry is a clinician's assertion about a patient; a screen
//    is a signal that one may be warranted. Promoting the second into the first
//    manufactures diagnostic precision the instrument cannot support — the same
//    thing the concept layer refuses when it maps a low-fidelity instrument to
//    the widest defensible tier rather than the most alarming one. The concept
//    Observation already says "unconfirmed, warrants follow-up"; a Condition
//    would say "this patient has this problem", and SPiER has no basis for that.
//
// 2. THE CAMS DRIVER STAYS NARRATIVE. SPiERCAMSSuicideDriver keeps
//    `code.text 1..1` and gains no required coding. A driver is idiographic —
//    "relationship conflict with spouse — feeling trapped and hopeless" — and
//    no terminology has concepts at that granularity. Forcing a code would
//    replace the clinical content with a coarser label that is not what the
//    clinician and patient identified. `code.coding` is opened to this ValueSet
//    as OPTIONAL, so a site whose problem list needs a coded row can add one
//    alongside the text, but the text is what carries the meaning.
//
// 3. A CLINICIAN-ASSERTED SUICIDE-RELATED PROBLEM IS CODED, and that is what
//    the profile below is for. When a clinician does put "Suicidal ideation" on
//    the problem list, every SPiER site should write the same SCTID — otherwise
//    the registry query in Stage 7 and the measures in Stage 8 see different
//    codes for the same finding across sites, which is precisely the
//    non-comparability quality measurement exists to prevent.
//
// ─── Verification, and why it is stated explicitly ───────────
//
// Every SCTID below was verified against tx.fhir.org on 2026-08-08 by
// `$lookup` (for the Fully Specified Name, to confirm the concept means what
// the display suggests and sits in the right hierarchy) and by
// `$validate-code` with the exact display written here.
//
// This is written out because #220 is what the alternative costs: six
// fabricated LOINC codes plus 81344-4, which is a real code meaning
// "healthcare agent authority to inspect and disclose …" and therefore
// validated cleanly for months while meaning something else entirely.
//
// The same trap is live in this exact subject area. 86849004 is widely
// mis-cited as "suicide attempt"; its FSN is "Suicidal poisoning (disorder)",
// so it is a real code that would validate structurally and silently narrow
// every attempt on the problem list to a poisoning. The correct code is
// 82313006. `$validate-code` rejects the pairing outright —
//
//   FAIL 86849004 "Suicide attempt"
//     << Wrong Display Name 'Suicide attempt' for http://snomed.info/sct#86849004.
//        Valid display is one of 4 choices: 'Suicidal poisoning' (en), …
//
// — which is the negative control for the nightly `npm run check:codings`
// gate: the mistake this file exists to avoid is one the gate demonstrably
// catches rather than one it is merely assumed to.
//
// ─── Depression: verified, deliberately not bound ────────────
//
// #43 named depression alongside the suicide-specific concepts. The code is
// 35489007 "Depressive disorder" (FSN "Depressive disorder (disorder)"),
// verified the same way as the rest and recorded in
// docs/terminology-manifest.json so the nightly gate keeps checking it.
//
// It is NOT a member of the ValueSet below, and the omission is a decision
// rather than an oversight. A depressive disorder is a co-occurring diagnosis,
// not a suicide-related finding, and putting it in a set bound to a
// suicide-related profile invites exactly the inference this file spent its
// first section refusing — PHQ-9 scores 14, therefore assert "Depressive
// disorder" on the problem list. PHQ-9 is a severity screen; a depressive
// disorder is a diagnosis, and SPiER has no basis to make it. Sites that do
// carry depression on the problem list should use 35489007, which is why it is
// verified and recorded here; SPiER simply does not assert it.
// =============================================================


// ─── ValueSet: suicide-related problem-list concepts ─────────
// Enumerated rather than expressed as a SNOMED subsumption query (`descendants
// of 6471006`, say) on purpose. An intensional definition would drift as SNOMED
// releases, and would pull in concepts nobody reviewed; the point of this set
// is that a human checked every member. It is `extensible`, so a site with a
// finding genuinely outside the list is not blocked.
//
// Ordered as the clinical progression a pathway actually walks: risk status,
// then ideation → plan → intent → behavior → attempt, then history, then
// self-harm that is not attempt-directed.

ValueSet: SPiERSuicideRelatedProblem
Id: spier-suicide-related-problem-vs
Title: "SPiER Suicide-Related Problem"
Description: "Verified SNOMED CT concepts for suicide-related findings that may appear on a patient's problem list. Every member was checked against the publishing authority — see the header of suicide-related-conditions.fsh for the verification record. Screening and assessment results are NOT in scope: those are SPiERSuicideRiskConcept Observations, and SPiER never derives a Condition from a screen."
* ^status = #draft
* ^experimental = true

// Risk status. SPiER's own expression of risk is the concept-layer Observation
// (LOINC 93374-7 + tier), not this code — it is here because some sites carry
// risk status on the problem list, and when they do they should use this one.
* http://snomed.info/sct#225444004 "At increased risk for suicide"

// Ideation through attempt.
* http://snomed.info/sct#6471006 "Suicidal thoughts"
* http://snomed.info/sct#247650009 "Planning suicide"
* http://snomed.info/sct#304594002 "Suicidal intent"
* http://snomed.info/sct#425104003 "Suicidal behavior"
* http://snomed.info/sct#82313006 "Suicide attempt"

// History. A past attempt is the single strongest predictor of a future one, so
// it earns a distinct code rather than a resolved `Suicide attempt` row —
// `clinicalStatus = resolved` on an attempt says the attempt is over, which is
// not the same claim as "this patient has a history of attempt".
* http://snomed.info/sct#23233009 "Previous known suicide attempt"

// Self-harm. Two codes because the behavior and the injury are different
// assertions and a problem list may legitimately carry either: the pattern of
// behavior, or a specific injury resulting from it. Neither implies suicidal
// intent — which is why they are not folded into the ideation group above.
* http://snomed.info/sct#248062006 "Self-injurious behavior"
* http://snomed.info/sct#276853009 "Self inflicted injury"


// ─── Condition profile: clinician-asserted suicide-related problem ───

Profile: SPiERSuicideRelatedCondition
Parent: Condition
Id: spier-suicide-related-condition
Title: "SPiER Suicide-Related Condition"
Description: "A suicide-related finding asserted by a clinician and carried on the patient's problem list. This profile is for clinician assertions only — a positive screening or assessment result is a SPiERSuicideRiskConcept Observation, and SPiER does not derive a Condition from one. `verificationStatus` is required so that a consumer can tell an assertion apart from a provisional or differential one without inferring it from context."
* ^status = #draft
* ^experimental = true

* clinicalStatus 1..1
* verificationStatus 1..1
* category 1..*
* category.coding 1..*
* code 1..1
// Extensible, not required: the enumerated set is the reviewed one, but a real
// problem list will eventually carry a suicide-related finding nobody
// anticipated, and blocking it would push sites into `code.text` — losing the
// coding for the nine concepts that ARE covered along with the one that is not.
* code from SPiERSuicideRelatedProblem (extensible)

// Must-Support — a producer SHALL populate these; a consumer SHALL process them.
* clinicalStatus MS
* verificationStatus MS
* category MS
// Standard `problem-list-item` condition category + the Gravity-pattern domain
// tag, so this resource is retrievable with the rest of the suicide-safer care
// record by category alone (#262).
* insert ProblemListAndSuicideRiskCategory
* code MS
* subject MS
* subject 1..1
* subject only Reference(Patient)


// ─── Examples ────────────────────────────────────────────────

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
