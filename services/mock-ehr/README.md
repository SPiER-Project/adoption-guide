# `@spier/mock-ehr` — a mock EHR FHIR server

Serves SPiER's own synthetic population as a real FHIR read API, on its **own
Worker and therefore its own origin**, so the embedded SMART panel can be
launched cross-origin against a server rather than against localStorage.

Panel **step 1**. The spec is [`docs/plans/mock-ehr-read-api.md`](../../docs/plans/mock-ehr-read-api.md);
the decision that permits a mock we control at all is
[`embedded-panel-smart-launch.md`](../../docs/plans/embedded-panel-smart-launch.md) §8,
and it is permitted only with the guardrails in §1 of that plan.

> ⚠️ **Nothing observed here is evidence of interoperability.** This server is
> controlled by the project it is demonstrating. The portability claim is made
> separately, by loading the same Bundles into a public sandbox we do not
> control. That is a condition of the decision, not a caveat.

## What it serves

| | |
|---|---|
| FHIR base | `/fhir` |
| Read | `GET /fhir/{Type}/{id}` |
| Search | `GET /fhir/{Type}?patient={id}[&category={token}]` → searchset `Bundle` |
| Capability | `GET /fhir/metadata` |
| Control page | `GET /` — switches the capability profile |
| Profile API | `GET`/`PUT /_admin/capabilities` |

Data is the app's own files, with **no second copy of anything**: the scenarios
from `web/src/data/population/scenarios/patient-0NN.json` and the 14 Patients
from the FSH-generated `web/src/data/fhir/Patient-patient-0NN.json`. Both are
inlined by the Vite build, because a Worker has no filesystem — the same
arrangement `services/cds-hooks` uses, and the reason `main` in `wrangler.jsonc`
points at `dist/index.js` rather than at source.

**`npm run copy-fhir` in `web/` is a prerequisite.** Without it there are no
Patient resources; the loader throws rather than serving an empty server that
looks like a working one.

## What it refuses to do, and why

Each of these is a case where a lenient mock returns something plausible and
wrong, which is the exact failure `mock-patient-smart-launch.md` §6 predicted.

- **An unknown search parameter is a 400**, not an ignored one. Ignoring
  `_count` answers a question nobody asked and the caller cannot tell.
- **A type it does not implement is a 404**, not an empty Bundle. An empty
  Bundle is indistinguishable from a patient who has none.
- **`category` genuinely filters.** `category=survey` and `category=procedure`
  are two different searches feeding two different parts of the chart; a mock
  that ignores the parameter puts one in the other's bucket, and the chart looks
  subtly wrong rather than broken.
- **No `link.next` is ever emitted.** `SmartDataSource` searches with
  `pageLimit: 0`, which means "follow every `next`" — a link this server cannot
  serve would loop the client rather than fail it.

## The capability switch

`/fhir/metadata` is the smallest endpoint here and the most load-bearing: the
writeback ladder reads it and attempts only the tiers it advertises `create`
for. Four profiles, switchable from the control page at runtime:

| Profile | Creates | What the ladder does |
|---|---|---|
| `full` | QR, Observation, Condition, DocumentReference | every tier lands |
| `no-observation` | QR, DocumentReference | Tier 2 `unsupported`; the floor carries it |
| `documents-only` | DocumentReference | Tiers 1–3 `unsupported` |
| `read-only` | — | nothing is attempted |

Flip it, relaunch the panel, submit the same instrument, and the scorecard
changes. ⚠️ The active profile lives in **module memory**: per-isolate, gone on a
cold start. Flip immediately before launching. Durable state (KV / a Durable
Object) is a later step; the seam that would have been costly to retrofit is
`src/capability.ts`, not its storage.

## Not here

**Auth** — no `/authorize`, `/token` or PKCE; step 1 is an open read API, which
is why it could be built and tested before step 2. **Writes** — step 4, and its
strict-validation guardrail is a *port* of `check-scenario-resources.mjs`, not a
reuse of it (that script is Node reading StructureDefinitions off a filesystem).
**Host chrome** — a patient list, a patient page, a launch button: step 5.

## Verify

```
npm install && npm run verify   # copy-fhir + typecheck + eslint + vitest
```

`web/`'s `npm run verify` does **not** cover this package. CI runs the same
`verify` as its own `mock-ehr` job in `.github/workflows/web-lint.yml`, which
triggers on `services/**` — this service reads the scenario fixtures that
`web/scripts/shift-scenario-dates.mjs` periodically re-anchors, and that break
would otherwise be silent and show up as an empty chart mid-demo.

`src/smartDataSource.integration.test.ts` is the one to keep working: it stands
the app up on a loopback HTTP server and drives the **real** `SmartDataSource`
through a **real** fhirclient against it. The read API was specified by reading
that class, so every other test can only confirm the same reading — this one is
what caught the missing `QuestionnaireResponse.subject` (see `NORMALIZED_LINKS`
in `src/fixtures.ts`). It also asserts the failure direction: a 500 on a
load-bearing search must reject, and a 500 on a best-effort one must degrade.

`fhirclient` is deliberately **not** a dependency here — it is aliased to
`web/node_modules` in `vitest.config.ts` and `tsconfig.json`. A second copy
could drift from the version the app ships, and the test would then exercise a
client the panel never uses.

`wrangler` is pinned to `~4.107.0` to match `services/cds-hooks`; 4.124+ peer-
depends on `@cloudflare/workers-types` v5, which conflicts with the v4 types
both services use.
