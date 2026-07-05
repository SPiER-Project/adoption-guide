# Plan: FHIRcast two-way sync

## Current state (one-way)

`web/src/lib/fhircast.ts` models a single `patient-open` STU3 event over a
`BroadcastChannel("spier-fhircast")`. API: `publishPatientOpen(payload, ts)` and
`subscribePatientOpen(handler)`. The module is deliberately framework-free and
one-way (see its header comment).

- **Publishers:** only `PopulationView.tsx` (two call sites — row click and the
  patient link `onClick`).
- **Subscriber:** `FhircastListener.tsx`, mounted app-root in `App.tsx:87`,
  always listening. On event it navigates a chart tab to the broadcast patient,
  guarded by: ignore if SMART-connected, only follow on a `/patient/chart` route,
  skip if already on that patient, then show a dismissible banner.
- **Patient context:** `PatientContext.tsx` — `activePatientId` is **URL-driven**
  (`deriveActiveIdFromPath()`), persisted to localStorage `spier-active-patient-id`.
  There is **no** effect that publishes when the active patient changes.

So: Population → Chart works; Chart → anything does not. Navigating directly to a
chart (URL bar, link from an assessment, another chart tab) broadcasts nothing.

## Goal

Make patient context changes originating **in the chart/patient view** also
broadcast, so any other listening tab follows — true two-way sync — without
creating echo loops or fighting a live SMART session.

## Core challenge: echo suppression

If the chart publishes whenever `activePatientId` changes, and the listener
navigates (which changes the URL → changes `activePatientId`), we get an infinite
rebroadcast loop across tabs. We must distinguish **user-initiated** context
changes from **FHIRcast-followed** ones.

## Design

### 1. Add publish-on-change from PatientContext

New effect in `PatientProvider` that fires when `activePatientId` transitions to a
real patient — but is **suppressed** when the change was caused by an incoming
FHIRcast event.

Mechanism — a "programmatic navigation" marker:
- `FhircastListener` sets a short-lived flag (module-level ref or a field in
  fhircast.ts, e.g. `markFollowing(patientId)`) immediately before
  `navigate(...)`.
- The PatientContext publish-effect checks: if the new `activePatientId` equals
  the just-followed id (within a small window), skip publishing and clear the flag.
- Otherwise publish `publishPatientOpen({ patientId, mrn, displayName }, ts)`.

This keeps the loop-break logic in the app layer, consistent with the existing
design decision that guardrails live in React, not in `fhircast.ts`.

Payload source: derive `mrn`/`displayName` from the resolved population patient
in PatientContext (it already converts `RegistryPatient` → FHIR Patient).

### 2. Remove now-redundant Population publishes (optional cleanup)

Once PatientContext publishes on every real activation, `PopulationView`'s two
explicit `publishPatientOpen` calls become redundant (navigation there will flow
through PatientContext). Decide:
- **Keep** them for immediacy (publish fires before the destination mounts), OR
- **Centralize** all publishing in PatientContext and delete the PopulationView
  calls. Centralizing is cleaner and removes the double-broadcast concern already
  hinted at in PopulationView (the `stopPropagation` dance). Recommend
  centralizing, but verify the timing (a listener in another tab doesn't need the
  publisher's own navigation to have completed).

### 3. Keep the SMART guardrail

The existing rule — ignore broadcasts while SMART-connected — must also apply to
**publishing**: a chart under a live SMART session should not broadcast, because
the EHR owns context there. Add the `isSmartConnected` check to the publish
effect (mirror the listener's guard).

### 4. (Stretch) model a second event

True FHIRcast two-way often implies more than `patient-open`. Optional follow-on:
add `patient-close` or a generic `context-change` so closing/clearing a patient
also propagates. Keep out of scope for v1 unless requested — the header comment in
`fhircast.ts` should be updated to reflect it's no longer "one-way".

## Files touched

- `web/src/lib/fhircast.ts` — update the "deliberately one-way" doc comment; add a
  tiny `markFollowing`/`consumeFollowing` helper (or expose an event id the app
  can correlate) if we implement echo suppression there rather than in a React ref.
- `web/src/context/PatientContext.tsx` — publish-on-activation effect with
  echo-suppression + SMART guard.
- `web/src/components/FhircastListener.tsx` — mark programmatic follows so the
  publish effect can suppress them.
- `web/src/components/PopulationView.tsx` — remove/keep explicit publishes
  (decision above).

## Tests / verification

- Unit: publish effect fires on user activation; does **not** fire on a followed
  activation; does **not** fire under SMART.
- Manual (preview, two tabs): open patient A in tab 1 chart → tab 2 follows;
  then in tab 2 navigate to patient B → tab 1 follows; confirm **no** ping-pong
  (each switch settles, no repeated banners).
- Confirm the same-patient skip still prevents redundant banners.
- SMART tab neither publishes nor follows.

## Risks

- **Echo loops** are the primary risk — the marker/window approach must be robust
  to timing (BroadcastChannel doesn't echo to the sender, which helps within a
  tab, but the URL→context→publish chain is intra-tab). Prefer a ref-based
  "last followed id + timestamp" guard over fragile timers.
- **Direct-URL loads** (cold open of a chart) will now broadcast — desired, but
  verify it doesn't surprise a lone tab (harmless: no other listener).
- Timing between PopulationView's own navigation and centralized publishing — test
  before deleting the existing publishes.
