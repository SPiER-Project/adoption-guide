# Research — Medplum as the mock EHR

**Status:** research note, 2026-09-17. Answers Brad's question on plan 4: *"are
you able to research the UI of Medplum as something we could use as our mock
EHR?"*

> **The spike proposed below has been run.** Its results — including the answers
> to the four questions in *"What to check in a spike, in order"* and four
> defects it found in SPiER — are in
> [`medplum-spike-2026-09-17.md`](medplum-spike-2026-09-17.md). Read that first;
> this note is what was believed beforehand.

⚠️ `medplum.com` is blocked by this environment's egress proxy, so the findings
below come from the GitHub repos, npm and search summaries. Confirm the API
details against the live docs before acting on any of it.

## What Medplum is

An open-source, FHIR-native healthcare developer platform: a FHIR server, an
OAuth 2.0 / SMART authorization server, a CLI, an on-prem agent and a React
component library. Apache 2.0 across the whole monorepo, with no separate
proprietary edition. Self-hostable on AWS, Azure or GCP; AWS CDK templates ship
with it.

It is **not a finished EHR with a default clinical UI.** You build the interface
on top of its data layer. Two things carry the UI:

- **`@medplum/react`** — themeable clinical components: `ResourceTable`,
  `SearchControl`, `QuestionnaireForm`, `PatientTimeline`, `ResourceAvatar`,
  resource forms. React 18+, built on Mantine 7+. Browsable at
  `storybook.medplum.com`.
- **`medplum-provider`** — a separate Apache 2.0 starter app that assembles those
  components into something EHR-shaped: visit documentation, task assignment,
  appointment scheduling, patient registration, lab orders, medication ordering,
  claims and messaging. React + Vite.

## Two different proposals, and they are not equally good

### Proposal A — rebuild our mock EHR's UI on `@medplum/react`

**Recommendation: no.**

The cost is structural, not cosmetic. `services/mock-ehr/` is a Cloudflare Worker
that renders server-side HTML strings: no bundler, no stylesheet, no build step,
about 1,900 lines across `app.ts`, `chartPage.ts` and `hostChrome.ts`. Its design
system is a `TOKENS` block of custom properties and one gate, `check:host-css`,
that fails on any hex literal outside that block. Adopting `@medplum/react` means
adding React, Mantine and a Vite build to the host, and `check:host-css` stops
meaning anything.

The benefit is small, because the thing it would buy is a look — and the host's
look is already a deliberate decision. `hostChrome.ts` documents it at length:
the host is slate and steel precisely so that SPiER's plum and raspberry read as
the guest. That boundary is what the chart page is *about*. Mantine's defaults
would not improve it.

And it would not touch the claim that actually limits the demo. From the front
door's own disclaimer:

> **This host is written and run by the same project as the app it launches**, so
> a handshake succeeding here says the app behaves correctly as a guest — not
> that it works against a server nobody here controls.

Borrowing a third party's components does not make the host a third party.

### Proposal B — run actual Medplum as a second host

**Recommendation: worth a spike, and it is the version with real value.**

Medplum's authorization server implements SMART App Launch. The
`$smart-launch` operation on a `ClientApplication` creates a `SmartAppLaunch`
context and 302s to the app's `launchUri` with `iss` and `launch` — the same two
parameters our `POST /_admin/launch` mints. It supports both launch shapes SPiER
uses: patient-context EHR launch from Medplum's Apps tab, and a practitioner
launch with `user/*.read` for a worklist with no patient in context.

That is the shape of a genuine interoperability test. Registering SPiER as a
`ClientApplication` against a self-hosted Medplum and launching it from the
provider app would exercise the app against an authorization server, a FHIR
server and a host UI that this project did not write. If it works, the standing
caveat above gets narrower for the first time.

**What to check in a spike, in order:**

1. Does Medplum's FHIR server hold the resource types SPiER reads and writes —
   `QuestionnaireResponse`, `CarePlan`, `Observation`, `Communication`, `Task`?
2. Does its `/metadata` advertise what SPiER's writeback ladder probes? The
   ladder degrades on capability; a real server is the first honest test of that
   logic, and the capability-profile switch on `/settings` is currently the only
   thing that exercises it.
3. Will it frame SPiER cross-origin? `PANEL_FRAME_ANCESTORS` would need the
   Medplum origin added alongside the mock EHR's.
4. Does its CDS Hooks story, if any, reach our hosted service — or is the panel
   launch the whole integration?

**What it does not replace.** Keep the mock EHR. It does things a real server
will not do on command: flip its capability profile mid-demo, refuse a write to
prove the ladder degrades, and run a FHIRcast hub. Medplum would be a second
host answering a different question — *does this work somewhere we do not
control* — not a replacement for the one that answers *what happens when the
server says no*.

## Sources

- [Medplum monorepo](https://github.com/medplum/medplum) — Apache 2.0, packages
- [medplum-provider](https://github.com/medplum/medplum-provider) — the EHR-shaped starter app
- [@medplum/react on npm](https://www.npmjs.com/package/@medplum/react)
- [medplum-smart-on-fhir-demo](https://github.com/medplum/medplum-smart-on-fhir-demo)
- [SMART App Launch issue #4963](https://github.com/medplum/medplum/issues/4963) — EHR launch flow notes
- Medplum docs (blocked from this environment, confirm before acting):
  `medplum.com/docs/react`, `medplum.com/docs/integration/smart-app-launch`,
  `medplum.com/docs/api/fhir/operations/clientapplication-smart-launch`,
  `medplum.com/docs/access/smart-scopes`
