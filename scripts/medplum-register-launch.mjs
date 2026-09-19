#!/usr/bin/env node
/**
 * Put SPiER on Medplum's **Apps tab** by giving its `ClientApplication` a
 * `launchUri`.
 *
 * Step 2 of the Medplum evaluation. `medplum-upload.mjs` put the IG's profiles
 * on the server and `medplum-load-population.mjs` put the demo patients in
 * front of them; the spike then launched SPiER by minting a launch context by
 * hand. This is the difference between *the handshake works* and *a clinician
 * can start it from a chart*: Medplum renders an Apps tab on every Patient and
 * Encounter page, listing exactly those ClientApplications that carry a
 * `launchUri`. Clicking one calls `$smart-launch`, which 302s to that URI with
 * `iss` and `launch` — the same two parameters `services/mock-ehr`'s
 * `POST /_admin/launch` mints.
 *
 *   node scripts/medplum-register-launch.mjs            # report, change NOTHING
 *   node scripts/medplum-register-launch.mjs --apply    # write the registration
 *   node scripts/medplum-register-launch.mjs --app http://localhost:5173/ --apply
 *
 * Not a gate and not in any `verify` — it needs credentials and a network, the
 * same split as the other two Medplum scripts. `--apply` is the verb because
 * the default talks to a live project.
 *
 * ─── ⚠️ The launch URI must carry NO fragment ────────────────────────────────
 *
 * SPiER is a `HashRouter` app and its launch screen is `#/launch`, so the
 * obvious registration is `https://…/#/launch`. That is broken, and it fails in
 * the way that is hardest to read: Medplum APPENDS `?iss=…&launch=…` to the URI
 * it redirects to, so a fragment already in place puts the query string after
 * the `#`. `window.location.search` is then empty, fhirclient finds no `iss`,
 * and the app renders its launch screen with nothing to do — a blank-looking
 * failure at the end of a redirect chain that every visible step of has worked.
 *
 * The bare app base is what to register. `web/src/main.tsx` bootstraps it: a
 * load at the default route carrying `iss` and `launch` sets `#/launch` itself,
 * before the router mounts. That is the same reason `redirectUris` is the bare
 * base too — an OAuth redirect URI cannot carry a fragment at all.
 *
 * ─── ⚠️ `launchIdentifierSystems` stays UNSET, and this script protects that ──
 *
 * It looks like exactly what SPiER wants — it would make the token's patient
 * context carry our own `patient-011` instead of Medplum's UUID — and it is
 * backwards. `SmartDataSource.resolvePatientId` feeds `client.patient.id`
 * straight into `?patient=<id>` and Medplum resolves UUIDs only, so every chart
 * search would return nothing behind a launch that looked correct at every
 * visible step. The identifier's job is FINDING the patient to launch, not
 * addressing them. This script refuses to run if something has set it.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEMO_ID_SYSTEM = 'http://thespierproject.org/fhir/identifier/demo-id'
/** The patient the demo script opens on — see docs/demo-script.md. */
const SAMPLE_PATIENT = 'patient-011'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

/** The one file that says which client_id SPiER presents to which EHR. */
const REGISTRATIONS = 'packages/app-shell/src/config/smart-registrations.json'

/**
 * The `client_id` SPiER presents to Medplum, READ OUT OF THE APP'S OWN CONFIG.
 *
 * ⚠️ **Read rather than restated, and that is the point of the file it comes
 * from.** A registration and the app's idea of it can disagree; a second copy of
 * the UUID here would be that defect one level out — this script would
 * cheerfully configure a ClientApplication the app never presents, and the
 * launch would fail at `/authorize` with the registration looking perfect in
 * Medplum's UI.
 *
 * ⚠️ It used to regex the TypeScript source. The registrations became JSON on
 * 2026-09-18 (so an adopter replaces a config file rather than editing app
 * source), and a regex over a moved file would have found nothing and failed
 * loudly — which is the safe direction, but parsing the real thing is better
 * than pattern-matching its old spelling.
 */
