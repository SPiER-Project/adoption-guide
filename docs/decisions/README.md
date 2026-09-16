# Decision records

Rationale that used to live on IG pages and no longer does. Each file records
one decision the artifacts embody: what was decided, why, what was rejected,
and what would reopen it. The rule itself stays in the IG (usually on
[Conformance](../../ig/input/pagecontent/conformance.md)); the argument for the
rule lives here, because an implementer needs the rule in the next five minutes
and the argument only when they disagree with it.

Started 2026-09-16 by the IG cleanup
([`plans/ig-cleanup-audit-2026-09-16.md`](../plans/ig-cleanup-audit-2026-09-16.md)),
which found every IG page following the pattern *rule, then the defence of the
rule, then the history of the defence* and moved the last two here. The
intended long-term home is the Adoption Guide's Learn group; until a page there
exists, this folder is the record.

A record keeps its historical wording and dates. If a decision is reversed,
add a dated note at the top rather than rewriting the record.

* [`behavioral-health-profiles-alignment.md`](behavioral-health-profiles-alignment.md) — same LOINC codes as the HL7 US Behavioral Health Profiles IG, no package dependency on it: the fixtures that prove the alignment and the August 2026 inspection that deferred the dependency.
* [`crosswalk-kinds.md`](crosswalk-kinds.md) — ConceptMap for coded dispositions, StructureMap for values, why the ASQ and C-SSRS carry both, and why no CAMS rating maps to `imminent`.
* [`domain-category-required.md`](domain-category-required.md) — why the suicide-risk domain slice is `1..1`, additive and orthogonal to the stage axis, and the category-loss defect that shaped the named slices.
* [`follow-up-artifact-shapes.md`](follow-up-artifact-shapes.md) — one outreach profile for two tools, why a caring contact is a separate profile with no outcome, and why its floor is low.
* [`handoff-artifact-shapes.md`](handoff-artifact-shapes.md) — the discharge packet as a DocumentReference, what it says about what it withheld, and the sharing consent on native Consent structures.
* [`interpretation-vocabularies.md`](interpretation-vocabularies.md) — `POS`/`NEG` on the concept layer, `A`/`H`/`L` on the instrument layer: an open inconsistency, recorded as such.
* [`licensing-status-code.md`](licensing-status-code.md) — a coded extension rather than R5's `copyrightLabel`, why `unknown` is a real value, and the limit of every status.
* [`measure-design.md`](measure-design.md) — the Stage 5–7 modelling calls the Stage-8 measures depend on (ServiceRequest for referrals, `Appointment.status`, the opt-out exclusion, one content vocabulary, exception vs exclusion), the patient-based population basis, and why the dashboard, export and sharing tools define no artifact.
* [`pathway-not-encoded.md`](pathway-not-encoded.md) — the four things the source diagram states that the pathway PlanDefinition leaves out (step-down criteria, milestone events, a "historical" tier, contact frequency) and why the cadence is referenced, never restated.
* [`placeholder-activitydefinitions.md`](placeholder-activitydefinitions.md) — why the three placeholder steps carry no codes, and what a code-less ActivityDefinition means to a consumer.
* [`record-retrieval-in-r4.md`](record-retrieval-in-r4.md) — why the whole record is one query per resource type and one episode is an Encounter hop: the three R4 types with no `category`, the elements that cannot point at an EpisodeOfCare, and the episode-trigger extension.
* [`safety-plan-section-codes.md`](safety-plan-section-codes.md) — the LOINC 2.82 search that came up empty and its three near-misses; `87626-8` as a discoverability tag, not a document claim; why the safety-plan and CAMS section systems stay separate.
* [`stage-7-artifact-shapes.md`](stage-7-artifact-shapes.md) — one Task profile for three Stage-7 tools, "overdue" as a query rather than a state, and the Encounter as the correlation hinge.
* [`suicide-related-problem-set.md`](suicide-related-problem-set.md) — enumerated not intensional, the `86849004` mis-citation, the reasoning inside each grouping, why depression is verified but not a member, and why a CAMS driver stays narrative.
* [`tier-derivation-required-items.md`](tier-derivation-required-items.md) — why a Questionnaire item whose value is computed is never `required`, and the three C-SSRS forms that got it wrong.
* [`zero-suicide-mapping.md`](zero-suicide-mapping.md) — why Lead and Train are out of scope, why *Identify* is three stages and *Transition* two, why *Treat* is one and *Improve* is light.
