# Testing SPiER against the SMART Health IT sandbox

How to exercise the clinical app's SMART on FHIR live read/write path
(`SmartDataSource`) against the public [SMART App Launcher](https://launch.smarthealthit.org)
sandbox — a FHIR server SPiER did not write (Smile CDR). No client registration
or backend is required: the app is a public client using PKCE (fhirclient's
default), and the sandbox accepts any `client_id`.

⚠️ **The sandbox is public and shared.** Every resource you save is visible to
anyone using it and cannot be deleted. Use its synthetic patients only, and type
nothing that looks like real data.

## How the launch reaches the app

The SMART apps are the **clinical** build (`apps/clinical`), served by
`services/clinical` at the `clinical` origin in `deploy-origins.json`, and
locally by `npm run dev:clinical` (port 5174). The guide carries no SMART
plumbing. The app is served at its base path with `HashRouter` routes, so two
constraints follow:

1. **OAuth redirect URIs cannot carry hash fragments** (RFC 6749 §3.1.2), so the
   redirect URI is the app base itself (`http://localhost:5174/` locally).
2. fhirclient reads `iss`/`launch` (launch leg) and `code`/`state` (redirect
   leg) from the **real query string**, not the hash.

`packages/app-shell/src/bootstrap.tsx` therefore bootstraps both legs: loaded at
its base URL with `?iss=…&launch=…` it routes to `#/launch`, and with
`?code=…&state=…` to `#/redirect`, keeping the query string intact.

## Launching

### From the launcher UI

At <https://launch.smarthealthit.org>: Launch Type **Provider EHR Launch**, FHIR
Version **R4**, *Simulate launch within the EHR UI* off, pick a patient and a
provider, and set **App's Launch URL** to the plain app base —
`http://localhost:5174/` locally, or the clinical origin. **Not** `…/#/launch`:
with a `#` in the launch URL the launcher appends `?launch=…&iss=…` after the
fragment and fhirclient never sees them.

### URL-driven (no clicks — what the 2026-10-09 run used)

The launcher encodes its settings in the `launch` token, a base64url JSON array:
`[launch_type_index, patient, provider, encounter, skip_login, skip_auth,
sim_ehr, scope, redirect_uris, client_id, client_secret, auth_error, jwks_url,
jwks, client_type_index, pkce_index, fhir_server]`.

⚠️ **`skip_login` needs a provider id.** With the provider empty — which is what
this page's previous example did — the launcher stops at a practitioner login
page, whatever `skip_login` says. Give it a `Practitioner` id from the sandbox:

```sh
B=https://launch.smarthealthit.org/v/r4/fhir
curl -s "$B/Patient?_count=5&_elements=id,name"
curl -s "$B/Practitioner?_count=2&_elements=id"
```

```sh
TOKEN=$(node -e "console.log(Buffer.from(JSON.stringify([0,'<patient-id>','<practitioner-id>','AUTO',1,1,0,'','','','','','','',0,0,''])).toString('base64url'))")
```

```sh
open "http://localhost:5174/?iss=https%3A%2F%2Flaunch.smarthealthit.org%2Fv%2Fr4%2Ffhir&launch=$TOKEN"
```

## What to verify

1. **Read.** The chart shows the launch patient's banner with the SMART badge,
   and the pathway reads from what is on file. A fresh sandbox patient has no
   SPiER data, so Step 1 is due; their own records (smoking status, medication
   documentation) appear under *What's on file*.
2. **Write.** Submit an instrument, then press **Save to the chart**. The save
   climbs the writeback ladder (`packages/core/src/lib/writeback/`, driven by
   `SmartDataSource.saveResponse`; see
   [`plans/smart-filler-writeback-ladder.md`](plans/smart-filler-writeback-ladder.md)):
   capability probe, the QuestionnaireResponse first, then each derived
   Observation with `derivedFrom` pointing at the **server-assigned** response
   id, then the readable copy only if something above it did not land.
3. **Round-trip.** Back on the chart, the save is there **immediately** — the
   pathway advances and the banner shows the new risk. Confirm server-side,
   remembering that this server's search lags (see the results below):

   ```sh
   curl -s "https://launch.smarthealthit.org/v/r4/fhir/QuestionnaireResponse?patient=<patient-id>"
   ```

4. **Errors surface.** A **partial** rejection is reported by the scorecard, per
   part, while the readable copy carries the data and `saveResponse` resolves; the
   red **EHR data error** banner means a **total** failure (nothing created, not
   even the floor). Verify both paths. The public sandbox accepts every write, so
   a refusal can only be exercised against the mock EHR's capability profiles.

## Results: SMART Health IT R4 sandbox, 2026-10-09 (#640)

One synthetic patient (Wendy Littel); a PHQ-9 (positive item 9), a Stanley-Brown
safety plan and an ASQ (non-acute positive), each submitted and saved.

**Held** — what the mock EHR had shown, now seen on a server SPiER did not write:

- The launch, the token's scopes and the patient-scoped reads.
- The CapabilityStatement parsed, and advertised `create` for every rung.
- **Server-assigned ids** (numeric here, not UUIDs) were remapped correctly: every
  stored Observation's `derivedFrom` names the response's server id.
- Profiles and pathway-stage tags on the Observations, CarePlan, Encounter and
  EpisodeOfCare were stored as sent. The server does not validate profiles, so
  this proves storage, not conformance.
- The readable copy was correctly *not* written: every part above it landed.

**Found and fixed in this change:**

| What happened | Why the mock could not show it | Fix |
|---|---|---|
| The chart showed the chart as it was **before** a save — "No suicide-risk screen on file" over a screen just saved — for about a minute. | Smile CDR makes a write searchable only after the request returns; a read by id found it at once. The mock indexes synchronously. | `SmartDataSource` remembers what it wrote this session and adds anything the search has not returned yet (`mergeWritten`). Re-verified live: the ASQ appeared on the chart seconds after its save. |
| Every saved QuestionnaireResponse was stored with `status: in-progress`. | Nothing in the mock or the tests read the stored status; fixtures were built `completed`. | The form view marks a submitted response `completed`; the renderer hands back `in-progress` even from its submit. Re-verified: the ASQ was stored `completed`. |
| The scorecard read "2 of 3 parts saved" for a complete save. | The same on the mock — but nobody had looked at a complete save's headline. | It counts only the parts the save needed; a readable copy skipped as not needed is not an unsaved part. |
| This page's launch example stopped at a practitioner login. | — | The launch token above now carries a practitioner id. |

**Seen, not fixed here:**

- **Three `404`s in the console during the safety-plan save**, with every resource
  present on the server afterwards and no part reported failed. The save path
  makes no read by id, and the browser does not expose a cross-origin status, so
  the requests were not identified.
- **A response launched from the chart's own card carries no stage tag** (only a
  `?tool=` launch stamps one). Stage resolution falls back to the Questionnaire's
  canonical, which is unambiguous for these instruments — not a defect, but a
  reader of the raw server data sees untagged responses.
