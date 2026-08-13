# US Behavioral Health Profiles IG — research & application to SPiER (August 2026)

**Provenance:** Direct inspection of the CI build at
<https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/> on **2026-08-12** — every page,
the full 112-row crosswalk table, and the raw JSON of the profiles, ValueSets and the C-SSRS /
PHQ-9 / anxiety examples. Structural claims about FHIR R4 and US Core were checked against
`hl7.org/fhir/R4/questionnaireresponse.profile.json` and
`hl7.org/fhir/us/core/STU6.1/StructureDefinition-us-core-observation-screening-assessment.json`.

This is a **CI build that changes regularly**. Every finding below is dated; re-verify before
acting on any of it. Where this report contradicts
[`ig/input/pagecontent/relationship-to-other-igs.md`](../../ig/input/pagecontent/relationship-to-other-igs.md),
this report is newer — see [What our existing page gets wrong](#what-our-existing-page-gets-wrong).

---

## 1. What this IG actually is

| | |
|---|---|
| **Full name** | US Behavioral Health Profiles Implementation Guide ("BHP IG") |
| **Publisher** | ASTP/BHIT — **not** an HL7 work group product, though built with HL7 EHR WG BH Project input |
| **Authors** | Next Level Health Innovations + Lantana Consulting Group |
| **Funder** | SAMHSA, under the Behavioral Health IT (BHIT) Initiative, with ASTP/ONC |
| **Package** | `fhir.astp.bhp#0.1.0`, FHIR 4.0.1 |
| **Status** | CI build, generated 2026-02-19; **"not an authorized publication"** |
| **Repo** | `HL7/us-behavioral-health-profiles`, last pushed 2026-07-22, **0 open issues** |
| **Purpose** | Express the **USCDI+ Behavioral Health** data-element list as FHIR |

**It is a crosswalk document, not a profile library.** The entire normative surface is three
artifacts:

1. **Mental Health Clinical Notes** — `us-core-documentreference` + a required binding on
   `DocumentReference.type` to five LOINC note codes. That is the *whole* differential: two
   element rows.
2. **Grant Information Observation** — an `Observation` carrying a SAMHSA grant number/program
   ID/funding type. Genuinely novel; nothing else in FHIR does this.
3. **Grant Program ID and Number** — the complex extension the above uses.

Everything else — 45+ examples across 112 crosswalk rows — is **unconstrained examples against
US Core**. The IG's own crosswalk column is literally titled "Proposed FHIR Profile."

### The five mental-health note LOINC codes

Worth recording; they are the IG's only real terminology contribution beyond the grant codes:

| LOINC | Display |
|---|---|
| `34785-6` | Mental Health Consult Note |
| `78263-1` | Mental Health Discharge Summary Note |
| `78306-8` | Mental Health History and Physical Note |
| `78472-8` | Mental Health Procedure Note |
| `34904-3` | Mental Health Progress Note |

Bound `required` in
`http://fhir.org/guides/astp/bhp/ValueSet/mental-health-clinical-note-types`.

---

## 2. The finding that matters most

**Row 54 of the crosswalk is "Suicide Risk Assessment," and the IG maps it to
"US Core QuestionnaireResponse + US Core Observation Screening Assessment" — then ships only the
QuestionnaireResponse half.**

There is no suicide-risk `Observation` anywhere in the IG. The artifact index has an
`Observation-anxiety-assessment-observation-example-1` (an M3 Checklist, LOINC `71891-6`, with
one `component`), but **nothing** for suicide risk. The C-SSRS example is a bare
QuestionnaireResponse: captured, coded, and dropped.

The narrative makes the omission concrete. The IG's seven-encounter story has James Wolff arrive
at an ED with chest pain, get worked up for a panic attack, and — per `full_story.html` — the
in-house psychiatrist "assessed a low risk for suicide based on the C-SSRS screen completed by
the ED nurse." Then the story moves on. **No derived risk concept, no safety plan, no
follow-up contact, no risk episode, no measure.** The C-SSRS result never becomes actionable
data.

That is precisely the Capture → **Translate → Act** gap SPiER exists to fill, described in a
federally funded IG, in the IG's own words, on the IG's own index patient. It is the single
best-framed argument for SPiER's existence that we did not write ourselves.

---

## 3. Terminology alignment — we are already nearly exact

I diffed the BHP C-SSRS example against `FHIR-Resources/C-SSRS/cssrs-screener.json` item by item.

**All eight LOINC codes match, in the same order, with the same semantics:**

| BHP `linkId` | SPiER `linkId` | LOINC | Item |
|---|---|---|---|
| `/93246-7` | `q1` | `93246-7` | Wished you were dead |
| `/93247-5` | `q2` | `93247-5` | Thoughts of killing yourself |
| `/93248-3` | `q3` | `93248-3` | Thinking how you might do this |
| `/93249-1` | `q4` | `93249-1` | Some intention of acting |
| `/93250-9` | `q5` | `93250-9` | Worked out the details |
| `/93267-3` | `q6` | `93267-3` | Any behavior, ever |
| `/93269-9` | `q6-recent` | `93269-9` | Within past 3 months |
| `/93374-7` | `risk-level` | `93374-7` | Suicide risk level |

The risk-level answer also agrees: BHP uses `LA9194-7 "Low"` from LL465-6, which is exactly the
target `crosswalk-tier-to-loinc.fsh` already maps our `low` tier onto. PHQ-9 agrees too — the
nine item codes, `44261-6` total score, `69722-7` difficulty item, and the LA-series answer
codes all match what `fallbackDispatch.ts` and the PHQ-9 Questionnaire carry.

**Conclusion: there is no terminology work to do.** The alignment story is already true, and
stronger than our IG page currently claims. What differs is *structure*, not vocabulary.

---

## 4. Three structural gaps, in priority order

> **All three are now closed** (2026-08-13). This section records them as found; the fixes, and
> the data-loss bug that 4.1 turned out to be sitting on, are in
> [Recommended actions](#recommended-actions). In particular the "31 advisory warnings" this
> section treats as a fixed background fact were themselves part of the problem.

### 4.1 Our profiles don't require the `survey` category, so they don't conform to the profile the crosswalk names

`us-core-observation-screening-assessment` (verified against STU6.1) derives from **base
`Observation`** — the same parent SPiER uses — and its differential is modest:

```
Observation.category                       1..*  MS
Observation.category:survey                1..1  MS  pattern observation-category#survey
Observation.category:screening-assessment  0..*  MS
Observation.status / code / value[x]             MS
```

SPiER's instrument Observation profiles (e.g. `SPiERCSSRSRiskLevel` in `cssrs.fsh`) already
require `status`, `category 1..*`, `category.coding 1..*`, `code`, `subject 1..1`,
`effective[x] 1..1`, `value[x] 1..1`, all Must-Support. We are one slice away.

The gap is narrow but real: our **example instances** set
`category[+] = observation-category#survey` (see `phq9.fsh:100`, `asq.fsh:183`, `cams.fsh:614`
and six others), but our **profiles never require it**. A conformant SPiER producer can
therefore omit `survey` and fail `us-core-observation-screening-assessment` — the exact profile
the BHP crosswalk names for row 54.

Adding a `survey` category slice to the survey-derived Observation profiles would make every
SPiER instrument Observation simultaneously US Core screening-assessment conformant. It costs a
RuleSet and touches the profiles that already `insert SuicideRiskDomainCategory`. This is the
highest-leverage change in this document.

⚠️ One caution: `category` is already sliced by `SuicideRiskDomainSlicing` (#271), and per
CLAUDE.md that slicing is why 31 advisory SUSHI warnings exist. A second slice on the same
element needs `scripts/check-sushi-output.mjs` re-run and its `ALLOWED` list reviewed, not
silenced.

### 4.2 Our fallback dispatch cannot recognize the BHP IG's own examples

This one is a latent defect, not just a gap.

`fallbackDispatch.ts` documents Tier-2 recognition as matching LOINC item codes carried on
either:

1. `QuestionnaireResponse.item[].code`, or
2. a contained `Questionnaire`'s `item.code`, joined by `linkId`.

**Path 1 cannot conformantly exist.** I pulled the R4 StructureDefinition:
`QuestionnaireResponse.item` has exactly `linkId`, `definition`, `text`, `answer`, `item` —
plus `id`/`extension`/`modifierExtension`. **There is no `code` element.** So Tier-2 only ever
fires via a contained Questionnaire, and the code that reads `item.code` (line 137) is
scavenging a non-conformant element that a real EHR will never send.

Meanwhile, the BHP examples carry the LOINC code **in the `linkId` itself**, as `/44250-9` —
leading slash, no `item.code`, no `contained`. So SPiER's foreign-QR recognition, whose entire
purpose is ingesting a QR authored elsewhere, **cannot recognize the national BH IG's
PHQ-9 or C-SSRS example.** Verified: both examples have `contained: False` and no item bearing
a `code` key.

A `linkId`-as-code recognition path is small — normalize the `linkId` by stripping a leading
`/`, then match against the same `itemCodes` table — and it converts the fallback from
theoretical to demonstrable against a federally published example. It also unblocks C-SSRS,
which is not yet in `INSTRUMENT_SIGNATURES` at all (Phase 1 shipped PHQ-9 only) despite our
Questionnaire carrying all eight matching LOINC codes.

Note the BHP `linkId` convention is genuinely worse practice than ours — a `linkId` is an
opaque correlator, and overloading it with terminology means the code cannot be validated,
translated, or bound. That is worth saying out loud in a WG comment (§6), but we still have to
*read* it.

### 4.3 `QuestionnaireResponse.questionnaire` pointing at a PDF

The BHP C-SSRS example sets:

```json
"questionnaire": "https://www.cms.gov/files/document/cssrs-screen-version-instrument.pdf"
```

`QuestionnaireResponse.questionnaire` is `canonical(Questionnaire)`. Pointing it at a PDF means
no validation, no SDC rendering, no `observationExtract`, no answer-option checking — the
response is uninterpretable by machine except through the linkId convention in §4.2. (Their
PHQ-9 example does better: `http://hl7.org/fhir/us/core/Questionnaire/phq-9-example|6.1.0`.)

This is the clearest place SPiER is materially ahead: we publish real Questionnaires with
`answerOption`, ordinal extensions and item codes for all thirteen instruments, and our
validator gate checks every QuestionnaireResponse against its Questionnaire. **Offering the
SPiER C-SSRS Questionnaire as the canonical target for their example is a concrete,
low-controversy contribution** that improves their artifact and puts a SPiER URL in a federally
funded IG.

---

## 5. Defects in the CI build worth knowing (and not inheriting)

Dated 2026-08-12. These are reasons to align at the terminology level rather than declare a
package dependency — which is the call `relationship-to-other-igs.md` already makes, and this
strengthens it.

1. **Mixed US Core versions inside one IG.** The profiles derive from
   `us-core-documentreference|7.0.0` and reference `us-core-patient|7.0.0`, while the examples
   pin `us-core-questionnaireresponse|6.1.0` and `us-core-simple-observation|6.1.0`. Both
   `us-core-questionnaireresponse|6.1.0` **and** `|7.0.0` appear in the same build.
2. **The change log describes 0.2.0; the package is 0.1.0.** The log documents April 2025
   changes — removals under Executive Order 14168 (Sexual Orientation, Pronouns, Gender
   Identity, Name to Use), removal of Farmworker Status, removal of Adverse Event.
3. **Those removals are not reflected in the crosswalk tables.** All six removed elements are
   still live rows in `bh_to_fhir_profiles.html` — Adverse Event (row 1), Name to Use (69),
   Gender Identity (75), Sexual Orientation (84), Pronouns (88), Farmworker Status (111).
   **Do not treat the crosswalk table as the element list**; it is stale against the IG's own
   change log. Anything we build against those six rows would be building against elements the
   publisher says are gone.
4. **Two canonical bases.** The `ImplementationGuide` declares
   `http://hl7.org/fhir/us/bhp/...` while every artifact uses
   `http://fhir.org/guides/astp/bhp/...`.
5. **Story inconsistencies.** `quick_facts.html` says Medicare; the story and the
   `Coverage-medicaid-coverage-example-1` / `Organization-fl-medicaid-example-1` examples say
   Florida Medicaid. `quick_facts` says James requested female counselors; `full_story` says he
   requested afternoon appointments.
6. **Zero open issues on the repo** — with these inconsistencies present, that reads as an
   unattended tracker rather than a clean build. Which is *good news for us*: filing
   well-formed, evidence-backed issues is likely to land with disproportionate visibility.

---

## 6. The adoption channel — this is the time-sensitive part

**On 2026-02-02, SAMHSA/ASTP announced nine pilot programs** to test exactly these standards —
USCDI+ BH *and* the BHP FHIR IG — across **45 exchange partners in nine states**: Colorado,
Connecticut, Delaware, Florida, Massachusetts, North Carolina, Oregon, Rhode Island, and
Washington, D.C.

Two dates matter:

- **Pilot testing completes end of 2026.**
- **A "Behavioral Health Information Resource" ships in 2027.**

So there is a live cohort of 45 organizations, right now, implementing a guide that captures a
C-SSRS and then does nothing with it. SPiER's entire Translate + Act layer is the missing half
of what they are piloting, and the window to influence the 2027 resource is roughly the next
two quarters.

There is also an open governance door: the **HL7 EHR WG Behavioral Health Project** published a
**Call to Action dated 2026-01-22** on Confluence (page 208471919). I could not retrieve the
PDF — Confluence returned 405 to automated fetch and requires a login — so **someone should
open it manually**; it is the most likely named path to a standing seat in the group that feeds
this IG.

---

## What our existing page gets wrong

[`ig/input/pagecontent/relationship-to-other-igs.md`](../../ig/input/pagecontent/relationship-to-other-igs.md)
is broadly right and its "broad and shallow vs. narrow and deep" framing holds up well. Three
corrections and one strengthening:

| Current text | Correction (2026-08-12) |
|---|---|
| "Shared foundation: **US Core 6.1.0**" | The BHP IG's *profiles* now derive from **US Core 7.0.0**; only its examples still pin 6.1.0. Our page states a single version where the target has two. |
| "PHQ-9 … match the codes used in the … PHQ-9 example" | True but understated — **C-SSRS matches on all eight item codes too**, including the `93374-7` risk level and the `LA9194-7` answer. This is our strongest alignment claim and the page doesn't make it. |
| Table row: "Cross-instrument suicide-risk concept — **not addressed**" | Sharper: the BHP crosswalk *names* `us-core-observation-screening-assessment` for Suicide Risk Assessment but **ships no such Observation**. It is not merely unaddressed; it is a declared-and-unfilled slot. |
| "will revisit a formal dependency if and when that guide reaches a stable ballot release" | Keep this verbatim. §5 supplies six concrete reasons it is the right call — the page currently asserts instability without evidence. |

Also worth noting for accuracy: `docs/research/2026-07-terminology-crosswalk-research.md`'s
annex claim that **"US Behavioral Health Profiles IG has no safety-plan profile"** is **still
true** as of 2026-08-12. None of the five mental-health note LOINC codes is a safety plan, and
there is no safety-plan artifact of any kind. Our local safety-plan section coding stands
unchallenged, and proposing a safety-plan note type into their ValueSet remains open.

---

## Recommended actions

Ordered by leverage per unit of effort.

### Do now — ✅ DONE 2026-08-13

All four landed together. **Doing item 1 uncovered a data-loss bug that had been documented as
benign** — see [What item 1 actually found](#what-item-1-actually-found) below.

1. ✅ **`survey` is now a named category slice** on all 12 survey-derived Observation profiles
   (`SurveyAndSuicideRiskCategory` in `concept-layer.fsh`), including the harmonized concept
   Observation that carries `93374-7`. Every SPiER instrument Observation now satisfies
   `us-core-observation-screening-assessment`'s required `category:survey`.
2. ✅ **`linkId`-as-LOINC recognition added** (`linkIdAsCode`), plus the C-SSRS Screener in
   `INSTRUMENT_SIGNATURES` with a new `answerKind: 'boolean'` — C-SSRS answers are yes/no, so
   the existing ordinal coercion could not produce anything `getBooleanAnswer` reads. The BHP
   IG's two published QRs are checked in verbatim under
   `web/src/lib/observationMappers/__fixtures__/` and asserted against: SPiER recovers the same
   PHQ-9 total (12) and the same C-SSRS risk level the guide's own examples state. Disabling
   `linkIdAsCode` fails exactly those 5 tests and nothing else — confirmed, not assumed.
3. ✅ **`item.code` documented honestly.** The path is kept (tolerating a non-conformant
   producer costs one line and can only add recognition) but is now explicitly labelled
   non-conformant, demoted below the two real sources, and no longer listed first.
4. ✅ **`relationship-to-other-igs.md` corrected** on all four points.

### What item 1 actually found

The `survey` slice was expected to be a small conformance addition. It exposed a silent bug:

`category[suicideRisk]` — a `1..1` named slice on a `#pattern`-discriminated `$this` — was
resolving onto **index 0 and overwriting whatever `category[+]` had just written there**. **23 of
25 example Instances were losing their standard category**: `survey`, `procedure`,
`problem-list-item`, and the SNOMED treatment-escalation-plan code.

Nothing caught it, and the reason is worth remembering: a missing *optional* category is not a
validation error, so `validate-fhir.mjs` reporting 0 errors was never evidence the category
survived. Three separate places in the repo — `concept-layer.fsh`, `check-sushi-output.mjs`, and
CLAUDE.md — asserted the resulting SUSHI warnings were harmless advisories and told the next
reader to leave them alone. All three have been corrected.

`SPiERSuicideRiskFlag` was the one profile that got it right from the start (both codes as named
slices, with a comment explaining why); its instance's `category[+]` was clobbered too, but
invisibly, because the profile's fixed slice supplied the same value anyway. That is the pattern
now generalised across the affected profiles.

Consequences worth knowing:

- The warning count went **31 → 6**. The 6 that remain are `Communication.category[+].text`,
  which writes a *sub-element* of index 0, so the coding merges instead of replacing — the only
  genuinely benign shape. `check-sushi-output.mjs` now allows the warning **only for
  `Communication`**, so the data-losing shape fails the gate. Verified by planting it.
- `suicidePreventionNote` shipped here as `0..1`, because the HL7 validator caught that
  `patient-011`'s Stanley-Brown CarePlan lacked `87626-8` while `patient-001` had it, and
  requiring it would have been a conformance decision beyond fixing the data loss.
  **Both halves are now closed: #329 fixed the demo data and raised the slice to `1..1`.**
  `patient-011` carries the code, matching what `carePlanMappers/stanleyBrown.ts` emits at
  runtime, and the profile now enforces it on the two narrative safety plans (Stanley-Brown,
  CRP) — not on the CAMS plans, which share the runtime factory but not the code. The
  accepted cost, and the fact that a required document-type concept in `CarePlan.category`
  stays a documented misuse, is recorded on the rule set in `concept-layer.fsh`.
- This is also a live example of the documented gate division: `check:scenarios` passed the whole
  time, because it reads profile `min` but not slice-level cardinality. The Java validator is
  what found it — and, after #329's `1..1`, is what now fails on it. Note the limit of that
  gate: because the value is fixed, SUSHI *auto-populates* a required slice, so an FSH-authored
  Instance cannot violate it. The constraint protects hand-authored FHIR (the population
  scenarios, `FHIR-Resources/`), which is exactly where the defect was.

Verification: SUSHI 0 errors / 6 expected warnings · validator **0 conformance errors across 386
resources** · `web` verify 546 tests (was 540) · `cds-hooks` 24 tests · `check:codings` 61
external codings match tx.fhir.org.

### Do next — positions SPiER externally (not started)

5. **Open the 2026-01-22 Call to Action** (§6) and decide on EHR WG BH Project participation.
   This is the only item with an external clock and it needs a human with a Confluence login.
6. **File issues on `HL7/us-behavioral-health-profiles`** for §5.1–5.5. Low cost, evidence in
   hand, empty tracker, and it establishes SPiER as a contributing implementer rather than a
   downstream consumer.
7. **Offer the SPiER C-SSRS Questionnaire** as the canonical target replacing the CMS PDF
   (§4.3).
8. **Map SPiER's proposed Suicide-Care Disclosure Consent profile** (the `11.7-0A` gap in
   `docs/use-cases/ed-scenario-11.json`) onto the **SDOH Clinical Care Consent Profile**, which
   is what BHP row 15 uses. Same base, and 42 CFR Part 2 is a shared concern — their pilots
   name it explicitly.

### Consider — larger, and needs a decision (not started)

9. **A "BHP bridge" worked example.** Take the BHP IG's James Wolff C-SSRS QR verbatim, run it
   through SPiER's fallback dispatch → tier Observation → risk episode → safety plan →
   follow-up → Stage-8 measure. That is a *runnable* demonstration that SPiER completes their
   story, using their patient and their data. Given the pilot cohort in §6, this is plausibly
   the highest-value demo SPiER could build — and most of the machinery already exists.
   Note it needs a **second ED patient** or careful reuse: `patient-011` is Maria, and
   `ed-scenario-11.json` already tracks `branch-exclusive` walkthrough gaps that a
   different ED course cannot close on her.
10. **Do not declare a package dependency.** §5 confirms the existing judgment.

---

## Sources

- [US Behavioral Health Profiles IG — home](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/index.html)
- [USCDI+ BH Elements](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/uscdi_bh_elements.html)
- [+BH to FHIR Profiles crosswalk](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/bh_to_fhir_profiles.html)
- [+BH to FHIR Examples](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/bh_to_fhir_examples.html)
- [Full Use Case Story](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/full_story.html)
- [Quick Facts](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/quick_facts.html)
- [Change Log](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/change_log.html)
- [Artifact Index](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/artifacts.html)
- [C-SSRS example (JSON)](https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/QuestionnaireResponse-C-SSRS-example-1.json)
- [ASTP/ONC pilot-program announcement](https://healthit.gov/news/astp-onc-announces-selection-of-nationwide-pilot-programs-to-improve-behavioral-health-data-exchange/)
- [HL7 EHR WG BH Project — Call to Action, 2026-01-22](https://confluence.hl7.org/download/attachments/208471919/BH-Call%20to%20Action-20260122.pdf) (login required)
- [US Core Observation Screening Assessment (STU6.1)](https://hl7.org/fhir/us/core/STU6.1/StructureDefinition-us-core-observation-screening-assessment.html)
