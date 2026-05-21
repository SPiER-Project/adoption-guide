---
name: assessment-to-ig
description: Convert a validated clinical assessment (paper instrument, PDF, vendor spec, or published instrument like PHQ-9 / ASQ / GAD-7 / AUDIT-C / Columbia Protocol / CAMS / SBQ-R / Stanley-Brown) into the full set of SPiER FHIR Implementation Guide artifacts. Use this skill when the user wants to "add a new assessment to the IG," "FHIR-ify an instrument," "scaffold the FHIR resources for [instrument]," or "wire [instrument] into the catalog." Trigger when the user provides a PDF, image, transcript, or URL of a validated instrument and asks for FHIR artifacts. Also trigger when the user asks "what would it take to add X" about a clinical screening tool. This skill drives the *full* artifact set (Questionnaire JSON + FSH ActivityDefinition + CodeSystems + ValueSets + example QuestionnaireResponse + Observation profiles + IG page content + catalog wiring); for review of an already-drafted Questionnaire, use the `fhir-questionnaire-quality` skill instead.
---

# Assessment → FHIR Implementation Guide

This skill turns a validated clinical assessment into the **complete set** of FHIR IG artifacts SPiER ships for every instrument. It's a repeatable pipeline: paper or vendor spec in, a coherent set of Questionnaire + FSH + examples + IG page + catalog wiring out.

It is the **authoring** counterpart to `fhir-questionnaire-quality`, which is the **review** skill. Use this skill when starting from a new instrument; use the quality skill when iterating on a Questionnaire that already exists.

## Scope: what this skill produces

For each new assessment, produce all of the following artifacts. The skill is not done until every section is addressed (even if the answer for a section is an explicit "deferred, here's why").

1. **Hand-authored Questionnaire JSON** at `FHIR-Resources/<INSTRUMENT>/fhir/questionnaires/questionnaire.json` (and, if the instrument has multiple forms — e.g. C-SSRS Screener vs. Lifetime/Recent, CAMS SSF Section A/B vs. Therapeutic Worksheet — one file per form, suffixed by form name).
2. **Instrument folder README** at `FHIR-Resources/<INSTRUMENT>/README.md` documenting the items, response options, scoring, copyright/licensing, and LOINC coverage.
3. **FSH artifacts** at `ig/input/fsh/<instrument>.fsh` declaring:
   - `Profile` resources for each derived Observation (total score, item-level for clinically-meaningful items, summary categorization)
   - `Instance: Administer<Instrument>` of `ActivityDefinition`, with `sdc-questionnaire` extension pointing at the hand-authored Questionnaire's canonical URL + version
   - `Instance` examples for at least one filled-in scenario (a worked QuestionnaireResponse plus derived Observations)
   - Any local `CodeSystem` and `ValueSet` definitions the Questionnaire references (e.g. an answer-option code system if no LOINC AnswerList applies)
4. **Stage wiring** in `ig/input/fsh/pathway-stages.fsh` — add the new ActivityDefinition to the relevant stage's PlanDefinition action(s). An instrument that spans multiple stages (e.g. CAMS) gets multiple actions.
5. **IG page content** — if the instrument warrants its own narrative page (most do), add it under `ig/input/pagecontent/` and reference from `ig/sushi-config.yaml` `pages:` and `menu:`. At minimum, the existing `zero-suicide-mapping.md` should be updated to mention which Zero Suicide step the instrument supports.
6. **React catalog entry** in `web/src/data/catalog/tools.ts` — a new `Tool` record with `id`, `name`, `shortName`, `stages[]`, `inclusionStatus`, and `launchActions[]` that loads the Questionnaire JSON.
7. **Optional reference material** under `FHIR-Resources/<INSTRUMENT>/references/` — original PDF, scoring guide, training transcripts. Useful for future contributors; not part of the published IG.

## Inputs the skill needs from the user

Before producing artifacts, gather (or explicitly defer) the following. Don't silently guess.

