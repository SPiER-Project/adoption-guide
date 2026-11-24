# Licensing verification backlog

**Every licensing status SPiER publishes still needs verifying at source.** Issue
[#127](https://github.com/SPiER-Project/adoption-guide/issues/127) put a
`copyright` notice and a coded `instrument-licensing-status` on all 43
ActivityDefinitions. What it did **not** do — deliberately, because #127's rule
was "do not guess" — is confirm any of those terms against what the rights
holder publishes today. This file is the standing list of what is still owed,
under the [#64](https://github.com/SPiER-Project/adoption-guide/issues/64)
licensing-audit epic.

Read this before quoting a SPiER licensing status to a partner, and before the
repository transfers to the SPiER organization namespace — #64 gates that
transfer.

## What "verified" means here

Three separate things, easy to conflate:

1. **A status is recorded.** Done for all 43 ActivityDefinitions.
2. **The status traces to something in this repository.** Done — every notice
   names its basis (a filed memo, or the Questionnaire's own recorded notice, or
   an explicit "not established").
3. **The basis was checked against what the rights holder publishes today.**
   ⚠️ **Not closed for any tool.** A first dated retrieval was made on
   2026-11-23 and is recorded in the next section; it confirmed two statuses,
   supported a third, contradicted or failed to support three notices, and
   could not reach one source. No memo, notice or status code has been updated from it yet, so
   every row below is still open.

Issue [#220](https://github.com/SPiER-Project/adoption-guide/issues/220) is the
cautionary precedent: seven LOINC codes sat in the repo looking settled for
months because nothing distinguished (2) from (3). A plausible assertion that
nothing verified reads exactly like a verified one.

## Source check, 2026-11-23

What each rights holder's own pages said on the retrieval date, set against the
status SPiER publishes. This is a reading of published terms, not legal advice.
"Not stated" means the pages read were silent, not that the answer is no.
**Nothing in `ig/input/fsh/` was changed from this check**: a row here is
evidence for step 1 of *How to close an item*, not a closed item.

| Tool | Published status | What the source says | Result |
|---|---|---|---|
| **PHQ-9** | `public-domain` | The publisher's instruction manual states the PHQ measures are in the public domain and that no permission is required to reproduce, translate, display or distribute them. The site's terms exempt the screeners from Pfizer's general copyright restrictions. Attribution, wording changes and EHR use: not stated. | **Confirmed** |
| **ASQ** | `public-domain` | NIMH's ASQ information sheet (dated 7/1/2020) describes it as a public domain tool, free of charge. NIMH's website policy puts its text and publications in the public domain, reusable without permission, with a request to cite NIMH and not to alter content misleadingly. Whether item wording may be modified: not stated for the ASQ. | **Confirmed** |
| **BSSA** | `public-domain` | No BSSA-specific statement on the toolkit pages read. The claim rests on NIMH's general policy alone. The BSSA PDFs themselves were not read. | Plausible; not separately stated |
| **C-SSRS** | `registration` | The Columbia Lighthouse Project says health and behavioral health providers need no special permission, cost or licence to use the tools or embed them in an EHR, and offers to review a site's EHR build. Registration: not mentioned. Training: offered free, not stated as required. Clinical trials need a licence. A third party redistributing the forms, changing the wording, and the copyright holder of the instrument: not stated on the pages read. | ⚠️ **The notice is stricter than the source.** It says an adopter "must register" and that some contexts require training; neither was found |
| **Stanley-Brown** | `registration` | The form's footer: copyrighted by its two authors (2008, 2021); individual use permitted. The forms page: written permission is required to translate, change wording, or reproduce or program the form in an EMR or other digital application or website for non-profit use; for-profit use is by discussion. Requests go by email to the developers with the proposed EMR build and vendor. Fee: not stated. | **Confirmed.** Maintainer-stated 2026-11-23: SPiER has permission to **show** the form, and it may not be **used in practice** without the developers' approval. The published notice was reworded the same day to say so. ⚠️ No written grant is filed in this repository |
| **CAMS** | `commercial` | CAMS-care's site terms bar selling, modifying, reproducing or distributing its content, the SSF named among it, without written permission. The SSF page says Guilford has licensed CAMS-care to work with EMR companies to include the SSF, and names a contact for EMR enquiries. Whether a self-built template is allowed: asked in the FAQ and not answered. The Therapeutic Worksheet and Stabilization Plan: no separate terms found. | Consistent |
| **PSS-3** | `unknown` (recoded from `public-domain` on 2026-11-23) | SPRC's page credits the tools to UMass Medical, funded by NIMH grants. No copyright notice and no permission statement was found on that page or on the pocket card. SAMHSA appears only as the funder of SPRC itself. The tip sheet and pocket card both say to ask the questions exactly as worded. Wording compared 2026-11-23 against the PSS-3 Primary Screener and Tip Sheet and corrected (see below). | **Recoded.** The `public-domain` claim was not supported: The notice says SAMHSA and SPRC distribute it with no permission required; no such statement was found |
| **PSS-Full** | `unknown` (recoded from `public-domain` on 2026-11-23) | Same sources as PSS-3. The published ED-SAFE Secondary Screener is a separate six-indicator tool, and SPiER's form does not reproduce it. | **Recoded**, for the same reason. Wording, response options and script compared and corrected 2026-11-23 (see below) |
| **SBQ-R** | `unknown` | No statement from the author or publisher was read. One third-party directory lists it as "Copyrighted but free" and gives the author as contact. | Stays `unknown` |
| **SAFE-T** | `public-domain` | Read in a browser, since SAMHSA refuses automated retrieval. SAMHSA's current edition (publication PEP24-01-036, December 2024, marked "Updated 2024" under the original publication number SMA 09-4432) carries **no copyright notice and no non-commercial limit**. Its acknowledgments credit the original concept to one named clinician and its development to Screening for Mental Health, Inc. and the Suicide Prevention Resource Center, under a SAMHSA grant. The SAMHSA Library's policy: its publications are in the public domain and may be downloaded, reproduced or copied without permission, provided they are not sold, with a request to acknowledge the source. | **Supported, for the 2024 edition.** ⚠️ Earlier copies of the 2009 card found by search carry a private copyright with non-commercial reproduction only; that notice was not read at source. Confirm SPiER's form follows the 2024 edition, and note the no-sale condition |
| **CRP** | `registration` | **Not reached.** The developers' site did not resolve. | Unverified |
| **CARS-S** | `commercial` | Not checked; the NO-GO stands. | — |

Sources read (all retrieved 2026-11-23):

- PHQ-9: <https://www.phqscreeners.com/select-screener>, <https://www.phqscreeners.com/terms>, and the instruction manual linked from the site
- ASQ / BSSA: <https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials>, the ASQ information sheet PDF linked from it, <https://www.nimh.nih.gov/site-info/policies>
- C-SSRS: <https://cssrs.columbia.edu/the-columbia-scale-c-ssrs/cssrs-for-communities-and-healthcare/>, <https://cssrs.columbia.edu/the-columbia-scale-c-ssrs/healthcare/>, <https://cssrs.columbia.edu/settings/research/>
- Stanley-Brown: <https://suicidesafetyplan.com/forms/>, <https://suicidesafetyplan.com/stanley-brown-safety-plan-translations/>, <https://suicidesafetyplan.com/training/>, and the form PDF dated 05-02-2024
- CAMS: <https://cams-care.com/suicide-status-form/>, <https://cams-care.com/faqs/>, <https://cams-care.com/terms-of-use/>
- PSS-3 / PSS-Full: <https://sprc.org/?p=4350> and the PSS-3 pocket card and ED-SAFE Secondary Screener PDFs linked from it
- SBQ-R: <https://www.cebc4cw.org/assessment-tool/suicide-behaviors-questionnaire-revised> (a third-party directory)
- SAFE-T: <https://library.samhsa.gov/product/safe-t-suicide-assessment-five-step-evaluation-and-triage/pep24-01-036>, the flyer PDF linked from it, and <https://library.samhsa.gov/help> (read in a browser)

### PSS-3 and PSS-Full wording, checked 2026-11-23

Compared item by item against the *Patient Safety Screener (PSS-3) and Tip
Sheet* linked from the SPRC page, which says not to skip, combine or re-word
the items.

| Item | Source | SPiER before | Now |
|---|---|---|---|
| 1 and 2, both forms | "Over the past 2 weeks, …" | "In the past two weeks, …" | Corrected |
| 3, both forms | "In your lifetime, have you ever attempted to kill yourself?" | the same | Already matched. The pocket card drops "In your lifetime"; the tip sheet is the fuller source and SPiER follows it |
| 3a, both forms | "When did this happen?" | "If yes, when did this happen?" | Corrected; the condition is the item's `enableWhen` |
| 3a options, PSS-3 | "Within the past 24 hours (including today)", "Within the last month (but not today)" | both without "the" | Corrected in the form and the code system |
| Introductory script, PSS-3 | as published | the same | Already matched |

| Response options, PSS-Full | Yes, No, "Patient unable to complete", "Patient refused" on items 1 to 3 | Yes and No only | Corrected: the two further options added, using the PSS-3 form's codes |
| 3a, PSS-Full | six fixed options | free text | Corrected: the same six coded options as the PSS-3 form |
| Introductory script, PSS-Full | as published | absent | Added |

Both Questionnaires moved to version 1.0.1. One difference from the source
remains: **PSS-3 items 2 and 3 carry an instruction inside the question text**
("A patient presenting with a current suicide attempt is an automatic Yes…").
The source states that rule in its scoring notes, not in the question.

### ASQ, Stanley-Brown and SAFE-T wording, checked 2026-11-23

**ASQ** — against NIMH's information sheet dated 7/1/2020. The five screening
questions match word for word. The two follow-up prompts differ: the sheet has
"If yes, how? … When? …" under question 4 and "If yes, please describe" under
question 5, where SPiER has a coded "when was the most recent attempt" and
"describe briefly". SPiER's prompts match the LOINC item names published for
the ASQ panel, and NIMH's toolkit carries materials dated later than this
sheet, so the current screening tool should be read before changing either.
Nothing was changed.

**SAFE-T** — against SAMHSA's December 2024 edition. The nine risk factors and
six protective factors are the edition's own lists, and steps 3 to 5 follow
it. Several entries are condensed (the life-skills protective factor, the
intent prompt, the three risk-level descriptions), and the two
clinical-judgment-override items are SPiER's. SAFE-T is a clinician guide and
not a verbatim-administered instrument, so nothing was changed in the form;
the notice now cites the edition and SAMHSA's no-sale condition.

**Stanley-Brown** — against the form dated 05-02-2024 on the authors' site.
⚠️ **SPiER's form is not the current form.** Differences:

| | Current form | SPiER |
|---|---|---|
| Number of steps | Six | Seven: a "STEP 7: THE ONE THING THAT IS MOST IMPORTANT TO ME AND WORTH LIVING FOR" follows step 6 |
| Step 1 heading | "STEP 1: WARNING SIGNS:" | adds "(Thoughts, Images, Mood, Behavior)" |
| Step 2 heading | the gloss follows a dash | the gloss is in parentheses |
| Prompts under each step | numbered blank lines | SPiER-written instructions ("List personal warning signs … (3 or more recommended)") |
| Step 5 | "Professional/Services Name", "Phone" and "Emergency Contact" as three fields, twice; then the emergency department's name, address and phone; then "Crisis Line Phone (e.g. 988)" | "Clinician/Agency Name" and a combined "Emergency Contact/Phone"; "Local Emergency Department"; the crisis line as display text |

The authors require written permission for any change to the form, and the
seven-step shape runs through the whole guide: the section code system, the
CarePlan profile (which requires all seven), the mapper, the mapping-language
transform and its golden file, and the narrative. **Nothing was changed.**
Whether the permission SPiER holds covers this adapted layout, and whether to
rebuild the form on the six-step 2024 version, are decisions for whoever holds
that permission.

What this check leaves owed, in the order it matters:

1. **Stanley-Brown** — file the written grant behind the maintainer-stated permission to show the form, and record who granted it and when. The published notice already says what it covers: display by SPiER, with use in practice requiring the authors' permission for each adopter.
2. **PSS-3 and PSS-Full** — both are now coded `unknown`. Find a permission statement from UMass or the ED-SAFE investigators before raising either.
3. **Stanley-Brown, again** — decide whether to rebuild the form on the current six-step version; see the wording check above. (SAFE-T is closed as far as a source check can close it: the notice now cites the 2024 edition.)
4. **C-SSRS** — ask the Lighthouse Project whether a third party may publish the forms as FHIR Questionnaires, then correct the notice in whichever direction the answer points.
5. **CRP** and **SBQ-R** — reach the developers directly.

## Tier 1 — no audit memo exists at all

These four instruments have **no** `ig/input/resources/questionnaires/<tool>/licensing/MEMO.md`.
Their published status was read off the copyright string already recorded on
their Questionnaire, which is itself hand-authored and unverified. Highest
priority: two of the four are restrictive, so an adopter acting on a wrong
reading has real exposure.

| Tool | Current status | Recorded notice says | What is owed |
|---|---|---|---|
| **CAMS** (TL-020 / 021 / 024, 6 ADs) | `commercial` | Training + license required from CAMS-care; SSF not to be reproduced without the CAMS-care/Guilford agreement | Confirm current CAMS-care terms; establish whether SPiER's FHIR representation is covered by any agreement SPiER holds, or whether the artifacts must be withdrawn. **Blocks a patient-facing SSF — see below.** Contact: cams-care.com |
| **Stanley-Brown** (TL-007) | `registration` | Written permission required for changes **or for use of the form in the electronic medical record** | Maintainer-stated 2026-11-23: SPiER has permission to show the form; use in practice needs the authors' permission. Still owed: the written grant on file, and a memo. Contact: suicidesafetyplan.com |
| **SBQ-R** (TL-025) | `unknown` | "© Osman et al (1999) Revised. Permission for use granted by A. Osman, MD." | Determine who the permission was granted to, whether it transfers, and what an adopter must do. Until then the status stays `unknown` — do not upgrade it on the strength of the notice alone |
| **PHQ-9** (TL-002) | `public-domain` | "No permission required to reproduce, translate, display or distribute" | Lowest risk of the four, but still unverified. File a memo recording the source of the public-domain claim |

### ⚠️ CAMS is the one item here that blocks planned work, not just a claim

Raised 2026-08-23: the CAMS SSF Section A questionnaire is **patient-completed**
(`ig/input/resources/questionnaires/CAMS/cams-ssf5-section-a.json` — titled "Section A (Patient)",
`subjectType: [Patient]`), so it is a natural first artifact for the patient app
that `docs/plans/repo-and-package-boundaries.md` §5 plans.

**It should not go there until this row is verified.**
[`docs/research/2026-07-terminology-crosswalk-research.md`](../research/2026-07-terminology-crosswalk-research.md)
rates CAMS *"Strictly commercially licensed; custom digital implementations
prohibited — integrate official templates via CAMS-care"*, and the published
ActivityDefinition copyright says the SSF "must not be reproduced without that
agreement" while admitting the terms are unverified.

A SPiER-authored SSF in a **patient-facing** app is exactly the custom digital
implementation that description prohibits, on the most exposed surface available.

⚠️ **The exposure already exists** — `cams-ssf5-section-a.json` ships in the
clinician app today, so this is a question about widening it rather than creating
it. That is a reason to verify sooner, not a reason to treat a patient app as no
different.

## Tier 2 — memo filed, source verification outstanding

Eight tools have memos. Each needs a dated confirmation against the publisher's
current terms, plus the specific open item its memo already records.

| Tool | Status | Open item recorded in the memo |
|---|---|---|
| ASQ (TL-001) | `public-domain` | Permission letter exists in non-repository storage and is still to be filed here. Whether item wording may be modified is unresolved |
| C-SSRS (TL-003 / 004 / 019 / 027) | `registration` | Confirmation that a FHIR *representation* is covered by a site's Columbia Lighthouse registration is still to be filed. TL-027 reuses the adolescent-validated screener wording; the Lighthouse Project's separate younger-child version remains a pending gate |
| CRP (TL-015) | `registration` | SPiER's permission is maintainer-confirmed (2026-07-15) but no written grant is on file. Coded `registration` because SPiER's permission does not transfer to an adopter |
| PSS-Full (TL-014) | `unknown` | Same maintainer confirmation; the site-defined stratification step is asserted to reproduce no proprietary content |
| BSSA (TL-005) | `public-domain` | Federal public-domain claim is sound but undated against NIMH's current toolkit page |
| PSS-3 (TL-011) | `unknown` | As above, against SAMHSA/SPRC |
| SAFE-T (TL-006) | `public-domain` | As above, against SAMHSA |
| CARS-S (TL-028) | `commercial` | NO-GO stands: permission not requested, none on file. No CARS item content is reproduced anywhere in the repo. Revisit only if a permission grant is obtained |

## Tier 3 — SPiER-authored (23 ADs)

Workflow activities that reproduce no third-party instrument, published under
the IG's CC0-1.0. Nothing to verify with a rights holder. Three carry a
third-party caveat worth re-reading if their scope changes:

- **TL-008 Means Safety** — a site delivering counseling via a named protocol
  (CALM or similar) takes that protocol's materials under its own terms.
- **TL-010 Caring Contacts** — message templates adopted from a published
  program carry that program's terms.
- **TL-013 Crisis Resources** — the code displays *name* third-party services
  (988, Crisis Text Line, Now Matters Now). Naming a service is not a grant to
  reproduce its content or branding.

## Sources that are NOT verification

- `docs/research/2026-07-terminology-crosswalk-research.md` Part C is the output
  of an AI research run and is **self-labelled plausible-but-unverified**. It
  also got TL-005 wrong (BSSA is the NIMH Brief Suicide Safety Assessment, not
  the Pearson Beck Scale). Useful as a starting point for who to contact; not
  usable as a basis for a `copyright` string.
- The copyright strings on the Questionnaires in `ig/input/resources/questionnaires/` — these are
  hand-authored transcriptions. They are the best in-repo evidence, which is why
  #127 used them, but transcription is not verification.

## Not an instrument: the brand typeface

**Area Normal** (Blaze Type) is the display face of the 2026 website redesign,
and `packages/ui/src/foundation.css` names it first in `--font-display`. **No web licence is
on file**, so the app ships no Area files and renders headings in Manrope; the
`@font-face` block is commented out at the top of that file. The live site's own
WOFFs are not a source — one is named `fonnts.com-…`, a free-download mirror.
To close: obtain a Blaze Type web licence covering the app's origins, drop the
licensed WOFF2 files into `public/fonts/area/`, uncomment the block, and
record the licence and its retrieval date here.

## How to close an item

1. Retrieve the rights holder's current published terms; record the URL and the
   retrieval date.
2. Write or update `ig/input/resources/questionnaires/<tool>/licensing/MEMO.md` from
   [`licensing-audit-template.md`](licensing-audit-template.md).
3. Update the `copyright` notice and, if it changed, the
   `instrument-licensing-status` code in `ig/input/fsh/` — the notice must name
   the memo as its basis instead of the Questionnaire string.
4. Re-run `npx fsh-sushi .`, `node scripts/validate-fhir.mjs`, and
   `npm run verify` at the repo root. Move the row out of this file.

Do not upgrade a status to a more permissive code without step 1. `unknown` is a
legitimate published state; a wrong `public-domain` is not.
