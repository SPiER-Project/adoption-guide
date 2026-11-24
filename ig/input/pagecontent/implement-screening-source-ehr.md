For a team building the [Screening-Source EHR](CapabilityStatement-screening-source-ehr.html)
role: the system that captures an instrument and writes the SPiER resources.
This page gives the path SPiER demonstrates end to end, what to write at each
step, and what to add after it.

A source can claim the role with one instrument and the risk concept; the
rule is on [Conformance](conformance.html#source-minimum). The path below uses
two instruments because that is the pair the pathway demonstrates end to end.
Step 1 alone meets the minimum.

### The starting path

Two instruments and one derived concept: the pair the
[Care Pathway](care-pathway.html) names on its first two steps.

| Step | You load | You write | Worked example |
|---|---|---|---|
| **1. Screen** | [PHQ-9](Questionnaire-PHQ-9.html) | the response, the [total score](StructureDefinition-spier-phq9-total-score.html), [item 9](StructureDefinition-spier-phq9-item9.html), and a [risk concept](StructureDefinition-spier-suicide-risk-concept.html) | [response](QuestionnaireResponse-ExamplePHQ9Response.html) → [total score](Observation-ExamplePHQ9TotalScore18.html), [item 9](Observation-ExamplePHQ9Item9Positive.html) → [concept](Observation-ExampleSuicideRiskConceptFromPHQ9.html) |
| **2. Assess**, when item 9 is 1 or more | [C-SSRS Screener](Questionnaire-C-SSRS-Screener.html) | the response, the [C-SSRS risk level](StructureDefinition-spier-cssrs-risk-level.html), and a second [risk concept](StructureDefinition-spier-suicide-risk-concept.html) | [response](QuestionnaireResponse-ExampleCSSRSScreenerResponse.html) → [risk level](Observation-ExampleCSSRSScreenerHighRisk.html) → [concept](Observation-ExampleSuicideRiskConceptFromCSSRS.html) |
| **3. Act on the tier** | the [pathway](PlanDefinition-SPiERSuicideSaferCarePathway.html) | whatever the patient's tier is owed | see [Step 3](#step-3) |

The worked examples are one patient on one day, so they can be read in order
as a single record.

### Step 1: screen with the PHQ-9 {#step-1}

Any SDC-capable form filler can render the Questionnaire. Each answer is a
coded choice carrying an ordinal weight of 0 to 3.

- **Total score.** The form computes it: the `total-score` item is hidden,
  read-only and filled by a `calculatedExpression` that sums the nine weights.
  The item is flagged `observationExtract`, so an SDC extractor produces the
  Observation on LOINC `44261-6`. Without one, write it yourself from the
  item's value.
- **Item 9.** The Questionnaire declares no extraction for item 9, so the
  source writes this Observation: LOINC `44260-8`, an integer value equal to
  the answer's weight, and `derivedFrom` the response.
- **Risk concept.** Apply
  [PHQ-9 Item 9 → Concept](StructureMap-PHQ9Item9ToSuicideRiskConcept.html):
  0 is `no-risk` (interpretation `NEG`); 1 is `low`, 2 is `moderate` and 3 is
  `high` (all `POS`). The concept is `derivedFrom` the item 9 Observation.
  Only item 9 maps; the total score measures depression severity and does not.

Item 9 at 1 or more is the positive screen that leads to Step 2.

### Step 2: assess with the C-SSRS Screener {#step-2}

Six yes/no items. Each answer is a coded choice of SNOMED CT Yes or No, not a
boolean.

- **Item answers.** Items 1 to 6 are flagged `observationExtract`, so an
  extractor produces one Observation per item on that item's LOINC code. SPiER
  publishes no profile for these.
- **Risk level.** The `risk-level` item is hidden and read-only, and its
  [Tier Derivation](StructureDefinition-tier-derivation.html) is `computed`:
  no form filler collects it, and a response without it is conformant. The
  source computes it from the published triage points and writes it on LOINC
  `93374-7`:

  | Answers | Risk level |
  |---|---|
  | No item positive | `none` |
  | Item 1 or 2 positive | `low` |
  | Item 3 positive, or item 6 positive but not in the past three months | `moderate` |
  | Item 4 or 5 positive, or item 6 positive in the past three months | `high` |

  The highest row that applies wins. `none` is a value of the result
  Observation only: the form's hidden `risk-level` item offers `low`,
  `moderate` and `high`, so a response with no positive item leaves it
  unanswered. The example also carries the matching LOINC answer code as a
  second coding.
- **Risk concept.** Translate the risk level with
  [C-SSRS Risk Level → Risk Tier](ConceptMap-CSSRSRiskLevelToRiskTier.html):
  `none` becomes `no-risk`, and `low`, `moderate` and `high` keep their names.
  [C-SSRS Risk Level → Concept](StructureMap-CSSRSRiskLevelToSuicideRiskConcept.html)
  shapes the Observation, which is `derivedFrom` the risk-level Observation.

The patient now has two risk concepts, one per instrument. The pathway reads
the most recent.

### What every Observation carries

- `status` of `final`, a subject, a date and a value.
- Two categories: the standard `survey`, and the SPiER `suicide-risk` domain
  category.
- On the risk concept only: an `interpretation` and at least one
  `derivedFrom`.

The C-SSRS risk level and the risk concept share LOINC `93374-7`. They differ
in the code system of their value; see
[Known limitations](harmonization-and-limitations.html#known-limitations).

A screen never becomes a `Condition`. A problem-list entry is a clinician's
assertion; see [Conformance](conformance.html).

### Step 3: act on the tier {#step-3}

The [Care Pathway](care-pathway.html) attaches obligations to the tier, not to
the instrument that produced it. For `low`, `moderate` and `high`:

- **Every tier:** share crisis resources, recorded as
  [Crisis Resources Shared](StructureDefinition-spier-crisis-resources-shared.html).
- **Moderate and high:** complete a collaborative safety plan, recorded as a
  [Stanley-Brown Safety Plan](StructureDefinition-spier-stanley-brown-safety-plan.html).
- **Every tier:** reassess on the tier's cadence, published once in the
  [Reassessment Schedule](PlanDefinition-SPiERReassessmentSchedule.html).

A system that stops at Step 2 still produces data a
[Risk Consumer](CapabilityStatement-risk-consumer.html) can read.

### What to add next, by stage {#stages}

SPiER groups its artifacts into eight stages. Steps 1 and 2 above are stages 1
and 2; the tier is stage 3. Stages 1 and 2 are the *Capture* layer, the risk
concept is *Translate*, and the pathway is *Act*
([Reading the artifacts](how-to-read.html#capture-translate-act)).

| Stage | What a source adds | Profiles |
|---|---|---|
| 1. Identify Possible Risk | other screens | [Instruments](instruments.html) |
| 2. Clarify Risk | other assessments | [Instruments](instruments.html) |
| 3. Define the Risk Picture | the tier; a clinician's problem-list entry | [Risk Concept](StructureDefinition-spier-suicide-risk-concept.html), [Suicide-Related Condition](StructureDefinition-spier-suicide-related-condition.html) |
| 4. Document Safety Actions | safety plans, lethal-means counseling, crisis resources | [Stanley-Brown](StructureDefinition-spier-stanley-brown-safety-plan.html), [Crisis Response Plan](StructureDefinition-spier-crisis-response-plan.html), [Lethal-Means Counseling](StructureDefinition-spier-lethal-means-counseling.html), [Crisis Resources Shared](StructureDefinition-spier-crisis-resources-shared.html) |
| 5. Coordinate Handoffs | handoff, discharge packet, referral, follow-up appointment, sharing consent | [Safety Handoff](StructureDefinition-spier-safety-handoff.html), [Discharge Safety Packet](StructureDefinition-spier-discharge-safety-packet.html), [Safety Referral](StructureDefinition-spier-safety-referral.html), [Follow-Up Appointment](StructureDefinition-spier-follow-up-appointment.html), [Sharing Consent](StructureDefinition-spier-information-sharing-consent.html) |
| 6. Track Follow-Up | outreach attempts and caring contacts | [Outreach Attempt](StructureDefinition-spier-outreach-attempt.html), [Caring Contact](StructureDefinition-spier-caring-contact.html) |
| 7. Track Risk Over Time | the episode, its encounters, the chart flag, open safety tasks | [Risk Episode](StructureDefinition-spier-suicide-risk-episode.html), [Encounter](StructureDefinition-spier-encounter.html), [Risk Flag](StructureDefinition-spier-suicide-risk-flag.html), [Safety Task](StructureDefinition-spier-safety-task.html) |
| 8. Measure and Share | nothing new to write; the measures read the stages above | the [Quality Reporter](CapabilityStatement-quality-reporter.html) role and [Measures](measurement.html) |

Stage 7 is the natural second milestone: the pathway reads the patient's
current tier from the episode, and the measures use the episode as their
cohort.

### Before you ship

- **Licensing.** The C-SSRS is copyrighted and permission-based, and the PHQ-9
  notice has not been checked against the publisher's current terms. Read each
  instrument's ActivityDefinition
  ([PHQ-9](ActivityDefinition-AdministerPHQ9.html),
  [C-SSRS Screener](ActivityDefinition-AdministerCSSRSScreener.html)) and
  [Licensing](index.html#licensing) before deploying either.
- **Tier assignments are illustrative.** No crosswalk has clinical sign-off;
  validate both against your own protocol
  ([Harmonization status](harmonization-and-limitations.html#harmonization-status)).
- **Validate what you write.** [Getting Started](getting-started.html) has the
  validator command; run it against each profile above.
