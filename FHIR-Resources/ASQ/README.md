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
| `asq-questionnaire.json` | The FHIR R4 Questionnaire the app loads at runtime — `enableWhen` conditional logic, published LOINC panel and per-item codes, `observationExtract` on q1–q5, SNOMED-bound Yes/No answers |
| `yes-no.json` | The SNOMED-bound Yes/No answer ValueSet, published for systems that resolve `answerValueSet` against a terminology server. The Questionnaire also carries the codings inline, because not every renderer ships value-set resolution |
| `licensing/MEMO.md` | The licensing audit and its open items |

Everything else about the ASQ is defined in [`ig/input/fsh/asq.fsh`](../../ig/input/fsh/asq.fsh)
and rendered in the published IG: the three result tiers and the exact criteria
for each, the `SPiERASQResult` Observation profile, the `AdministerASQ`
ActivityDefinition with its stage membership and licensing, and the example
QuestionnaireResponse and Observations.

## The item codes are LOINC now

LOINC 2.83 published the ASQ as panel **115564-7** with a code per item, so the
Questionnaire, [the observation mapper](../../packages/core/src/lib/observationMappers/asq.ts)
and the data dictionary all bind to LOINC. Two SPiER-local CodeSystems existed
only because those codes did not — `asq-item` (in the FSH) and `asq-panel` (a
JSON file in this folder) — and both are **deleted**. `asq.fsh` carries the
per-item mapping and the reasoning.

The **answers split**, and it is worth knowing which way before you read a
response. `q4-recent-attempt` is answered with LOINC `LA37190-8` / `LA37191-6`,
because LOINC publishes an answer list for that item matching the old local pair
display-for-display. Every yes/no item still answers with SNOMED `373066001` /
`373067005`, because that pair is shared across every instrument in the repo and
read by one `getYesNoBoolean`.

⚠️ **This is the ASQ's third item-coding, and the first two shipped wrong.** #220
found the items carrying C-SSRS screener codes and the mapper emitting codes
that do not exist in LOINC at all. Anything that re-codes these items should be
read against LOINC's own published panel definition, item by item — not against
this file.

⚠️ **`tx.fhir.org` serves LOINC 2.82 and does not resolve these codes yet.** The
nightly `check:codings` gate carries them in its `PENDING_TX` allowlist, which
fails the run once the server catches up so the entries get deleted rather than
becoming permanent. If you see that failure, the fix is to remove those lines.

Three further CodeSystems used to live here — `asq-screening-result`,
`asq-attempt-recency` and `asq-age-group` — and were **removed in favour of the
IG's definitions** (a different reason from the two above, which are gone
entirely). ⚠️ `asq-attempt-recency` has since gone entirely too, for the same
reason as `asq-item`: LOINC's answer list for `115570-4` carries the identical
pair, so the local codes were a stand-in with a published equivalent. They were duplicates at the *same canonical URL*, and the
`asq-screening-result` copy had drifted to different `display` values, so
whichever loaded last silently won. `validator_cli` flagged the resulting
display mismatches; `scripts/validate-fhir.mjs` loads both trees so a fresh
collision shows up the same way.

## Pilot status

`status: draft` / `experimental: true`. Every coding carries the SPiER
`coding-verification-status` extension, so the open items are readable off the
artifact rather than out of this file.

⚠️ **The LOINC recoding moved the ASQ further from `active`, not closer, and
that is the honest direction.** Its eight new LOINC codings read `unverified`,
which blocks leaving draft. Before the recoding they were `no-standard-binding`
— a *terminal* state meaning no published concept existed to check against, so
nothing was owed. Something exists now and has not been checked against the
publishing authority: the codes came from NLM's LOINC-derived Questionnaire, and
as of 2026-09-08 Regenstrief's own service needs an account while tx.fhir.org
and CSIRO's ontoserver both still serve LOINC 2.82 and report all eight unknown.
The one remaining `no-standard-binding` is the result-category item, whose
disposition tiers LOINC still does not publish.

Flipping those eight to `verified` against a LOINC 2.83+ source is what returns
the ASQ to where it was. When nothing reads `unverified`, the Questionnaire can
flip to `active`.

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
