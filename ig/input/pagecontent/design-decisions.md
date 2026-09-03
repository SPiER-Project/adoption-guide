# Design decisions

Some of the choices behind these artifacts are not visible from any single one
of them: a code system is local because a search of a standard one came up
empty, an element is required rather than optional because an optional version
would not answer the question it exists to answer, a status code is allowed to
say *unknown* because the alternative is a confident guess.

This page collects those decisions. It is not a conformance statement — the
rules an implementation must follow are on [Conformance](conformance.html),
and where a decision has already become a rule, this page links there rather
than restating it.

## Terminology: when SPiER mints its own codes

SPiER's default is to use a published code. Where it does not, the reason is
recorded, because a local code is a cost imposed on every consumer.

### Safety-plan sections are SPiER-local

The [safety-plan section codes](CodeSystem-safety-plan-section.html) identify
which section of a narrative safety plan an activity belongs to — a warning
sign, a coping strategy, a crisis contact. They are SPiER-local because LOINC
publishes nothing at that granularity.

That is a search result, not an assumption. LOINC 2.82 was expanded per section
against a terminology server for every phrasing the sections use: warning
sign, early warning, prodrome, crisis trigger, coping strategy,
self-management, distraction, social setting, crisis contact, support person,
crisis line, hotline, professional service, lethal means, means safety, means
restriction, access to means, firearm, secure storage, reason for living, worth
living, protective factor, safety planning, crisis response plan.

The near-misses are worth naming, because each is the kind of code a reviewer
would reasonably propose:

- **`44943-9` "Self management"** and **`44941-3` "Barriers to self
  management"** are generic care-plan concepts. Neither is the Stanley-Brown
  *internal coping* construct, which is specifically what a patient can do
  alone, without contacting anyone.
- **Every "reason for living" hit** — `61972-6`, `71025-1`, `91476-2`,
  `92083-5`, `68005-8` — is a *scaled survey item* measuring agreement over the
  past seven days. None is a slot for narrative content.
- **`56796-6` "Emergency contact information panel"** and its Name / Address /
  Phone / Relationship children are real, and would genuinely fit if SPiER
  modelled the crisis-support and professional-support steps as structured
  contacts rather than free text. That is a real future opportunity. It is not
  a section code.

Every use of these codes is tagged with SPiER's coding-verification-status
extension as `no-standard-binding` — the terminal state meaning *no published
code exists for this concept*, as distinct from *not yet checked*.

One real LOINC code does apply, but at document rather than section level:
`87626-8` "Suicide prevention note". See below.

### The two safety-plan section systems are kept separate

SPiER has a second section vocabulary, the
[CAMS care-plan sections](CodeSystem-cams-careplan-section.html), and four of
its codes overlap conceptually with the safety-plan set — lethal-means
reduction, coping strategies, emergency contact, support network.

They are separate on purpose. The CAMS sections are defined by the CAMS
framework, which orders and scopes them differently, while the safety-plan
codes follow the Stanley-Brown and Crisis Response Plan templates. Collapsing
them would make one framework's structure describe the other's document.

