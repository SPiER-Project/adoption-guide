# Plan 2 — The clinician-facing app carries no FHIR view

**Status:** IMPLEMENTED 2026-09-17. Kept for the reasoning. Three things went
differently from the plan below, each for a reason recorded in the code:

1. **A context, not a prop.** Seven components render FHIR and four of them are
   reached from both surfaces, so a prop would have to be threaded through every
   page that renders any of them. `InspectContext` defaults to false and the
   guide turns it on: the invariant became *inspection is on inside `/guide` and
   off everywhere else*, which also picked up `PathwayView` and `MeasureDashboard`
   — both clinician-facing, neither on the plan's list.
2. **`CarePlanDisplay` was missing from the inventory.** It renders its own
   `<pre>{JSON.stringify(…)}</pre>` plus a "Download CarePlan JSON" button rather
   than going through `FhirJsonViewer`, so building the list from the viewer's
   call sites missed it. Gated by hand.
⚠️ **Superseded in two places by the tool-view audit (2026-09-17), same day.**
`StanleyBrownView` — §B's second row — no longer exists: it was a near-copy of
`QuestionnaireView` with no load-bearing divergence, and it is now an entry in
`TOOL_VIEWS` like the other seventeen fillers. And finding 2 below, the missing
inventory entry, is now mechanically derived rather than written down: see
`npm run check:fhir-render` and
[`docs/internals/tool-views.md`](../internals/tool-views.md).

3. **The try route is a sibling of the `/guide` layout, not a child, and not a
   `guideSections.ts` entry.** The views render their own `PageHeader` (two on a
   page fails `check:template`), and a route that writes to patient context is
   not a guide page. `toolViews.test.ts` covers it instead. Independent of the other three plans, but it
adds routes under `/guide/tools/`, so run it before or after
[`guide-navigation-regroup.md`](guide-navigation-regroup.md), not concurrently.

## Why

The provider app should read as something a health system would adopt into its
own SMART on FHIR application. Raw FHIR JSON beside an instrument is a developer
affordance. A clinician filling in a C-SSRS has no use for it, and its presence
is the single clearest signal that the app is a demo rather than a product.

The Adoption Guide is where the wire format belongs, and it already shows it:
Data Dictionary, Tools, Care Pathway, CDS Service.

## The constraint that decides the design

**The 18 instrument fillers are one component on one route family.**
`/patient/assessments/asq` renders `QuestionnaireView`, and three different
callers point at it:

1. The guide's Tools catalog (`tool-ui-metadata.ts` → `launchActions[].path`).
2. CDS Hooks cards, via `smartIntent` → `launchPathForIntent`.
3. SMART `intent` on a launch the mock EHR mints.

Callers 2 and 3 are clinicians. Caller 1 is an implementer reading the guide.
Deleting the FHIR drawers outright would serve 2 and 3 and break 1.

**Decision (Brad, 2026-09-17): give the guide its own route family.** The
clinician path goes clean; the guide gets a parallel path that renders the same
component with inspection on. The 36 catalog launch paths keep their targets, so
`check:catalog` is unaffected.

```
Clinician   /patient/assessments/asq        → clean
Guide       /guide/tools/asq/try            → FHIR drawers
```

## Scope

### A. Make inspection a prop, not a context read

`packages/tool-views/src/components/CodeDrawer.tsx` currently reads `usePresentation()` and
renders in both chromes. Change it to render nothing unless told to.

- Add an `inspect: boolean` prop threaded from the route, not from chrome mode.
  Chrome mode still decides the *shape* (sidebar vs bottom drawer) when it does
  render.
- `CodeDrawer` returns `null` when `inspect` is false.

Do **not** reuse `chromeMode`. A standalone `/patient/record` browse is still the
clinician's app; it should be clean too. Do not reuse `IS_DEMO` either — the
public demo site is the clinical build's own showcase and must look production-
grade there.

### B. Thread the flag through the five clinician-facing views

| File | Current | After |
| --- | --- | --- |
| `components/QuestionnaireView.tsx` | `<CodeDrawer>` with Questionnaire, live QR, writeback report | rendered only when `inspect` |
| `components/StanleyBrownView.tsx` | `<CodeDrawer>` with Questionnaire + live QR | same |
| `components/WorkflowForm.tsx` | `<CodeDrawer>` with the draft resource | same |
| `components/PatientDocuments.tsx` | `<FhirJsonViewer data={d.resource}>` per document | drop on the clinician route |
| `components/PatientPathway.tsx` | `<FhirJsonViewer data={card} title="View CDS Hooks card JSON">` | drop on the clinician route |

`QuestionnaireView`, `StanleyBrownView` and `WorkflowForm` take the prop.
`PatientDocuments` and `PatientPathway` sit inside `PatientChart`, which is
always the clinician surface — those two can drop the viewer with no prop.

⚠️ The writeback scorecard (`WritebackScorecard.tsx`) is **not** a FHIR view. It
reports which resources landed in the EHR, in clinical terms. Keep it.

### C. Register the guide's try-it routes

In `App.tsx`, inside the `IS_DEMO` guide block:

```
<Route path="tools/:slug/try" element={<ToolTryIt />} />
```

`ToolTryIt` resolves the slug against the tool catalog and renders the same view
component the clinician route renders, with `inspect`. The existing
`/guide/tools/:slug/plan` redirect (`App.tsx:111`) is the precedent for this
shape.

⚠️ **`check:guide-boundary` walks guide page imports transitively** and fails on
`@spier/demo-population`, either concrete data source, or `useRegistrySlices`.
`QuestionnaireView` imports `usePatient()` for `addResponse` / `addCarePlan` /
`writebackReport`, which is patient *context*, not patient *data* — the gate
permits that (see its header comment). Verify this by running the gate early,
not at the end: if it fails, the fallback is to register the try-it routes
outside `guideSections.ts` and link them from Tools, accepting that they sit
outside the gated page set.

### D. Point the Tools catalog at the guide route

`components/ToolDetail.tsx` renders `tool.launchActions`. Add a second button,
"Try it with the FHIR view", built from the tool's slug → `/guide/tools/{slug}/try`.

Leave `launchActions[].path` in `tool-ui-metadata.ts` alone. Those are the
clinician launch paths and `check:catalog` asserts all 36 of them.

### E. Say what changed, where it is documented

- `pages/ProviderAppGuide.tsx` (or `PatientAppGuide.tsx` if plan 1 has not run):
  one sentence saying the app shows no raw FHIR to a clinician, and pointing at
  Tools and the Data Dictionary for the wire format.
- Header comment on `CodeDrawer.tsx`: replace the chrome-mode reasoning with the
  inspect-prop reasoning. The measured panel-reachability argument still applies
  to the drawer's *shape*; keep it.

## Gates

```
cd web && npm run verify
npm run build:clinical && npm run check:surface
```

`check:css-dead` will flag any `.debug-sidebar` / `.code-drawer` rules that no
longer have a referencing component. Delete the rules rather than suppressing the
gate — except the ones the try-it route still renders.

## Done when

- Launching any instrument from the mock EHR chart, from a CDS card, or from
  `/patient/record` shows no JSON anywhere.
- `/guide/tools/asq/try` shows the ASQ with the Questionnaire definition, the
  live QuestionnaireResponse and the writeback ladder, as `/patient/assessments/asq`
  does today.
- The 36 catalog launch paths are unchanged and `check:catalog` is green.