function clientIdFromApp(issuerOrigin) {
  const path = join(REPO, REGISTRATIONS)
  let config
  try {
    config = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    fail(`could not read ${REGISTRATIONS}: ${err.message}`)
  }
  const byOrigin = config.byIssuerOrigin
  if (!byOrigin || typeof byOrigin !== 'object') {
    fail(
      `${REGISTRATIONS} has no \`byIssuerOrigin\` map — this script reads it rather than\n`
        + '  restating a UUID, so a shape change here must stop the script rather than\n'
        + '  let it configure something the app does not present.',
    )
  }
  const clientId = byOrigin[issuerOrigin]
  if (!clientId) {
    fail(
      `no client_id for ${issuerOrigin} in ${REGISTRATIONS}.\n`
        + '  Add the registration there FIRST — that map is what the app presents at\n'
        + '  /authorize, and a ClientApplication the app does not know about cannot launch.',
    )
  }
  return clientId
}

function env(name) {
  const v = process.env[name]
  if (v === undefined) {
    fail(
      `${name} is not set.\n`
        + '  Set MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET (a ClientApplication with\n'
        + '  client_credentials), or MEDPLUM_TOKEN for an access token you already hold.\n'
        + '  MEDPLUM_BASE_URL defaults to https://api.medplum.com/.',
    )
  }
  return v
}

async function getToken(baseUrl) {
  if (process.env.MEDPLUM_TOKEN) return process.env.MEDPLUM_TOKEN
  const res = await fetch(new URL('oauth2/token', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env('MEDPLUM_CLIENT_ID'),
      client_secret: env('MEDPLUM_CLIENT_SECRET'),
    }),
  })
  if (!res.ok) fail(`token request failed: ${res.status} ${await res.text()}`)
  const body = await res.json()
  if (!body.access_token) fail('token response carried no access_token')
  return body.access_token
}

