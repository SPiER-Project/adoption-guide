# Stanley-Brown: QuestionnaireResponse → CarePlan

**This document is a pointer.** The mapping it used to describe in prose is now
declared as a FHIR StructureMap and executed by a runtime mapper, and the two
are held in agreement by a golden file — so a prose table here could only go
stale against three things at once.

| | |
|---|---|
| **The declaration** | [`ig/input/resources/maps/StanleyBrownQRToCarePlan.fml`](../../../ig/input/resources/maps/StanleyBrownQRToCarePlan.fml) — every step's `linkId`, its target activity, and the exact string formatting, including how repeating answers are joined and how step 5 appends the local emergency department. It is what the Document Safety Actions stage names in `PlanDefinition.action.transform`. |
| **The runtime** | `packages/core/src/lib/carePlanMappers/stanleyBrown.ts` — the executable implementation the demo runs |
| **The golden file** | `scripts/fixtures/stanley-brown/careplan-expected.json` — both sides are compared against it: the FML by `node scripts/check-fml.mjs --tx https://tx.fhir.org`, the TypeScript by `stanleyBrown.parity.test.ts` |
| **The conformance target** | The `SPiERStanleyBrownSafetyPlan` profile in [`ig/input/fsh/stanley-brown.fsh`](../../../ig/input/fsh/stanley-brown.fsh), which declares all seven steps as named slices |

⚠️ **Change the transformation and you change both sides.** They exist twice on
purpose, and `CLAUDE.md` explains the arrangement and which fields the parity
comparison deliberately excludes.

## Why the text is embedded rather than referenced

This is the one design decision the artifacts cannot express on their own, so it
is worth stating plainly — it is now also carried in the StructureMap's own
published description.

The CarePlan duplicates the patient's answers into
`activity.detail.description` instead of simply referencing the
QuestionnaireResponse that produced them. FHIR permits the reference, and it
would avoid the duplication. But it makes reading the safety plan conditional on
the receiving system being able and willing to resolve that reference — and a
safety plan a clinician cannot read the moment they open the chart is not
functioning as a safety plan. Embedding lets any standard EHR display the coping
strategies and emergency contacts with no secondary lookup. The
QuestionnaireResponse remains the provenance record; the CarePlan is the copy
meant to be read.

A related consequence, declared in the map: a step with no content still gets an
activity, carrying an explicit *"No … provided."* description rather than being
omitted. The profile requires all seven, and an absent activity would otherwise
be indistinguishable from an unanswered one.
