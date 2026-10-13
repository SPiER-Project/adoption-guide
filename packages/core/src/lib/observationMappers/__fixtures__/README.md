# Foreign QuestionnaireResponse fixtures

`bhp-cssrs-example.json` and `bhp-phq9-example.json` are the **verbatim example
QuestionnaireResponses published by the HL7/ASTP US Behavioral Health Profiles
IG** (`fhir.astp.bhp#0.1.0`), fetched 2026-08-12 from:

- <https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/QuestionnaireResponse-C-SSRS-example-1.json>
- <https://build.fhir.org/ig/HL7/us-behavioral-health-profiles/QuestionnaireResponse-phq-9-example-1.json>

The only edit is the removal of `text` (the generated XHTML narrative), which is
large and plays no part in dispatch. Nothing else — including the linkIds, the
answer codings and the `questionnaire` value — has been touched.

## Why they are checked in rather than hand-written

`fallbackDispatch.ts` exists to recognize a QuestionnaireResponse authored by
*someone else*. A hand-written "foreign" fixture only tests the shape we
imagined; these test the shape a federally funded IG actually publishes, and
they are the shape the SAMHSA/ASTP pilot cohort is being asked to produce.

They are load-bearing in two specific ways, both of which the tests assert:

1. **The code lives in `linkId`** — `"/44250-9"`, with a leading slash. There is
   no `item.code` (R4 `QuestionnaireResponse.item` has no such element) and no
   `contained` Questionnaire. Before `linkIdAsCode`, SPiER could not recognize
   either file.
2. **`questionnaire` on the C-SSRS example points at a PDF** on cms.gov, not a
   `Questionnaire` canonical — so Tier-1 canonical dispatch cannot fire, and the
   fixture genuinely exercises the fallback rather than sneaking past it.

## The NLM LHC-Forms PHQ-9 responses

`nlm-phq9-qr-17746.json` and `nlm-phq9-qr-17653.json` are PHQ-9
QuestionnaireResponses from **NLM's public LHC-Forms FHIR server**, a second
producer, authored 2019 and tagged `lforms-demo`. Fetched 2026-10-12 from:

- <https://lforms-fhir.nlm.nih.gov/baseR4/QuestionnaireResponse/qr-17746>
- <https://lforms-fhir.nlm.nih.gov/baseR4/QuestionnaireResponse/qr-17653>

The server holds four PHQ-9 responses (`?questionnaire=Questionnaire/44249-1-x`).
qr-17757 and qr-17735 carry the same answers as qr-17746, so they add nothing.

Two edits, both outside anything dispatch reads:

- **`subject` is removed.** It named a SMART sandbox patient by display name.
  The patient is almost certainly synthetic, but that can't be confirmed from
  the resource, and this repo commits synthetic or de-identified data only.
- **`meta.versionId`, `meta.lastUpdated` and `meta.source` are removed.** The
  server re-stamps them every time it reloads its demo data. `meta.profile` and
  `meta.tag` are kept.

The items, the linkIds, the answer codings, `questionnaire`, `status` and
`authored` are untouched.

They test what the BHP example does not:

1. **`questionnaire` is a server-local reference** (`Questionnaire/44249-1-x`),
   not a canonical, so Tier 1 cannot fire.
2. **Item 9 is endorsed** in both: "Nearly every day" in qr-17746, "More than
   half the days" in qr-17653. The BHP example answers "Not at all", so before
   these, no real-world fixture exercised SPiER's trigger into Clarify Risk.
3. **The reported total is a `valueQuantity`** (`{score}`), not the BHP
   example's `valueDecimal`. SPiER never reads it; the tests compare it with the
   total SPiER derives from the nine items (15 and 8).
4. **qr-17653 also answers the difficulty item** (`69722-7`), which is not one
   of the nine scored items and must not get in the way.

If these files start failing after an upstream change, do **not** edit them to
suit the code. Re-fetch them, confirm the upstream shape really changed, and fix
the dispatcher — the whole point is that they are not ours to adjust.

Background: `docs/research/2026-08-us-behavioral-health-profiles-ig.md`.