A consumer that needs to relate the two should expect a ConceptMap, which is
how SPiER relates vocabularies elsewhere — see the crosswalks listed under
[Harmonization status](conformance.html#harmonization-status). None is
published yet, because no consumer has needed one.

## `87626-8` in `CarePlan.category` is not a claim that the plan is a document

Both narrative safety-plan profiles —
[Stanley-Brown Safety Plan](StructureDefinition-spier-stanley-brown-safety-plan.html)
and [Crisis Response Plan](StructureDefinition-spier-crisis-response-plan.html)
— carry LOINC `87626-8` "Suicide prevention note" in `category`, alongside the
SNOMED treatment-escalation-plan code and the SPiER domain code.

The caveat matters, and it is not erased by the fact that the constraint is
required. `87626-8` is a LOINC **document-type** concept, and its most precise
home would be `Composition.type` or `DocumentReference.type`. SPiER carries it
in `CarePlan.category`, whose binding is `example`, so this is legal — and it
is done for one reason: discoverability by suicide-prevention consumers
querying for the plan.

**A consumer SHALL NOT read it as a claim that the CarePlan is a document.**

The code is required on the two *narrative* plans only. The two CAMS plans
share the same underlying structure but do not carry it, because they are not
the same kind of artifact.

## The domain category is required, not optional

Every SPiER resource with a native `category` element carries the same domain
coding in addition to its own clinical category, so that one query assembles
the whole suicide-safer care record. [Quick Starts](quick-starts.html) has the
searches, including why `Appointment` differs.

The decision recorded here is that the domain slice is **`1..1`, not `0..1`**.

An optional domain tag would answer *"some of the record, sometimes"*, which is
not a queryable guarantee: a consumer could not distinguish a resource that was
never tagged from a patient who has no such resource. A query is only worth
issuing if a negative result means something, and that requires the tag to be
mandatory wherever the profile applies.

Two further properties of the rule, both deliberate:

- It is **additive**. No profile loses a category it already had. Standard
  categories such as `survey`, `procedure` and `problem-list-item` sit
  alongside the domain code rather than competing with it, and the slicing is
  open, so a resource may carry additional categories SPiER has not named.
- The domain axis and the pathway-stage axis are **orthogonal**. The domain
  says what a resource is about; the stage says where in the pathway it arose.
  Neither is derivable from the other.

Naming `survey` as a slice on the instrument Observations has a second
consequence worth knowing: it is the element
`us-core-observation-screening-assessment` requires, and it is therefore what
makes a SPiER instrument Observation conformant to the profile the HL7/ASTP US
Behavioral Health Profiles crosswalk names for its *Suicide Risk Assessment*
element. See
[Relationship to Other IGs](relationship-to-other-igs.html).

## `Observation.interpretation`: two vocabularies, not yet one

This is an open inconsistency rather than a settled decision, and it is
recorded here because a consumer reading `interpretation` across both layers
will meet it.

The [harmonized concept Observation](StructureDefinition-spier-suicide-risk-concept.html)
requires exactly one `interpretation`, extensibly bound to the standard FHIR
observation-interpretation value set. That set contains both of the pairs
below, so the profile does not choose between them:

- **The concept layer uses `POS` / `NEG`.** This is the Gravity Project and
  SDOH-aligned choice, and it is what a screening-level signal actually means:
  positive or negative for follow-up, not high or low on a scale.
- **The instrument layer uses `A`, `H` and `L`** — abnormal, high, low. These
  read a native instrument result against that instrument's own thresholds,
  which is a different kind of statement.

SPiER's own examples follow that split consistently. Nothing enforces it, and
harmonizing the two has not been done. Until it is, **a consumer SHOULD NOT
assume a single interpretation vocabulary across the two layers**, and SHOULD
read the `derivedFrom` chain to know which layer a given Observation belongs
to. [How to Read This Guide](how-to-read.html#two-layer-model) describes the
two layers.

## The suicide-related problem set is enumerated, not intensional

[SPiER Suicide-Related Problem](ValueSet-spier-suicide-related-problem-vs.html)
lists its nine SNOMED CT concepts explicitly rather than defining them as a
subsumption query such as *descendants of `6471006`*.

An intensional definition would be shorter and would drift with every SNOMED
release, pulling in concepts nobody reviewed. The whole value of this set is
that a person checked each member against the publishing authority — which is
also why [Conformance](conformance.html)
states what SPiER refuses to assert. The set is `extensible`, so a site with a
finding genuinely outside the list is not blocked.

The members are ordered as the clinical progression a pathway walks, and three
of the groupings carry a decision a site will otherwise have to make for
itself:

- **Risk status** — `225444004` "At increased risk for suicide". SPiER's own
  expression of risk is the concept-layer Observation, not this code. It is in
  the set because some sites do carry risk status on the problem list, and when
  they do they should use this concept rather than inventing one.
- **Ideation through attempt** — `6471006` thoughts, `247650009` planning,
  `304594002` intent, `425104003` behavior, `82313006` attempt.
- **History of attempt** — `23233009` "Previous known suicide attempt", which
  earns a distinct code rather than a resolved `Suicide attempt` row. Those are
  different claims: `clinicalStatus = resolved` on an attempt says the attempt
  is over, not that the patient has a history of one. A past attempt is the
  single strongest predictor of a future one, so a consumer must be able to
  find it without reasoning about clinical status.
- **Self-harm** — `248062006` "Self-injurious behavior" and `276853009` "Self
  inflicted injury". Two codes, because the pattern of behaviour and a specific
  resulting injury are different assertions and a problem list may legitimately
  carry either. **Neither implies suicidal intent**, which is why they are not
  folded into the ideation group.

### Depression is verified but deliberately not bound

`35489007` "Depressive disorder" was verified the same way as every member of
the set above, and SPiER records it so that sites carrying depression on the
problem list use that code. **It is not a member of the value set.**

The omission is a decision. A depressive disorder is a co-occurring diagnosis,
not a suicide-related finding, and putting it in a set bound to a
suicide-related profile invites exactly the inference the guide refuses
elsewhere: *PHQ-9 scores 14, therefore assert "Depressive disorder"*. The PHQ-9
is a severity screen; a depressive disorder is a diagnosis. SPiER has no basis
to make it.

## Licensing status is a code, and it is allowed to say "unknown"

Every [ActivityDefinition](artifacts.html) carries two licensing facts: a
`copyright` notice in prose, and a coded
[instrument-licensing-status](StructureDefinition-instrument-licensing-status.html)
extension carrying the same fact in one filterable value.

**Why an extension and not `copyrightLabel`.** `ActivityDefinition.copyrightLabel`
is an R5 element, and this guide is R4, so it does not exist here. A short
free-text label would in any case be weaker than a bound code, since the point
of the field is that an adopter can filter on it. If SPiER moves to R5, the
right migration is to populate `copyrightLabel` from the code's display and
keep the coded extension as the machine-readable half.

**The status may be `unknown`, and that is not a synonym for unrestricted.** It
is a positive statement that SPiER's licensing audit has not established the
answer. Each `copyright` notice names where its claim comes from — a filed
licensing memo, or a notice recorded on the corresponding questionnaire and not
verified at source, or an explicit statement that the status is unknown.

**What adopters should know about the limits of these claims.** Every status
traces to something recorded, but **none has been checked against what the
rights holder publishes today**, and four instruments — PHQ-9, SBQ-R, CAMS and
Stanley-Brown — have no audit memo at all. An adopter SHALL verify licensing
against the rights holder's current terms before deploying an instrument. Do
not read a status here as clearance.

## Placeholder ActivityDefinitions carry no codes on purpose

A few pathway steps are published as minimal ActivityDefinitions carrying only
structural metadata: url, name, version, title, status, description, purpose
and kind. They deliberately carry **no** LOINC or SNOMED codes, **no**
questionnaire binding, and **no** derived-Observation profile.

That is not an oversight to be filled in with plausible values. Each of those
would require verified terminology and an authored questionnaire, and inventing
them is how a guide comes to assert things nothing verified. The placeholder
says what SPiER can say today: that the pathway has this step, what it is for,
and what kind of activity it is.

The consequence for a consumer: a code-less ActivityDefinition is a catalogue
entry, not a modelled instrument. Its stage membership is still real — it is
referenced by exactly one stage PlanDefinition action, like every other
activity — so it appears in the pathway, and
[Care Pathway](care-pathway.html) shows where.