- **Instrument identity:** Full name, common acronym, version (DSM-5? Adolescent vs. adult? Screener vs. full?).
- **Authoritative source:** PDF, official URL, vendor spec, or published paper. Cite it in the Questionnaire's `copyright` and the folder README.
- **Items and exact wording:** Verbatim question text. LOINC bindings are sensitive to phrasing (see the quality skill's note on wording drift).
- **Response options:** Likert scale? Yes/No? Free text? Numeric range? For each, are coded answer values published (LOINC AnswerList, SNOMED, or instrument-specific)?
- **Scoring rules:** How is the total derived? Are there subscale scores? Severity tiers? Cut-points that trigger clinical action?
- **Conditional logic:** Are any items only asked given a positive answer elsewhere? (Critical for `enableWhen` modeling and for the "asked vs. not asked" semantics in QuestionnaireResponse.)
- **Pathway stage(s):** Which of SPiER's 8 stages does this instrument support? See `ig/input/fsh/pathway-stages.fsh` and `web/src/data/catalog/stages.ts`.
- **Trigger semantics:** Does completing this instrument trigger another stage's action? (e.g. PHQ-9 Item 9 ≥ 1 → Clarify Risk.) Capture as `PlanDefinition.action.trigger` later.
- **Licensing status:** Public domain (ASQ, PHQ-9 by Pfizer policy, SBQ-R, BSSA) vs. registration-required (C-SSRS) vs. commercially licensed (CAMS). This goes into `ActivityDefinition.copyright` / `copyrightLabel` and surfaces on the IG.

If the user provides an image or PDF, extract the items and response options exactly. If wording can't be confirmed, surface it as an open question rather than paraphrasing.

## Execution checklist

Work in this order. Each step depends on the one above.

### 1. Identify and verify codes (before writing any JSON)

- **Panel-level LOINC** for the Questionnaire root (e.g. PHQ-9 = 44249-1, ASQ panel codes exist, C-SSRS has panel-level LOINCs).
- **Item-level LOINC** for each question. Use search.loinc.org or the LOINC FHIR endpoint. Verify the LOINC's question text matches the instrument's wording — drift here causes silent portability failure.
- **Answer-list LOINC or SNOMED** for response options. PHQ-9 / GAD-7 frequency scales have a published LOINC AnswerList (LL358-3). Yes/No should bind to SNOMED 373066001 / 373067005 (see quality skill).
- **Total-score LOINC** for derived Observations. Most validated panels have one.
- **Severity-tier value set**, if the instrument categorizes scores (minimal/mild/moderate/severe). Often instrument-specific; declare a local CodeSystem if no standard exists.

If a LOINC binding can't be verified, flag it explicitly in the artifact (`// TODO: LOINC verification pending` comment) rather than committing an unverified code as fact.

### 2. Author the Questionnaire JSON

Place at `FHIR-Resources/<INSTRUMENT>/fhir/questionnaires/questionnaire.json`. Follow the structural conventions already in the repo:

- `url`: `http://spier.org/Questionnaire/<INSTRUMENT>` (no version suffix in the `url`; carry version in `version`)
- `version`: Start at `1.0.0`. Bump on material changes.
- `status: draft`, `experimental: true` until verified end-to-end.
- `subjectType: ["Patient"]`
- `code`: panel-level LOINC on the root.
- `useContext`: at minimum declare a `venue` (ED / outpatient / inpatient / telehealth) and a `focus` clinical concept.
- `copyright`: full attribution. Distinguish "public domain" from "freely available but copyrighted" — see `FHIR-Resources/PHQ-9/README.md` for the right phrasing.
- For each item: `linkId`, `text` (verbatim), `type`, `code` (LOINC), and for choice items either `answerValueSet` (preferred — points at a published or local ValueSet) or `answerOption` with coded values.
- Conditional follow-ups: `enableWhen` + `enableBehavior` per the quality skill. Conditional items must be **absent** from the QuestionnaireResponse when not triggered — document this on the README.

Run the new file past the `fhir-questionnaire-quality` skill's checklist before declaring it done.

### 3. Author the FSH artifacts

Place at `ig/input/fsh/<instrument>.fsh`. Use existing files as templates — `phq9.fsh` is the cleanest reference for a single-form instrument; `cams.fsh` is the reference for multi-form instruments.

Required FSH content:

- One `Profile` per derived Observation. At minimum: total-score Observation. Add item-level Observation profiles for any item that's a clinical trigger (e.g. PHQ-9 Item 9, ASQ acute question, C-SSRS items 4–5).
- One `Instance: Administer<Instrument> InstanceOf: ActivityDefinition` linking the canonical Questionnaire URL via the `sdc-questionnaire` extension. Match the `Questionnaire.url` + `|version` exactly.
- Example `Instance`s of each Observation profile (one per profile, suffixed `Example...`).
- If the Questionnaire uses local code systems, declare them as `CodeSystem` instances in this file. ValueSets that the answer options bind to likewise.

Verify the FSH compiles: `cd ig && sushi .` should run clean.

### 4. Wire into the pathway

Open `ig/input/fsh/pathway-stages.fsh`. Find the `PlanDefinition` for the stage this instrument supports. Add an `action` whose `definitionCanonical` points at the new `ActivityDefinition` URL.

Multi-stage instruments get multiple actions across multiple PlanDefinitions.

If the instrument introduces a stage-transition trigger (e.g. PHQ-9 Item 9 → Clarify Risk), model it as `PlanDefinition.action.trigger` on the **receiving** stage's action, not as a side-effect of the screening stage. The trigger references the derived Observation's LOINC code and the threshold value.

### 5. Wire into the React catalog

Open `web/src/data/catalog/tools.ts`. Add a `Tool` record:

```ts
{
  id: 'TL-NNN',                  // Next available TL-ID
  name: 'Instrument full name',
  shortName: 'Acronym',
  stages: ['stage-id-1', ...],   // From catalog/stages.ts
  inclusionStatus: 'core' | 'recommended' | 'optional',
  launchActions: [
    {
      label: 'Administer …',
      questionnaire: '<canonical questionnaire URL>',
      // …
    },
  ],
  // …
}
```

If the instrument is built but not yet exercised by a UI launch, leave `launchActions: []` and the Roadmap page will mark it `planned` automatically (see `buildStatusOf` in `web/src/pages/Roadmap.tsx`).

Run `npm --prefix web run build` to confirm typings and imports compile.

### 6. Author IG narrative content

If the instrument warrants its own IG page (most validated instruments do), add a Markdown file under `ig/input/pagecontent/` and register it in `ig/sushi-config.yaml` under `pages:` and `menu:`. The page should cover: clinical purpose, scoring, conditional logic, derived Observations, and known integration considerations.

Always update `ig/input/pagecontent/zero-suicide-mapping.md` to add the new instrument to the appropriate Zero Suicide step row.

### 7. Update cross-cutting docs

- `FHIR-Resources/README.md` — add a row to the instruments table.
- `docs/MANIFEST.md` — if instrument-level artifacts are tracked there.
- `web/src/pages/Roadmap.tsx` — historically had a `PLANS` map; once the GitHub-Issues migration lands this becomes "open a tracking issue with the right labels."
- Run the quality skill's checklist one more time end-to-end.

## Output format

When invoked, the skill produces work in this order, with the user able to interrupt at any step:

1. **Confirm inputs** — restate what instrument is being added, which authoritative source is being used, and any open questions about wording / scoring / licensing that the user needs to confirm before any code is written. **Do not invent codes or wording.**
2. **Code verification plan** — list the LOINC / SNOMED bindings the artifact will use, marking each as `verified` (cite source) or `unverified — to confirm`.
3. **File plan** — enumerate every file that will be created or modified, with one-line rationale each.
4. **Author artifacts** — produce the files in the order above.
5. **Self-review** — apply the `fhir-questionnaire-quality` checklist to the new Questionnaire and report any priority gaps before declaring done.
6. **Hand-off summary** — bulleted list of (a) files created, (b) verifications the user must complete (LOINC bindings, copyright wording, clinical sign-off), (c) follow-up issues to open against the GitHub Issues tracker (with suggested titles and labels).

## What this skill does *not* do

- Clinical validation — assume the source instrument is clinically correct. Flag concerns but don't second-guess validated instruments.
- LOINC submissions — when no LOINC binding exists, surface it as an open item with a recommended LOINC submission rather than improvising a local code.
- Running the IG Publisher — verifying `sushi .` compiles is in scope; running the full HL7 IG Publisher CI is not.
- Multi-IG coordination — this skill assumes the SPiER IG canonical (`http://spier.org`). Cross-IG profile dependencies (US Core, SDC) are referenced but not re-authored.
