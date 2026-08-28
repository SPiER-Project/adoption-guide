# Stage 7 — Track Risk Over Time: FHIR design

Design for the five Stage-7 tools, authored **before** per-tool implementation
per [`ssc-stage-tiles-rollout.md`](archive/ssc-stage-tiles-rollout.md) Wave 5
("Do stage 7 as one design PR first, then implement per-tool"). Now also
records what shipped and what the build changed — see *Implementation status*
below.

Artifacts: [`ig/input/fsh/risk-episode.fsh`](../../ig/input/fsh/risk-episode.fsh).
Requirements source: [`docs/reference/ssc-stage-tiles-question-set.md`](../reference/ssc-stage-tiles-question-set.md),
Stage Tile 7.

---

## The core insight

Stage 7 catalogues five tools, but they are **not five independent artifacts**.
They are five views of one longitudinal structure — an *episode* with *work
hanging off it*. Modelling them separately would produce five disconnected
resources that can't answer the question the tile actually exists to answer:
*"who is currently at risk, what is outstanding for them, and what is overdue?"*

So the design is one anchor plus one work item, reused:

| Tool | Resource | How |
|---|---|---|
| **TL-038** Suicide-Risk Episode / Pathway Status | `EpisodeOfCare` → `SPiERSuicideRiskEpisode` | **Is** the episode: entry reason, current tier, owner/team, open→closed lifecycle with closure reason |
| **TL-037** Active Registry / Work Queue | *(none — a query)* | A search over open episodes + their tasks. See below. |
| **TL-039** Reassessment / Risk Review Schedule | `Task` → `SPiERSafetyTask` | `code = reassessment-due`, due date in `restriction.period.end` |
| **TL-040** Open Safety Actions / Care Gaps | `Task` → `SPiERSafetyTask` | `code` = one of the care-gap codes (safety plan needed, lethal means open, referral incomplete, …) |
| **TL-041** Risk Escalation / Overdue Workflow | `Task` → `SPiERSafetyTask` | `code = escalation` + `escalation-trigger` extension (repeating) |
| *(chart banner)* | `Flag` → `SPiERSuicideRiskFlag` | Announces an open episode; no clinical detail |

Every task links to its episode via `Task.basedOn`, which is what makes the
registry query possible at all.

---

## Design decisions worth reviewing

### 1. The registry (TL-037) is a query, not a resource

The SSC asks whether staff "can view active suicide-risk patients in one place"
with owner, due date, and escalation status visible. That is a **work-queue
view**, and materializing it as a stored FHIR resource (a `Group`, or a
bespoke registry resource) would immediately drift from the episodes it
summarizes.

Instead it is a search over the anchor:

```
GET /EpisodeOfCare?type=suicide-safer-care&status=active&_revinclude=Task:based-on
```

…filtered/sorted client-side by the `episode-current-risk-tier` extension and
each task's `restriction.period.end`. Every column the SSC lists (risk status,
last assessment, next reassessment due, safety-plan status, open tasks, owner,
escalation status) is derivable from that one query.

**Consequence:** TL-037 gets no ActivityDefinition output profile. Its
implementation is a Population-view work queue, not a new artifact. That is a
deliberate call and the main thing to sanity-check in review.

### 2. "Overdue" is computed, never stored

`restriction.period.end < now AND status != completed` ⇒ overdue. Storing an
`overdue` flag would require a sweeper job and would be wrong between sweeps —
a patient could read as on-time while actually overdue. `Task.businessStatus`
is available for genuinely *workflow* state ("routed to crisis team"), not for
time-derived state.

### 3. One Task profile, three tools

TL-039 / TL-040 / TL-041 differ by `Task.code`, not by structure — all three are
"open, owned, due-dated work on an episode". One profile keeps the registry
query trivial (one `_revinclude`) and prevents three near-identical profiles
drifting. Escalation gets the one thing it genuinely adds: a repeating
`escalation-trigger` extension, because the SSC explicitly allows multiple
simultaneous triggers.

### 4. Entry/closure reasons are extensions because R4 lacks them

R4 `EpisodeOfCare` has **no `reason` element** (R5 adds `EpisodeOfCare.reason`).
The SSC requires both a reason for entry and — for the top score — a closure
reason *plus* a final status. So both ride as extensions, with `status` +
`statusHistory` carrying the final-status half. When the IG moves to R5 these
extensions collapse into the core element.

### 5. Current risk tier is a denormalized cache — deliberately

