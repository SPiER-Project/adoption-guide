# A computed `risk-level` item is never `required`

**Decided:** 2026-08 (PRs [#414](https://github.com/SPiER-Project/adoption-guide/pull/414),
[#416](https://github.com/SPiER-Project/adoption-guide/pull/416)).
**Rule, as published:** Conformance § *Tier derivation on the Questionnaire*;
the mechanism is the [Tier Derivation](../../ig/input/fsh/concept-layer.fsh)
extension, valued `computed` or `clinician-assigned`, on every instrument's
`risk-level` item.

## The decision

Every SPiER instrument lands on the same harmonized suicide-risk tier (LOINC
`93374-7`), but two routes get there:

- **Computed** — the C-SSRS forms (screener, pediatric, since-last-contact)
  derive the tier from the item ladder. Nothing a form filler collects *is* the
  tier; a mapper computes it from the other answers. The `risk-level` item is
  `readOnly: true` and `required: false`, and an absent answer is the expected
  state.
- **Clinician-assigned** — SAFE-T's Step 4 is literally *"Determine risk level
  & intervention (based on clinical judgment)"*, and PSS-Full's stratification
  step is the same shape. The clinician's judgment *is* the tier; the item is
  `required: true`, and an absent answer is missing data.

Both are "derivation" in the Translate sense — one comparable tier from an
instrument that does not natively speak in tiers — but they differ in whether
the input is other answers or a person's judgment, and the artifact must say
which, so that a filler, a validator or a UI can tell without knowing which
tool it is holding. Hence the extension on the item rather than instrument
knowledge in the consumer.

## Why it is a conformance rule and not a strictness choice

Marking a computed item `required` asks a clinician for a value nothing in the
pipeline produces and nothing consumes. It is a defect, not a stricter reading
of the form. The three C-SSRS Questionnaires shipped exactly that way, and two
SPiER-authored QuestionnaireResponses were non-conformant against their own
Questionnaire as a direct result — the responses correctly omitted the item,
and the form said they could not. #414 corrected the forms and added the
extension so the distinction is machine-readable; #416 wrote it into the IG.

## What was rejected

- **Leaving it to instrument knowledge.** A consumer that "knows" the C-SSRS
  computes its tier has to be taught that for every instrument, and the next
  instrument's author has to remember to teach it. The extension puts the fact
  where the item is.
- **Dropping the item from the computed forms.** The item carries the LOINC
  code the derived Observation is coded with, and a filler that renders the
  computed tier back to the clinician needs somewhere to put it. `readOnly`
  keeps it visible without demanding an answer.

## What would reopen it

An instrument whose tier is *partly* computed and *partly* judgment (a
computed default the clinician may override) would need a third derivation
code and a rule for which value a consumer trusts. None of the eleven current
instruments is shaped that way.
