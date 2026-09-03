# PSS-3 — Patient Safety Screener 3

## Provenance

A brief, validated **universal** suicide-risk screen for emergency departments
and inpatient medical settings: three questions covering depression, active
suicidal ideation in the past two weeks, and lifetime suicide attempt, with a
recency follow-up when an attempt is reported. Developed through the
NIMH-funded **ED-SAFE** study (Boudreaux et al.).

| | |
|---|---|
| **Source** | The ED-SAFE study; printable tool distributed by the [Suicide Prevention Resource Center](https://sprc.org/) and [SAMHSA](https://www.samhsa.gov/resource/dbhis/patient-safety-screener-pss-3-brief-tool-detect-suicide-risk-acute-care-settings) |
| **Validated populations** | Ages 12+, **universal** — screen regardless of presenting complaint |
| **Settings** | Emergency department, inpatient medical |
| **Licensing** | Free public resource; no permission or fee required. The status and its basis are on the `AdministerPSS3` ActivityDefinition; the evidence is in [`licensing/MEMO.md`](licensing/MEMO.md). |

## What's in this folder

| File | What it is |
|---|---|
| `pss3-questionnaire.json` | The FHIR R4 Questionnaire — the three items verbatim (including the tool's rule that a patient presenting with a current suicide attempt is an automatic Yes on items 2 and 3), SNOMED-bound Yes/No plus the two SPiER-local non-response options, `enableWhen` on the recency item, and `observationExtract` on the three literal captures |
| `licensing/MEMO.md` | The licensing audit |

Everything else is defined in the IG and rendered there:

- [`ig/input/fsh/pss3.fsh`](../../ig/input/fsh/pss3.fsh) — the panel, item, answer, recency and result CodeSystems. The result concepts carry the exact positive-screen definition, including that item 1 is a depression lead-in not counted toward the suicide-risk result, and that an attempt within roughly six months is positive. Also the `SPiERPSS3Result` profile, the `AdministerPSS3` ActivityDefinition, and the examples.
- [`ig/input/fsh/crosswalk-pss3.fsh`](../../ig/input/fsh/crosswalk-pss3.fsh) — the ConceptMap onto the common suicide-risk tier. ⚠️ The positive mapping is `relatedto` rather than `equivalent`, because a positive PSS-3 is a screen-level signal that does not resolve finer severity — the tool itself calls for a secondary stratifier — and it is **pending SME sign-off**.
- [`ig/input/fsh/pathway-stages.fsh`](../../ig/input/fsh/pathway-stages.fsh) — the `on-pss3-positive` trigger on the Clarify Risk stage, which is how a positive screen advances the patient.

The PSS-3 has no published panel or per-item LOINC codes, so those bindings are
SPiER-local and marked `no-standard-binding`. The one verified binding is on the
computed result, which carries the generic LOINC `93374-7` (*Suicide risk
level*). `status: draft` / `experimental: true`.

## Informational — not stated by any artifact

**The result Observation is computed, so it carries no `observationExtract`.**
Only the three literal item captures do. A filler that expects every
Observation to fall out of extraction will not produce the result — it has to be
derived from items 2 and 3a.

**Conditional items mean "not asked", not "answered no".** `q3a-recency` is
`enableWhen`-gated on a Yes to the lifetime-attempt item; when the gate does not
fire it should be **absent** from the QuestionnaireResponse rather than present
and empty.
