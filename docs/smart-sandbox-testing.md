# Testing SPiER against the SMART Health IT sandbox

How to exercise the app's SMART on FHIR live read/write path (`SmartDataSource`)
against the public [SMART App Launcher](https://launch.smarthealthit.org)
sandbox. No client registration or backend is required — the app is a public
client using PKCE (fhirclient's default).

## How the launch flow works with the hash router

The app is served from a static host (GitHub Pages) under the Vite base path
`/adoption-guide/`, with `HashRouter` routes. Two constraints follow:

1. **OAuth redirect URIs cannot carry hash fragments** (RFC 6749 §3.1.2), and
   GitHub Pages serves no path other than the app base — so the registered
   redirect URI is the app base itself (e.g.
   `https://<host>/adoption-guide/`).
2. fhirclient reads `iss`/`launch` (launch leg) and `code`/`state` (redirect
   leg) from the **real query string**, not the hash.

`web/src/main.tsx` therefore bootstraps both legs: when the app loads at its
base URL with `?iss=…&launch=…` it routes to `#/launch`, and with
`?code=…&state=…` it routes to `#/redirect`, keeping the query string intact
for fhirclient.

**Launcher config implication:** the app's *launch URL* is the plain app base —
**not** `…/#/launch`. If the launch URL contains a `#`, the launcher appends
`?launch=…&iss=…` after the fragment and fhirclient never sees the params.

## Exact launcher configuration

At <https://launch.smarthealthit.org>:

| Field | Value |
| --- | --- |
| Launch Type | Provider EHR Launch |
| FHIR Version | R4 |
| Simulate launch within the EHR UI | off (open in new tab) |
| Patient(s) | pick any (e.g. *Kendall Keeling*) |
| Provider(s) | pick any |
| **App's Launch URL** | `http://localhost:5173/adoption-guide/` (local dev) or `https://spier-project.github.io/adoption-guide/` (deployed) |

Client Identity Validation can stay off (the app sends `client_id:
spier-client`, which the open sandbox accepts). Press **Launch** — the app
authorizes, exchanges the code, and lands on the Patient Chart reading the
launch patient's live data.

For local dev, start the server first (`npm run dev` in `web/`).

### URL-driven launch (no launcher UI — useful for scripted testing)

The launcher encodes its sim settings in the `launch` token: a base64url JSON
array `[launch_type_index, patient, provider, encounter, skip_login,
skip_auth, sim_ehr, …]`. With `skip_login`/`skip_auth` set, the authorize
endpoint redirects straight back — the whole flow runs with zero clicks:

```sh
TOKEN=$(node -e "console.log(Buffer.from(JSON.stringify(
  [0, '<patient-id>', '', 'AUTO', 1, 1, 0, '', '', '', '', '', '', '', 0, 0]
)).toString('base64url'))")
open "http://localhost:5173/adoption-guide/?iss=https%3A%2F%2Flaunch.smarthealthit.org%2Fv%2Fr4%2Ffhir&launch=$TOKEN"
```

Patient ids can be listed from the open endpoint:
`https://r4.smarthealthit.org/Patient?_count=5&_elements=id,name`.

## What to verify

1. **Read:** after launch, the chart shows the launch patient's banner (name,
   DOB, SMART badge) and loads their server data. A fresh sandbox patient has
   no SPiER data — foreign survey Observations appear under **Other activity**
   (collapsed) and in Patient Documents. A foreign **PHQ-9** is the exception —
   it derives via the code-based fallback and does produce a risk alert (see
   *Known limitations*).
2. **Write:** submit a PHQ-9 from the sidebar. Since #351 the write climbs the
   **writeback ladder** (`web/src/lib/writeback/`, driven by
   `SmartDataSource.saveResponse`): the server's CapabilityStatement is probed,
   the QuestionnaireResponse is POSTed first, then each derived Observation with
   `derivedFrom` pointing at the server-assigned QR id and `subject` set to the
   launch patient. A `DocumentReference` may also be written — see step 4. Every
   tier's outcome is rendered by the **writeback scorecard** on the chart. See
   [`plans/smart-filler-writeback-ladder.md`](plans/smart-filler-writeback-ladder.md).
3. **Round-trip:** the chart refreshes from the server after the save — the
   response, its Observations (staged under *Flag Risk* via their pathway
   `meta.tag`), and the recomputed risk alert appear. Confirm server-side:

   ```sh
   curl -s -H "Authorization: Bearer <token>" \
     "https://launch.smarthealthit.org/v/r4/fhir/QuestionnaireResponse?patient=<patient-id>"
   ```

   Or simply re-launch the same patient — the submission is still there.
4. **Errors surface, no silent fallback — but read this carefully, it changed
   in #351.** Nothing is ever written to localStorage in SMART mode; that half
   still holds. What changed is *where* a rejection shows up.

   A **partial** rejection no longer produces the red banner. If the server
   refuses `Observation.create`, the ladder records that tier as `failed`, fires
   the Tier-0 `DocumentReference` floor so the data is still recoverable, and
   `saveResponse` **resolves successfully**. The failure is reported in the
   writeback scorecard, per tier, with the HTTP status — not as a save error.
   That is the ladder's designed degradation, not a swallowed error.

   The red **EHR data error** banner now means a **total** failure: not one
   resource was created, not even the floor. `saveResponse` throws only in that
   case.

   ⚠️ So verifying "errors surface" means checking **both** paths: refuse one
   resource type and confirm the scorecard names it while the floor lands; refuse
   *everything* and confirm the banner appears. Checking only the banner would
   now pass while a whole tier failed silently.

## Known limitations

- **Mapper dispatch is canonical-URL-first, with a narrow code-based fallback.**
  Dispatch prefers `http://thespierproject.org/fhir/Questionnaire/*` canonicals
  (`web/src/lib/observationMappers/index.ts`). A foreign QR whose canonical does
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
  patient, so the cohort is that patient and the page says so. A real registry
  needs a user-scoped launch and a cohort read (#401), not a refactor.
- **Session lifetime.** The SMART session lives in `sessionStorage` and is
  rehydrated on reload, but expires with the sandbox token (~1 h); re-launch
  from the EHR/launcher to reconnect.