async function fhir(baseUrl, token, path, init = {}) {
  const res = await fetch(new URL(`fhir/R4/${path}`, baseUrl), {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/fhir+json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { /* non-JSON error page */ }
  return { ok: res.ok, status: res.status, body, text }
}

async function main() {
  const baseUrl = process.env.MEDPLUM_BASE_URL ?? 'https://api.medplum.com/'
  const issuerOrigin = new URL(baseUrl).origin
  const appBase = flag('--app') ?? 'https://spier-adoption-guide.bbthorson.workers.dev/'

  const parsedApp = (() => {
    try { return new URL(appBase) } catch { return null }
  })()
  if (!parsedApp) fail(`--app is not a URL: ${appBase}`)
  if (parsedApp.hash) {
    fail(
      `--app carries a fragment (${parsedApp.hash}). Register the BARE app base.\n`
        + '  Medplum appends ?iss=…&launch=… to the launch URI, so a fragment already in\n'
        + '  place puts the query string after the #, location.search comes back empty,\n'
        + '  and the app has nothing to launch with. main.tsx routes to #/launch itself.',
    )
  }

  const clientId = clientIdFromApp(issuerOrigin)
  console.log(`Medplum:     ${baseUrl}`)
  console.log(`Client:      ClientApplication/${clientId}  (from ${REGISTRATIONS})`)
  console.log(`App base:    ${appBase}`)
  console.log(`Mode:        ${APPLY ? 'APPLY — will write' : 'dry run — nothing will be written'}\n`)

  const token = await getToken(baseUrl)
  const read = await fhir(baseUrl, token, `ClientApplication/${clientId}`)
  if (!read.ok) {
    fail(
      `could not read ClientApplication/${clientId}: ${read.status}\n  ${read.text.slice(0, 400)}\n`
        + '  A 404 here usually means the credentials belong to a DIFFERENT project than\n'
        + '  the registration — Medplum scopes resources per project.',
    )
  }
  const app = read.body

  if (Array.isArray(app.launchIdentifierSystems) && app.launchIdentifierSystems.length > 0) {
    fail(
      'this ClientApplication has `launchIdentifierSystems` set. Clear it before launching.\n'
        + '  It makes the token\'s patient context carry SPiER\'s own id instead of the\n'
        + '  server\'s UUID, and every chart search then returns nothing behind a launch\n'
        + '  that looks correct at every visible step. See the header of this file.',
    )
  }

  const current = {
    launchUri: app.launchUri,
    redirectUris: app.redirectUris ?? (app.redirectUri ? [app.redirectUri] : []),
    allowedOrigin: app.allowedOrigin ?? [],
    pkceOptional: app.pkceOptional === true,
  }

  // Additive on purpose: a registration may already carry localhost beside the
  // deploy, and dropping one would break whichever launch is not being set up
  // right now.
  const redirectUris = [...new Set([...current.redirectUris, appBase])]
  const allowedOrigin = [...new Set([...current.allowedOrigin, parsedApp.origin])]

  const changes = []
  if (current.launchUri !== appBase) changes.push(['launchUri', current.launchUri ?? '(unset)', appBase])
  if (redirectUris.length !== current.redirectUris.length) {
    changes.push(['redirectUris', current.redirectUris.join(', ') || '(none)', redirectUris.join(', ')])
  }
  if (allowedOrigin.length !== current.allowedOrigin.length) {
    changes.push(['allowedOrigin', current.allowedOrigin.join(', ') || '(none — all allowed)', allowedOrigin.join(', ')])
  }

  console.log('Current registration:')
  console.log(`  launchUri      ${current.launchUri ?? '(unset — NOT on the Apps tab)'}`)
  console.log(`  redirectUris   ${current.redirectUris.join(', ') || '(none)'}`)
  console.log(`  allowedOrigin  ${current.allowedOrigin.join(', ') || '(none — all origins allowed)'}`)
  console.log(`  pkceOptional   ${current.pkceOptional}  ${current.pkceOptional ? '⚠️ SPiER uses PKCE; leaving this true weakens the demo\'s claim' : ''}`)
  console.log('')

  if (changes.length === 0) {
    console.log('✓ Already registered for the Apps tab — nothing to change.')
  } else {
    console.log(APPLY ? 'Applying:' : 'Would change (re-run with --apply):')
    for (const [field, was, now] of changes) console.log(`  ${field}\n      was: ${was}\n      now: ${now}`)
    console.log('')
  }

  if (APPLY && changes.length > 0) {
    const next = { ...app, launchUri: appBase, redirectUris, allowedOrigin }
    delete next.redirectUri // deprecated; redirectUris is the live field
    const wrote = await fhir(baseUrl, token, `ClientApplication/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(next),
    })
    if (!wrote.ok) fail(`update failed: ${wrote.status}\n  ${wrote.text.slice(0, 600)}`)
    console.log('✓ Registration updated.')
  }

  // Where to click. Worth resolving rather than describing: the Apps tab lives
  // on the patient's page under Medplum's own UUID, which nothing on our side
  // knows — the demo id is an identifier, not an address.
  const found = await fhir(
    baseUrl, token,
    `Patient?identifier=${encodeURIComponent(`${DEMO_ID_SYSTEM}|${SAMPLE_PATIENT}`)}`,
  )
  const hit = found.ok && found.body?.entry?.[0]?.resource?.id
  console.log('\nTo launch:')
  if (hit) {
    console.log(`  https://app.medplum.com/Patient/${hit}/apps      (${SAMPLE_PATIENT})`)
  } else {
    console.log(`  Open any Patient in app.medplum.com and pick the Apps tab.`)
    console.log(`  (${SAMPLE_PATIENT} was not found by identifier — run medplum-load-population.mjs --apply)`)
  }
  if (!APPLY && changes.length > 0) console.log('\n  …after --apply. Nothing was written.')
}

main().catch(err => fail(err?.stack ?? String(err)))