`episode-current-risk-tier` duplicates the latest concept-layer
`SPiERSuicideRiskConcept` Observation onto the episode. Duplication is normally
a smell, but a registry that must sort hundreds of patients by tier cannot join
the full observation history per row. The extension documents that the
Observation history stays the source of truth and producers **must** refresh the
cache when a newer risk Observation lands. If that guarantee feels too fragile
to rely on, the alternative is to drop the extension and make the registry
resolve tier per patient — slower, but no staleness risk. **Decided 2026-07-15:
keep the cache** (see *Resolved decisions*).

### 6. The Flag carries no clinical detail

A chart banner is the least access-controlled surface in most EHRs. The flag
states only that an episode is open; tier, assessment results, and history stay
on the episode and its Observations. This is a privacy call, not a FHIR
constraint.

### 7. Terminology is SPiER-local, lifted verbatim from the SSC

No published LOINC/SNOMED value set covers episode-entry reasons, closure
reasons, safety-task types, or escalation triggers. All five CodeSystems are
SPiER-local, with codes taken **directly from the SSC question set's own
multiselect options** so an adopter's SSC answers map 1:1 onto the encoding.

The `Flag.code` deliberately stays local: a SNOMED binding (candidate concept
"At risk for suicide") is a follow-up that must be validated against a real
SNOMED release first — earlier SPiER artifacts carried codes with invalid check
digits or that resolved to unrelated concepts (see `stanley-brown.fsh`), so
unverified codes are not asserted here.

---

## Implementation status

| Step | State |
|---|---|
| Profiles + terminology + this doc | ✅ merged (#196) |
| All five ADs promoted + stage PD outputs + catalog metadata | ✅ merged (#197) |
| Data layer, recorders, registry work queue | ✅ this PR |

Delivered in the implementation PR:

- **Data layer** — `episodes` / `flags` / `tasks` buckets on `PatientSlice`
  (optional, like `communications`, so persisted slices and scenario JSON stay
  valid), routing in `localDataSource` and `smartDataSource`, and activity-feed
  labels in `registry.ts`.
- **TL-038 recorder** (`/patient/workflow/risk-episode`) — opens an episode and
  raises the flag; closes it and clears the flag in the same action.
- **TL-039/040/041 recorder** (`/patient/workflow/safety-tasks`) — one form for
  all three, switching on task type; escalation reveals the trigger checkboxes.
- **TL-037 work queue** — an "Open Work" column on the Population view, rolled
  up per patient by `deriveEpisodeRollup` in `registry.ts`.

### Two things the implementation forced that the design missed

1. **Writes must upsert by id, not append.** Every other SPiER artifact is an
   immutable point-in-time record, so the stores append. Stage-7 resources have
   a *lifecycle* — the close of an episode is another save of the *same*
   resource — and appending left a stale open copy behind, which showed up as a
   phantom row in the work queue. `localDataSource` now upserts these three
   types by id, and `smartDataSource` PUTs them (update-as-create, preserving
   the client id) instead of POSTing.
2. **`subject` is the wrong element for two of the three.** `toCreatePayload`
   hard-coded `subject`, but `EpisodeOfCare` uses `patient` and `Task` uses
   `for`. Writing `subject` would have produced invalid FHIR that a strict
   server rejects and a lenient one silently drops — losing the patient link.
   A `patientRefField()` helper now picks the right element per resource type.

## Resolved decisions

The design's open questions were decided on 2026-07-15:

- **Episode granularity → one episode per risk period.** A patient may have
  several distinct episodes over time, with at most one open. The recorder makes
  this structural rather than a validation message: it offers "open" only when
  nothing is open, and "close" otherwise.
- **Tier cache → keep it.** The `episode-current-risk-tier` extension stays, so
  the work queue can sort by tier without joining observation history per row.
  Producers must refresh it when a newer risk Observation lands.
- **`Task.owner` → left unconstrained** for now (accepts any reference,
  including a plain display string in the demo). Tightening to
  `Practitioner | PractitionerRole | CareTeam` stays available as a purely
  additive change.
- **Flag lifecycle → automated in the recorder.** Closing an episode clears its
  flag in the same action, so a banner cannot outlive the episode it announces.

## Still open

- **SMART update-as-create.** The PUT path assumes the server accepts a
  client-supplied id. A server that rejects it will surface a write error rather
  than silently duplicating — but full id-mapping for SMART mode is unbuilt.
- **Registry filtering.** The work queue currently shows open work as a column;
  a dedicated "open episodes only" filter and sort-by-overdue are not yet wired.
