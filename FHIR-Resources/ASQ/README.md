# ASQ — Ask Suicide-Screening Questions

## Provenance

The ASQ is a brief, validated suicide-risk screening tool developed by the
**National Institute of Mental Health**: four screening questions plus an
acuity question, administered in roughly 20 seconds.

| | |
|---|---|
| **Source** | [NIMH ASQ Toolkit](https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials) |
| **Validated populations** | Youth (age 8+) and adults |
| **Settings** | Emergency department, inpatient medical/surgical, outpatient/primary care, telehealth |
| **Licensing** | Public domain. The status and its basis are on the `AdministerASQ` ActivityDefinition (`instrument-licensing-status` + `copyright`); the evidence and open items are in [`licensing/MEMO.md`](licensing/MEMO.md). |

## What's in this folder

| File | What it is |
|---|---|
| `asq-questionnaire.json` | The FHIR R4 Questionnaire the app loads at runtime — `enableWhen` conditional logic, SPiER-local `asq-item` per-item codes, `observationExtract` on q1–q5, SNOMED-bound Yes/No answers |
| `asq-panel.json` | Local CodeSystem holding the panel code for the ASQ as a whole |
| `yes-no.json` | The SNOMED-bound Yes/No answer ValueSet, published for systems that resolve `answerValueSet` against a terminology server. The Questionnaire also carries the codings inline, because not every renderer ships value-set resolution |
| `licensing/MEMO.md` | The licensing audit and its open items |

Everything else about the ASQ is defined in [`ig/input/fsh/asq.fsh`](../../ig/input/fsh/asq.fsh)
and rendered in the published IG: the item CodeSystem and why the ASQ has no
per-item LOINC codes, the three result tiers and the exact criteria for each,
the `SPiERASQResult` Observation profile, the `AdministerASQ`
ActivityDefinition with its stage membership and licensing, and the example
QuestionnaireResponse and Observations.

Three CodeSystems used to live here — `asq-screening-result`,
`asq-attempt-recency` and `asq-age-group` — and were **removed in favour of the
IG's definitions**. They were duplicates at the *same canonical URL*, and the
`asq-screening-result` copy had drifted to different `display` values, so
whichever loaded last silently won. `validator_cli` flagged the resulting
display mismatches; `scripts/validate-fhir.mjs` loads both trees so a fresh
collision shows up the same way.

## Pilot status

`status: draft` / `experimental: true`. Every coding carries the SPiER
`coding-verification-status` extension, so the open items are readable off the
artifact rather than out of this file. Today the Questionnaire holds one
`verified` coding and six `no-standard-binding` — the latter meaning there is no
authoritative published concept to verify against, not that verification is
pending. When nothing reads `unverified`, the Questionnaire can flip to
`active`.

How SPiER relates to USCDI+ Behavioral Health and the HL7 US Behavioral Health
Profiles IG is stated once, on the IG's
[Relationship to Other IGs](../../ig/input/pagecontent/relationship-to-other-igs.md)
page, rather than per tool.

## Informational — not stated by any artifact

These two rules are clinical and are **not** carried by the Questionnaire, the
FSH, or any IG page. They are recorded here because nothing else records them;
they are not normative, and an implementer should confirm them against their own
protocol.

**Conditional items mean "not asked", not "answered no".** Q5, `q4-recent-attempt`,
`q5-describe` and `patient-age-group` are `enableWhen`-gated. When the gate does
not fire, the item should be **absent** from the QuestionnaireResponse rather
than present with an empty or negative value, and a receiving system must read
that absence as *not asked* — a missing Q5 means Q1–Q4 were all "no" and the
acuity branch never triggered, not that the clinician forgot. Downstream
extraction must preserve this: only materialize an Observation where the
response actually carries an answer.

**Refusal is age-dependent.** For youth, refusal counts as a non-acute positive
screen; for adults it does not, absent other safety concerns. The Questionnaire
captures this with `patient-refused` plus `patient-age-group`, whose text says
only that the age group "affects refusal interpretation" — the rule itself is
here. Whether `patient-age-group` should be derived from `Patient.birthDate`
rather than asked is still open.
