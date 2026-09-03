// Safety-plan section codes
//
// Shared section identity for the two narrative safety-plan CarePlans SPiER
// produces: the Stanley-Brown Safety Plan (seven steps) and the Crisis
// Response Plan (five sections, Bryan & Rudd).
//
// The reasoning is PUBLISHED on design-decisions.md — why these codes are
// SPiER-local, why this system and cams-careplan-section stay separate, and
// why `87626-8` sits in `CarePlan.category` without claiming the plan is a
// document. Do not restate it here: that page is what a reader outside this
// repo can reach.
//
// ⚠️ DO NOT mint a LOINC code for a section. Seven were asserted here once and
// documented as verified: six did not exist, and `81344-4` is real but means
// "healthcare agent authority to inspect and disclose …", so it validated
// cleanly for months while meaning something else (issue #220). Every use below
// is tagged #no-standard-binding via coding-verification-status.

CodeSystem: SafetyPlanSectionCodes
Id: safety-plan-section
Title: "Safety Plan Section Codes"
Description: "SPiER-local section codes identifying which section of a narrative safety-plan CarePlan an activity represents. Shared by the Stanley-Brown Safety Plan and the Crisis Response Plan. Local rather than LOINC because an exhaustive search of LOINC 2.82 found no published concepts at this granularity — the Design decisions page records the search performed and the near-misses rejected, including the emergency-contact panel that would fit if these steps were ever modelled as structured contacts."
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