- **The problem-list card shows "LOINC 93374-7" on the clinician's screen.** The
  string is built in core from the published PlanDefinition, which the jargon
  check does not read; it is not specific to this server.
- **The ASQ's "screening result category" is asked of the clinician**, not
  calculated from the answers.

## Known limitations

- **Mapper dispatch is canonical-URL-first, with a narrow code-based fallback.**
  Dispatch prefers `http://thespierproject.org/fhir/Questionnaire/*` canonicals
  (`packages/core/src/lib/observationMappers/index.ts`). A foreign QR whose canonical does
  not match **still derives when its instrument is recognized from standardized
  LOINC item codes** (#230, `observationMappers/fallbackDispatch.ts`) — but that
  fallback covers **PHQ-9 only** today, and results are stamped as inferred. The
  shape heuristic (tier 3) is deliberately **not** enabled here.

  Anything else — a foreign C-SSRS or ASQ — produces no risk alert and no derived
  Observations, and lands in the collapsed "Other activity" bucket when it
  resolves to no pathway stage. Extending this past PHQ-9 is #230.

  ⚠️ This bullet said dispatch was canonical-**bound** with no fallback at all,
  which predated #230 and disagreed with both `smartDataSource.ts`'s own header
  comment and [`plans/mock-patient-smart-launch.md`](plans/mock-patient-smart-launch.md) §2.
- **Population view narrows to the patient in context under SMART.** ⚠️ This
  bullet said the view "stays local-only" and read the local demo store, which
  **step C (#390) closed**: it and the summary widget both read through
  `useRegistrySlices`, i.e. through whatever `FhirDataSource` is active. What a
  SMART session cannot give them is a *caseload* — the token is bound to one
  patient, so the cohort is that patient and the page says so. ⚠️ **The last
  sentence here said a real registry "needs a user-scoped launch and a cohort
  read (#401)" — it has both now** (#489, #491, closed by #494). This bullet is
  still true of a *patient-scoped* launch, which is what a chart launch is; the
  caseload is a separate, user-scoped grant issued by the host.
- **Session lifetime.** The SMART session lives in `sessionStorage` and is
  rehydrated on reload, but expires with the sandbox token (~1 h); re-launch
  from the EHR/launcher to reconnect.
