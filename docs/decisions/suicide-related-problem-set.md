# The suicide-related problem set is enumerated, verified, and excludes depression

**Decided:** 2026-08 (published as rationale by
[#472](https://github.com/SPiER-Project/adoption-guide/pull/472)).
**Rule, as published:** Conformance § *The problem list*. **Artifacts:**
`ValueSet/spier-suicide-related-problem-vs`,
`StructureDefinition/spier-suicide-related-condition`, both in
[`suicide-related-conditions.fsh`](../../ig/input/fsh/suicide-related-conditions.fsh).

## A screen never becomes a Condition

A problem-list entry is a clinician's assertion about a patient; a screen is a
signal that one may be warranted. Deriving the first from the second
manufactures diagnostic precision the instrument cannot support — the same
fabrication the crosswalks refuse when they map a low-fidelity instrument to
the widest defensible tier rather than the most alarming one. So SPiER derives
no `Condition` from any screen, and no mapper in the app does either.

## Why `verificationStatus` is required and `code` is extensible

`verificationStatus` is required so that a consumer can tell a confirmed assertion
apart from a provisional or differential one without inferring it from context.
The `code` binding is extensible rather than required: the enumerated set is the
reviewed one, but a real problem list will eventually carry a suicide-related
finding nobody anticipated, and blocking it would push sites into `code.text` —
losing the coding for the nine concepts that are covered along with the one that
is not.

## Enumerated, not intensional

The value set lists its nine SNOMED CT concepts explicitly rather than defining
them as a subsumption query such as *descendants of `6471006`*. An intensional
definition would be shorter and would drift with every SNOMED release, pulling
in concepts nobody reviewed. The whole value of this set is that a person
checked each member against the publishing authority (`$lookup` and
`$validate-code`). The set is `extensible`, so a site with a finding genuinely
outside the list is not blocked.

## Why verification is stated, not assumed

`86849004` is widely mis-cited as "suicide attempt". Its Fully Specified Name
is *Suicidal poisoning (disorder)* — a real code that validates structurally
while silently narrowing every attempt on the problem list to a poisoning. The
correct code is `82313006`. SPiER publishes the verified set so that sites, the
concept layer and the Stage-7 registry all name the same finding the same way.

## The members, and the decisions inside the groupings

Ordered as the clinical progression a pathway walks:

- **Risk status** — `225444004` "At increased risk for suicide". SPiER's own
  expression of risk is the concept-layer Observation, not this code. It is in
  the set because some sites do carry risk status on the problem list, and
  when they do they should use this concept rather than inventing one.
- **Ideation through attempt** — `6471006` thoughts, `247650009` planning,
  `304594002` intent, `425104003` behavior, `82313006` attempt.
- **History of attempt** — `23233009` "Previous known suicide attempt", which
  earns a distinct code rather than a resolved *Suicide attempt* row. Those are
  different claims: `clinicalStatus = resolved` on an attempt says the attempt
  is over, not that the patient has a history of one. A past attempt is the
  single strongest predictor of a future one, so a consumer must be able to
  find it without reasoning about clinical status.
- **Self-harm** — `248062006` "Self-injurious behavior" and `276853009` "Self
  inflicted injury". Two codes, because the pattern of behaviour and a specific
  resulting injury are different assertions and a problem list may legitimately
  carry either. **Neither implies suicidal intent**, which is why they are not
  folded into the ideation group.

## Depression is verified but deliberately not bound

`35489007` "Depressive disorder" was verified the same way as every member, and
SPiER records it so that sites carrying depression on the problem list use that
code. **It is not a member of the value set.** A depressive disorder is a
co-occurring diagnosis, not a suicide-related finding, and putting it in a set
bound to a suicide-related profile invites exactly the inference the guide
refuses elsewhere: *PHQ-9 scores 14, therefore assert "Depressive disorder"*.
The PHQ-9 is a severity screen; a depressive disorder is a diagnosis. SPiER has
no basis to make it.

## Why the CAMS driver is not coded

A CAMS driver is idiographic — *"relationship conflict with spouse — feeling
trapped and hopeless"* — and no terminology carries concepts at that
granularity. The profile requires `code.text` and leaves `code.coding` optional
with an `example` binding; requiring a code would replace what the clinician
and patient identified with a coarser label meaning something else.

## What would reopen it

A tenth finding that real problem lists carry and the set lacks (the set is
extensible in the meantime); or SNOMED retiring or splitting a member, which
the nightly terminology check would surface.
