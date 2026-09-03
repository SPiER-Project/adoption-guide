# BSSA — Brief Suicide Safety Assessment (NIMH)

## Provenance

The Brief Suicide Safety Assessment is the clinician assessment guide from the
National Institute of Mental Health **ASQ Toolkit**. It is used *after* a
patient screens positive for suicide risk, to gather enough information to
determine a clinical disposition.

**The BSSA is a guide, not a scored survey.** There is no total score and there
are no validated cut-points: the clinician conducts a structured interview and
then selects one of four dispositions. That is why this encoding treats the
**disposition** as the primary machine-actionable output — mirroring the ASQ
screening-result pattern — with a handful of clinically decisive interview
findings captured as discrete Observations, and the symptom checklist and
social-support items kept in the QuestionnaireResponse as context only.

| | |
|---|---|
| **Source** | [NIMH ASQ Toolkit](https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials) — the **Adult Outpatient** BSSA worksheet, whose item wording is followed here. The ED, inpatient and youth worksheets differ only in disposition detail. |
| **Validated populations** | Youth (age 8+) and adults; setting-specific worksheets exist |
| **Settings** | Outpatient / primary care, emergency department, inpatient medical/surgical |
| **Licensing** | Public domain — a work of the U.S. federal government. The status and its basis are on the `AdministerBSSA` ActivityDefinition; the evidence is in [`licensing/MEMO.md`](licensing/MEMO.md). ⚠️ The audit's substantive finding is that the BSSA should be kept **with its disposition guidance** rather than excerpted as a stand-alone form. |

## What's in this folder

| File | What it is |
|---|---|
| `bssa-questionnaire.json` | The FHIR R4 Questionnaire — the five worksheet sections, SNOMED-bound Yes/No answers, `enableWhen` conditionals, and `observationExtract` on the six discrete outputs |
| `licensing/MEMO.md` | The licensing audit |

Everything else is defined in the IG and rendered there:

- [`ig/input/fsh/bssa.fsh`](../../ig/input/fsh/bssa.fsh) — the panel, item, symptom and disposition CodeSystems (each concept's definition carries the criteria and the next steps the worksheet prescribes), the ValueSets, the disposition Observation profile, the `AdministerBSSA` ActivityDefinition with its stage membership and licensing, and the example instances.
- [`ig/input/fsh/crosswalk-bssa.fsh`](../../ig/input/fsh/crosswalk-bssa.fsh) — the ConceptMap from BSSA disposition onto the common SPiER suicide-risk tier, so a partner system can consume the result without understanding the BSSA. ⚠️ **That crosswalk is a clinical-equivalence claim and is pending SME sign-off** — see the IG's [Harmonization status](../../ig/input/pagecontent/conformance.md).

The BSSA has no published panel or per-item LOINC codes, so those bindings are
SPiER-local and marked `no-standard-binding`. The one verified binding is on the
disposition item, which carries the generic LOINC `93374-7` (*Suicide risk
level*) — the same code the ASQ screening result and the concept layer use.
`status: draft` / `experimental: true`.

## Informational — not stated by any artifact

**Conditional items mean "not asked", not "answered no".**
`ideation-frequency`, `ideation-last-time` and `attempt-details` are
`enableWhen`-gated. When the gate does not fire, the item should be **absent**
from the QuestionnaireResponse rather than present with an empty value, and a
receiving system must read that absence as *not asked*. The observation mapper
only materializes an Observation where an answer is actually present.
