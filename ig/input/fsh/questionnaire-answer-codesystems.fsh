// =============================================================
// Questionnaire answer CodeSystems
// =============================================================
// SPiER-local code systems for the coded answer options used by the
// SBQ-R, C-SSRS (full), and ASQ Questionnaires. The codes/displays are
// taken verbatim from those Questionnaires' answerOption.valueCoding
// entries — formalizing the encodings the instruments already use so
// the IG is self-contained and the Questionnaires render/validate.
//
// (asq-screening-result is in asq.fsh; cssrs-risk-level is in cssrs.fsh —
// not repeated here.)
// =============================================================


// ─── SBQ-R answer scales ─────────────────────────────────────

CodeSystem: SBQRQ1Codes
Id: sbqr-q1
Title: "SBQ-R Item 1 Answers (lifetime ideation/attempt)"
Description: "Answer options for SBQ-R item 1."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #1 "Never"
* #2 "It was just a brief passing thought"
* #3a "I have had a plan at least once to kill myself but did not try to do it"
* #3b "I have had a plan at least once to kill myself and really wanted to die"
* #4a "I have attempted to kill myself, but did not want to die"
* #4b "I have attempted to kill myself, and really hoped to die"

CodeSystem: SBQRQ2Codes
Id: sbqr-q2
Title: "SBQ-R Item 2 Answers (frequency of ideation, past year)"
Description: "Answer options for SBQ-R item 2."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #1 "Never"
* #2 "Rarely (1 time)"
* #3 "Sometimes (2 times)"
* #4 "Often (3-4 times)"
* #5 "Very Often (5 or more times)"

CodeSystem: SBQRQ3Codes
Id: sbqr-q3
Title: "SBQ-R Item 3 Answers (threat of attempt)"
Description: "Answer options for SBQ-R item 3."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #1 "No"
* #2a "Yes, at one time, but did not really want to die"
* #2b "Yes, at one time, and really wanted to die"
* #3a "Yes, more than once, but did not want to do it"
* #3b "Yes, more than once, and really wanted to do it"

CodeSystem: SBQRQ4Codes
Id: sbqr-q4
Title: "SBQ-R Item 4 Answers (likelihood of future attempt)"
Description: "Answer options for SBQ-R item 4."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #0 "Never"
* #1 "No chance at all"
* #2 "Rather unlikely"
* #3 "Unlikely"
* #4 "Likely"
* #5 "Rather likely"
* #6 "Very likely"


// ─── C-SSRS (full) intensity / behavior scales ───────────────

CodeSystem: CSSRSFrequencyCodes
Id: cssrs-frequency
Title: "C-SSRS Frequency of Ideation"
Description: "Answer options for C-SSRS ideation frequency."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #1 "Less than once a week"
* #2 "Once a week"
* #3 "2-5 times in week"
* #4 "Daily or almost daily"
* #5 "Many times each day"

CodeSystem: CSSRSDurationCodes
Id: cssrs-duration
Title: "C-SSRS Duration of Ideation"
Description: "Answer options for C-SSRS ideation duration."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #1 "Fleeting - few seconds or minutes"
* #2 "Less than 1 hour / some of the time"
* #3 "1-4 hours / a lot of time"
* #4 "4-8 hours / most of day"
* #5 "More than 8 hours / persistent or continuous"

CodeSystem: CSSRSControllabilityCodes
Id: cssrs-controllability
Title: "C-SSRS Controllability of Ideation"
Description: "Answer options for C-SSRS ideation controllability."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #0 "Does not attempt to control thoughts"
* #1 "Easily able to control thoughts"
* #2 "Can control thoughts with little difficulty"
* #3 "Can control thoughts with some difficulty"
* #4 "Can control thoughts with a lot of difficulty"
* #5 "Unable to control thoughts"

CodeSystem: CSSRSDeterrentsCodes
Id: cssrs-deterrents
Title: "C-SSRS Deterrents"
Description: "Answer options for C-SSRS deterrents."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #0 "Does not apply"
* #1 "Deterrents definitely stopped you from attempting suicide"
* #2 "Deterrents probably stopped you"
* #3 "Uncertain that deterrents stopped you"
* #4 "Deterrents most likely did not stop you"
* #5 "Deterrents definitely did not stop you"

CodeSystem: CSSRSReasonsCodes
Id: cssrs-reasons
Title: "C-SSRS Reasons for Ideation"
Description: "Answer options for C-SSRS reasons for ideation."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #0 "Does not apply"
* #1 "Completely to get attention, revenge or a reaction from others"
* #2 "Mostly to get attention, revenge or a reaction from others"
* #3 "Equally to get attention/reaction and to end/stop the pain"
* #4 "Mostly to end or stop the pain"
* #5 "Completely to end or stop the pain"

CodeSystem: CSSRSLethalityCodes
Id: cssrs-lethality
Title: "C-SSRS Actual Lethality"
Description: "Answer options for C-SSRS actual lethality / medical damage of an attempt."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #0 "No physical damage or very minor physical damage"
* #1 "Minor physical damage (e.g., lethargic speech, first-degree burns, mild bleeding)"
* #2 "Moderate physical damage; medical attention needed"
* #3 "Moderately severe physical damage; medical hospitalization likely required"
* #4 "Severe physical damage; intensive care required"
* #5 "Death"

CodeSystem: CSSRSPotentialLethalityCodes
Id: cssrs-potential-lethality
Title: "C-SSRS Potential Lethality"
Description: "Answer options for C-SSRS potential lethality (when actual lethality is 0)."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #0 "Behavior not likely to result in injury"
* #1 "Behavior likely to result in injury but not likely to cause death"
* #2 "Behavior likely to result in death despite available medical care"


// ─── ASQ answer scales (referenced by the ASQ Questionnaire) ──

CodeSystem: ASQAttemptRecencyCodes
Id: asq-attempt-recency
Title: "ASQ Attempt Recency"
Description: "Answer options for the ASQ prior-attempt recency follow-up."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #within-12-months "Within last 12 months"
* #over-1-year "Over 1 year ago"

CodeSystem: ASQAgeGroupCodes
Id: asq-age-group
Title: "ASQ Age Group"
Description: "Age-group context for an ASQ administration."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete
* #youth "Youth (under 18)"
* #adult "Adult (18+)"
