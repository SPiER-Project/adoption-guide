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
   (collapsed) and in Patient Documents.
2. **Write:** submit a PHQ-9 from the sidebar. The app POSTs the
   QuestionnaireResponse first, then each derived Observation with
   `derivedFrom` pointing at the server-assigned QR id and `subject` set to
   the launch patient.
3. **Round-trip:** the chart refreshes from the server after the save — the
   response, its Observations (staged under *Flag Risk* via their pathway
   `meta.tag`), and the recomputed risk alert appear. Confirm server-side:

   ```sh
   curl -s -H "Authorization: Bearer <token>" \
     "https://launch.smarthealthit.org/v/r4/fhir/QuestionnaireResponse?patient=<patient-id>"
   ```

   Or simply re-launch the same patient — the submission is still there.
4. **Errors surface, no silent fallback:** if a write is rejected (scope or
   validation), a red "EHR data error" banner appears on the chart; nothing is
   written to localStorage in SMART mode.

## Known limitations

- **Mapper dispatch is canonical-URL-bound.** The observation mappers dispatch
  on `http://spier.org/Questionnaire/*` canonicals
  (`web/src/lib/observationMappers/index.ts`), so only QRs written by SPiER —
  or by servers reusing SPiER canonicals — produce risk alerts and derived
  Observations. Foreign QRs/Observations still render on the chart; anything
  that resolves to no pathway stage lands in the "Other activity" bucket.
- **Population view stays local-only under SMART.** The registry reads the
  local demo store; only the Patient Chart reads/writes the connected server.
- **Session lifetime.** The SMART session lives in `sessionStorage` and is
  rehydrated on reload, but expires with the sandbox token (~1 h); re-launch
  from the EHR/launcher to reconnect.
