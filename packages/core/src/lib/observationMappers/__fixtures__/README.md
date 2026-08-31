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

If these files start failing after an upstream change, do **not** edit them to
suit the code. Re-fetch them, confirm the upstream shape really changed, and fix
the dispatcher — the whole point is that they are not ours to adjust.

Background: `docs/research/2026-08-us-behavioral-health-profiles-ig.md`.
