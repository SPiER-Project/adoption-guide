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
   ⚠️ **Not done for any tool.** Even the eight filed memos were written from
   secondary reading, not from a dated retrieval of the publisher's current
   terms.

Issue [#220](https://github.com/SPiER-Project/adoption-guide/issues/220) is the
cautionary precedent: seven LOINC codes sat in the repo looking settled for
months because nothing distinguished (2) from (3). A plausible assertion that
nothing verified reads exactly like a verified one.

## Tier 1 — no audit memo exists at all

These four instruments have **no** `FHIR-Resources/<tool>/licensing/MEMO.md`.
Their published status was read off the copyright string already recorded on
their Questionnaire, which is itself hand-authored and unverified. Highest
priority: two of the four are restrictive, so an adopter acting on a wrong
reading has real exposure.

| Tool | Current status | Recorded notice says | What is owed |
|---|---|---|---|
| **CAMS** (TL-020 / 021 / 024, 6 ADs) | `commercial` | Training + license required from CAMS-care; SSF not to be reproduced without the CAMS-care/Guilford agreement | Confirm current CAMS-care terms; establish whether SPiER's FHIR representation is covered by any agreement SPiER holds, or whether the artifacts must be withdrawn. **Blocks a patient-facing SSF — see below.** Contact: cams-care.com |
| **Stanley-Brown** (TL-007) | `registration` | Written permission required for changes **or for use of the form in the electronic medical record** | This is exactly what SPiER publishes. Establish whether SPiER has (or needs) that permission, and what an adopting site must obtain. Contact: suicidesafetyplan.com |
| **SBQ-R** (TL-025) | `unknown` | "© Osman et al (1999) Revised. Permission for use granted by A. Osman, MD." | Determine who the permission was granted to, whether it transfers, and what an adopter must do. Until then the status stays `unknown` — do not upgrade it on the strength of the notice alone |
| **PHQ-9** (TL-002) | `public-domain` | "No permission required to reproduce, translate, display or distribute" | Lowest risk of the four, but still unverified. File a memo recording the source of the public-domain claim |

### ⚠️ CAMS is the one item here that blocks planned work, not just a claim

Raised 2026-08-23: the CAMS SSF Section A questionnaire is **patient-completed**
(`FHIR-Resources/CAMS/cams-ssf5-section-a.json` — titled "Section A (Patient)",
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
| PSS-Full (TL-014) | `public-domain` | Same maintainer confirmation; the site-defined stratification step is asserted to reproduce no proprietary content |
| BSSA (TL-005) | `public-domain` | Federal public-domain claim is sound but undated against NIMH's current toolkit page |
| PSS-3 (TL-011) | `public-domain` | As above, against SAMHSA/SPRC |
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
- The copyright strings on the Questionnaires in `FHIR-Resources/` — these are
  hand-authored transcriptions. They are the best in-repo evidence, which is why
  #127 used them, but transcription is not verification.

## How to close an item

1. Retrieve the rights holder's current published terms; record the URL and the
   retrieval date.
2. Write or update `FHIR-Resources/<tool>/licensing/MEMO.md` from
   [`licensing-audit-template.md`](licensing-audit-template.md).
3. Update the `copyright` notice and, if it changed, the
   `instrument-licensing-status` code in `ig/input/fsh/` — the notice must name
   the memo as its basis instead of the Questionnaire string.
4. Re-run `npx fsh-sushi .`, `node scripts/validate-fhir.mjs`, and
   `npm run verify` in `web/`. Move the row out of this file.

Do not upgrade a status to a more permissive code without step 1. `unknown` is a
legitimate published state; a wrong `public-domain` is not.
