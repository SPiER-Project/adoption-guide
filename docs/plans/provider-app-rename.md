# Plan 1 — "Patient App" becomes "Provider App"

**Status:** planned, 2026-09-17. Self-contained. Run this BEFORE
[`guide-navigation-regroup.md`](guide-navigation-regroup.md), which reorders the
same file.

## Why

The patient-level SMART app is used by a clinician, launched from a patient's
chart. Calling it the "Patient App" names its *subject*, not its *user*, and it
collides with the thing that does not exist yet: an app a patient launches for
themselves. Naming the clinician-facing one "Provider App" leaves "Patient App"
free for when that is built.

⚠️ **Not every "patient app" in the repo is this app.** Two documents use the
phrase to mean the future patient-facing app, and they must be left alone:

- `docs/plans/repo-and-package-boundaries.md` — §5 and the "The patient app is
  the genuine exception" section. That document's whole argument is about a
  *future* patient-facing app triggering a package extraction.
- `docs/best-practices/licensing-verification-backlog.md` — "a natural first
  artifact for the patient app", about `subjectType: [Patient]`.

Grep, then read each hit before changing it.

## Scope

### Rename inventory

| File | What changes |
| --- | --- |
| `web/src/data/guideSections.ts` | `{ path: 'patient-app', label: 'Patient App' }` → `{ path: 'provider-app', label: 'Provider App' }`. Section comments above it. |
| `web/src/App.tsx` | `<Route path="patient-app" element={<PatientAppGuide />} />` → `provider-app`. Add `<Route path="patient-app" element={<Navigate to="/guide/provider-app" replace />} />`. Repoint `/patient/chart`'s `<Navigate>`. |
| `web/src/pages/PatientAppGuide.tsx` | Rename file → `ProviderAppGuide.tsx`, export → `ProviderAppGuide`. Update the header comment and the prose (see "Describe it as a chart launch"). |
| `web/src/content/overview.ts` | the `Patient App` markdown link pointing at `/guide/patient-app`, plus the three prose uses of "the patient app". ⚠️ Write route paths as inline code here, never as a markdown link — `check-md-links.mjs` reads a root-relative link as a file path and aborts. |
| `web/src/components/Sidebar.tsx` | The history comment's `Adoption Guide → Patient App` line. |
| `web/src/components/Sidebar.test.tsx` | `getAllByRole('link', { name: 'Patient App' })` and the two comments naming it. |
| `web/src/pages/AdoptionReadiness.tsx` | `'…demoable in the patient app…'`. |
| `docs/` | `mock-ehr-demo-script.md` and any other tracked `.md` naming the guide section. **Excluding the two files listed above.** |

### Route decision

`/guide/patient-app` is published and is the target of `/patient/chart`. Keep it
as a `<Navigate>` to `/guide/provider-app` rather than deleting it. `check:catalog`
validates every `<Navigate>` target against the route table, so a stranded
redirect fails the gate rather than rotting into the catch-all.

### Describe it as a chart launch

The page's opening currently says "An EHR launches it from a patient's chart".
Make that the headline claim rather than a clause, and say what it is not:

- It is the **clinician's** view of a patient's suicide-safer care pathway.
- It is launched **from the chart**, by an activity button or a CDS Hooks card
  whose link is `type: "smart"`.
- A **patient-facing** app is a separate thing SPiER does not ship today. Say so
  in one sentence so a reader does not assume it exists.

Add that third point as a short `<Notice>` at the end of the intro section.

## Gates

```
cd web && npm run verify
```

Specifically: `check:catalog` (guide section → route, and every `<Navigate>`
target), `check:guide-boundary` (it reads `guideSections.ts` for section paths
and `App.tsx` for each section's component — the route must keep the exact
`<Route path="x" element={<Comp />}>` shape), and `Sidebar.test.tsx`.

```
node scripts/check-md-links.mjs
```

## Done when

- The sidebar reads **Provider App**, the page title reads **Provider App**, and
  the page's first paragraph says a clinician launches it from a chart.
- `/guide/patient-app` and `/patient/chart` both still land on it.
- The two documents about the future patient-facing app are untouched.
- `npm run verify` and `check-md-links.mjs` are green.
