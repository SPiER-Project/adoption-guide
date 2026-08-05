// =============================================================
// Safety-plan section codes
// =============================================================
// Shared section identity for the two narrative safety-plan CarePlans SPiER
// produces: the Stanley-Brown Safety Plan (seven steps) and the Crisis
// Response Plan (five sections, Bryan & Rudd). Both are section-structured
// documents whose activities were previously identified only by English prose
// in `detail.code.text`, or — worse — by LOINC codes that do not exist.
//
// ─── Why these codes are SPiER-local ─────────────────────────
//
// The repo previously asserted six LOINC codes for these sections (76689-1,
// 76690-9, 76691-7, 76692-5, 76693-3, 76694-1) plus 81344-4 for "reason for
// living", and documented all seven as verified in
// FHIR-Resources/Stanley-Brown/README.md's "Clinical Mapping Audit Table".
// None of that verification happened:
//
//   * the six 766xx-x codes DO NOT EXIST in LOINC — confirmed against LOINC
//     2.82 by both the IG Publisher and tx.fhir.org's $validate-code;
//   * 81344-4 is real but means "Healthcare agent authority to inspect and
//     disclose mental and physical health information Narrative - Reported".
//     It resolves, so nothing flagged it, and a receiving system would have
//     read reasons-for-living content as disclosure authority.
//
// See issue #220. Before minting anything here, LOINC 2.82 was searched
// exhaustively per section via tx.fhir.org $expand — `warning sign(s)`,
// `early warning`, `prodrome`, `crisis trigger`, `coping strateg`,
// `self-management`, `distraction`, `social setting`, `crisis contact`,
// `support person`, `crisis line`, `hotline`, `professional service`,
// `lethal means`, `means safety`, `means restriction`, `access to means`,
// `firearm`, `secure storage`, `reason(s) for living`, `worth living`,
// `protective factor`, `safety plan(ning)`, `crisis response plan`.
//
// Result: LOINC publishes nothing at safety-plan-section granularity. The
// nearest real concepts are all the wrong kind of thing —
//   * 44943-9 "Self management" / 44941-3 "Barriers to self management" are
//     generic care-plan concepts, not the Stanley-Brown coping construct;
//   * every "reason for living" hit (61972-6, 71025-1, 91476-2, 92083-5,
//     68005-8) is a *scaled survey item* measuring agreement over the past
//     7 days, not a slot for narrative content;
//   * 56796-6 "Emergency contact information panel" and its Name/Address/
//     Phone/Relationship children are real and would fit if SPiER ever models
//     steps 4 and 5 as structured contacts rather than free text — a genuine
//     future opportunity, but not a section code.
//
// So every section code here is deliberately SPiER-local, exactly as
// cams-careplan-section (#95 / PR #219) is, and each use is tagged
// #no-standard-binding via the coding-verification-status extension —
// the terminal state meaning "no published code exists for this concept".
//
// One real LOINC code *does* apply, at document rather than section level:
// 87626-8 "Suicide prevention note" ($validate-code confirmed, LOINC 2.82).
// Both CarePlan profiles carry it in `category` alongside the SNOMED
// treatment-escalation-plan code. Note the modelling caveat: 87626-8 is a
// LOINC document-type concept whose most precise home would be
// Composition.type or DocumentReference.type. CarePlan.category has only an
// example binding, so this is legal and useful for discovery, but a consumer
// should not read it as a claim that the CarePlan *is* a document.
//
// ─── Overlap with cams-careplan-section ──────────────────────
//
// cams-careplan-section carries #lethal-means-reduction, #coping-strategies,
// #emergency-contact and #support-network, which overlap conceptually with
// codes here. The two systems are kept separate on purpose: CAMS sections are
// defined by the CAMS framework (and its Stabilization Plan orders and scopes
// them differently), while these follow the Stanley-Brown/CRP templates.
// Collapsing them would have meant re-coding the just-landed #219 artifacts.
// A ConceptMap between the two is the right way to relate them if a consumer
// ever needs it — see the crosswalk-*.fsh files for the established pattern.
// =============================================================


CodeSystem: SafetyPlanSectionCodes
Id: safety-plan-section
Title: "Safety Plan Section Codes"
Description: "SPiER-local section codes identifying which section of a narrative safety-plan CarePlan an activity represents. Shared by the Stanley-Brown Safety Plan and the Crisis Response Plan. Local rather than LOINC because an exhaustive search of LOINC 2.82 found no published concepts at this granularity — see the file header for the search performed and the near-misses rejected."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #warning-signs "Warning Signs" "Thoughts, images, mood, situations or behaviours the patient identifies as signalling that a crisis may be developing. Step 1 of the Stanley-Brown Safety Plan; section 1 of the Crisis Response Plan."
* #internal-coping "Internal Coping Strategies" "Things the patient can do alone, without contacting another person, to take their mind off their problems. Step 2 of the Stanley-Brown Safety Plan; section 2 of the Crisis Response Plan."
* #social-distraction "Social Distractions" "People and social settings that help take the patient's mind off their problems — distraction rather than disclosure. Step 3 of the Stanley-Brown Safety Plan."
* #crisis-support "Crisis Support Contacts" "Family members or friends the patient can ask directly for help during a crisis. Step 4 of the Stanley-Brown Safety Plan; the 'social support' section of the Crisis Response Plan."
* #professional-support "Professional Support" "Clinicians, agencies, crisis lines (988) and local emergency-department contact details the patient can reach during a crisis. Step 5 of the Stanley-Brown Safety Plan; the 'professional and crisis support' section of the Crisis Response Plan."
* #lethal-means-safety "Lethal Means Safety" "Steps agreed to make the patient's environment safer by restricting access to lethal means. Step 6 of the Stanley-Brown Safety Plan."
* #reason-for-living "Reason for Living" "What the patient identifies as most important to them and worth living for. Step 7 of the Stanley-Brown Safety Plan (added in the 2021 clinical update); section 3 of the Crisis Response Plan."


ValueSet: StanleyBrownSafetyPlanSection
Id: stanley-brown-safety-plan-section
Title: "Stanley-Brown Safety Plan Section"
Description: "The seven steps of a Stanley-Brown Safety Plan, as used in CarePlan.activity.detail.code."
* ^status = #draft
* ^experimental = true
* SafetyPlanSectionCodes#warning-signs
* SafetyPlanSectionCodes#internal-coping
* SafetyPlanSectionCodes#social-distraction
* SafetyPlanSectionCodes#crisis-support
* SafetyPlanSectionCodes#professional-support
* SafetyPlanSectionCodes#lethal-means-safety
* SafetyPlanSectionCodes#reason-for-living


ValueSet: CrisisResponsePlanSection
Id: crisis-response-plan-section
Title: "Crisis Response Plan Section"
Description: "The five sections of a Crisis Response Plan (Bryan & Rudd), as used in CarePlan.activity.detail.code. A subset of the Stanley-Brown section codes — the CRP template has no separate social-distraction or lethal-means section."
* ^status = #draft
* ^experimental = true
* SafetyPlanSectionCodes#warning-signs
* SafetyPlanSectionCodes#internal-coping
* SafetyPlanSectionCodes#reason-for-living
* SafetyPlanSectionCodes#crisis-support
* SafetyPlanSectionCodes#professional-support
