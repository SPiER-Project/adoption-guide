# `apps/clinical` — the two SMART apps

The patient chart and the population dashboard: what a clinician is **launched
into** from their EHR. Served by `services/clinical`, which the mock EHR frames
(`DEFAULT_PANEL_BASE_URL`) and Medplum launches into.

Built with `npm run build:clinical` from `web/`; the output is
`web/dist-clinical`.

## Nobody browsed here

`/` goes to `/patient/record`, not to a front door. There is no guide route and
no `/ig/` — the IG is ~4,000 files of implementer documentation and this surface
has no implementer on it; `services/clinical/README.md` has the detail, and
`src/app.test.ts` asserts both absences as negative tests.

⚠️ **This is the app that gets open-sourced**, which is the argument that
reopened the split after it had been rejected three times. It is why the shared
runtime is `packages/app-shell` rather than an import from `apps/guide`: an
import that way would drag the adoption guide into the published distribution.

## Chrome

`Shell` picks between two, on one question — is someone else drawing the frame?

- **`PanelShell`** — embedded as a SMART activity; the host owns the surrounding
  UI, so ours collapses to a patient identity strip.
- **`LaunchShell`** — this app in its own tab.

⚠️ It used to pick between **three**, reading chrome mode AND the build surface,
because the adoption guide shipped from the same route table. That third branch
(`AppShell`) left with the guide.

## Data comes from the server

`PatientProvider` builds a `SmartDataSource` whenever a SMART session exists, and
`useRegistrySlices` takes the served cohort inside one. ⚠️ **No fixtures are
compiled in** — `check:surface` asserts the 14 demo patients are in neither
bundle. Outside a SMART session the local store is unseeded, the same as the
guide's.

## Traps

⚠️ **`tsconfig.json` must set `jsx: "react-jsx"`** — esbuild walks up from the
FILE and never reaches `web/`. Same note as every package here.

⚠️ **`check:surface-links` exists because a component shipping in both apps can
still LINK into the other one.** The catch-all returns the clinician to the
chart, silently, so a stranded link does not 404 — it just quietly goes nowhere
useful. `PatientPathway` did exactly that twice; both links pointed at
`/guide/cds-service` and are now deleted rather than moved.
