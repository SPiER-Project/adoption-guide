#!/usr/bin/env node
/**
 * Load SPiER's 14 demo patients and their scenario slices into a Medplum project.
 *
 * Step 1b of the Medplum evaluation. Step 1 (`medplum-upload.mjs`) put the IG's
 * profiles on the server; this puts resources that CLAIM those profiles in front
 * of them. 73 of the 134 scenario resources carry `meta.profile`, so over half of
 * this load is a real test rather than a copy.
 *
 *   node scripts/medplum-load-population.mjs            # build + report, upload NOTHING
 *   node scripts/medplum-load-population.mjs --apply    # write to the project
 *   node scripts/medplum-load-population.mjs --apply --force   # load again even if present
 *
 * ─── ⚠️ Ids: why every one of them is thrown away ───────────────────────────
 *
 * Medplum requires resource ids to be UUIDs and refuses anything else with
 * `badRequest('Invalid id')`, on read as well as write, with no escape hatch
 * (`packages/server/src/fhir/repo.ts`). SPiER's ids are `patient-011`,
 * `p011-asq`, `p011-enc-ed` — all refused.
 *
 * But the ids are also the only thing holding a scenario together: a slice is a
 * web of `Type/id` references (`Observation.derivedFrom` →
 * `QuestionnaireResponse/p011-asq`, `Encounter.episodeOfCare` →
 * `EpisodeOfCare/p011-episode`). Rewriting each to a server-assigned UUID would
 * mean creating in dependency order and remapping as you go — and a cycle would
 * make that impossible.
 *
 * FHIR already solves this. A `transaction` Bundle whose entries have
 * `urn:uuid:` fullUrls and reference each other by those urns is resolved by the
 * server: it assigns real ids and rewrites every reference in one atomic step.
 * Proved against this project before the script was written — a two-entry probe
 * came back `Flag.subject.reference = "Patient/2e2d1457-…"`. Medplum ships the
 * same idea as `convertToTransactionBundle()` in `@medplum/core`; the rewrite is
 * reimplemented here rather than imported because the repo root has no
 * `package.json` and one dependency is not worth one function.
 *
 * ⚠️ **`patient-011` survives as an `identifier`, and that is load-bearing.**
 * Without it the demo population lands as 14 anonymous UUIDs and nothing —
 * not the demo script, not a CDS context, not a human — can find "the ED
 * patient" again. It is also what
 * `ClientApplication.launchIdentifierSystems` reads to hand SPiER its own id
 * back in a SMART token, which is what step 2 needs.
 *
 * ─── One bundle per patient, not one for the population ─────────────────────
 *
 * A transaction is atomic, so a single 14-patient bundle fails wholesale on one
 * bad resource and reports one error for 400-odd resources. Per patient, a
 * rejection names the patient and survives as 13 loaded ones — and since the
 * point of this exercise is to be REJECTED by somebody else's validator, the
 * failure path is the one worth designing for.
 *
 * ─── What is not uploaded ───────────────────────────────────────────────────
 *
 * `riskAlerts` and `walkthrough` are SPiER app constructs with no
 * `resourceType` — they are computed views over the slice, not FHIR, and there
 * is nothing to POST. `responses[]` wraps its QuestionnaireResponse in a
 * `.resource` field and is unwrapped.
 *
 * ⚠️ A QuestionnaireResponse's `questionnaire` canonical points at
 * `FHIR-Resources/`, which step 1 did NOT upload (it loaded conformance only).
 * Medplum does not refuse a dangling canonical, so these load — but a
 * Questionnaire-aware check on that server would find nothing behind it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const POP = join(REPO, 'packages/demo-population/src')

/** The system under which SPiER's own patient id survives the UUID rewrite. */
const DEMO_ID_SYSTEM = 'http://thespierproject.org/fhir/identifier/demo-id'

/** Buckets that are computed views rather than FHIR. See the header. */
const NON_FHIR_BUCKETS = new Set(['riskAlerts', 'walkthrough'])

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const FORCE = args.has('--force')

function fail(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

// ── Build one transaction bundle per patient ────────────────────────────────

function scenarioResources(scenario) {
  const out = []
  for (const [bucket, value] of Object.entries(scenario)) {
    if (NON_FHIR_BUCKETS.has(bucket) || !Array.isArray(value)) continue
    for (const item of value) {
      const resource = item?.resourceType ? item : item?.resource
      if (resource?.resourceType) out.push(resource)
    }
  }
  return out
}

/**
 * Rewrite `Type/id` references to the `urn:uuid:` fullUrls the transaction will
 * resolve. Only keys literally named `reference` are touched: a
 * QuestionnaireResponse's `questionnaire` is a canonical URL, not a Reference,
 * and rewriting it would break it.
 */
function rewriteReferences(node, idMap) {
  if (Array.isArray(node)) return node.map(n => rewriteReferences(n, idMap))
  if (!node || typeof node !== 'object') return node
  const out = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === 'reference' && typeof value === 'string' && idMap.has(value)) {
      out[key] = idMap.get(value)
    } else {
      out[key] = rewriteReferences(value, idMap)
    }
  }
  return out
}

function buildBundle(patientId, patient, scenario) {
  const resources = [patient, ...scenarioResources(scenario)]

  // Pass 1: every resource gets a urn, keyed by the `Type/id` others cite.
  const idMap = new Map()
  const urns = []
  for (const r of resources) {
    const urn = `urn:uuid:${randomUUID()}`
    urns.push(urn)
    if (r.id) idMap.set(`${r.resourceType}/${r.id}`, urn)
  }

  // Pass 2: strip ids, rewrite references, carry the SPiER id as an identifier.
  const entry = resources.map((r, i) => {
    const body = rewriteReferences(r, idMap)
    delete body.id
    if (body.resourceType === 'Patient') {
      body.identifier = [
        ...(body.identifier ?? []),
        { system: DEMO_ID_SYSTEM, value: patientId },
      ]
    }
    return {
      fullUrl: urns[i],
      resource: body,
      request: { method: 'POST', url: body.resourceType },
    }
  })

  return { resourceType: 'Bundle', type: 'transaction', entry }
}

function load() {
  const patientDir = join(POP, 'patients')
  const scenarioDir = join(POP, 'scenarios')
  const ids = readdirSync(patientDir)
    .filter(n => /^patient-\d+\.json$/.test(n))
    .map(n => n.replace(/\.json$/, ''))
    .sort()
  if (!ids.length) fail(`no demo patients under ${patientDir}`)

  return ids.map(id => {
    const patient = JSON.parse(readFileSync(join(patientDir, `${id}.json`), 'utf8'))
    let scenario = {}
    try {
      scenario = JSON.parse(readFileSync(join(scenarioDir, `${id}.json`), 'utf8'))
    } catch {
      // A patient with no scenario is a chart with nothing in it — patient-002
      // is deliberately one of those, so this is not an error.
    }
    return { id, bundle: buildBundle(id, patient, scenario) }
  })
}

// ── Medplum ─────────────────────────────────────────────────────────────────

async function getToken(baseUrl) {
  if (process.env.MEDPLUM_TOKEN) return process.env.MEDPLUM_TOKEN
  const { MEDPLUM_CLIENT_ID: id, MEDPLUM_CLIENT_SECRET: secret } = process.env
  if (!id || !secret) fail('set MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET (or MEDPLUM_TOKEN)')
  const res = await fetch(new URL('oauth2/token', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
  })
  if (!res.ok) fail(`token request failed: ${res.status} ${await res.text()}`)
  const body = await res.json()
  if (!body.access_token) fail('token response carried no access_token')
  return body.access_token
}

/** A transaction POSTs unconditionally, so without this a re-run doubles the population. */
async function alreadyLoaded(baseUrl, token, patientId) {
  const url = new URL('fhir/R4/Patient', baseUrl)
  url.searchParams.set('identifier', `${DEMO_ID_SYSTEM}|${patientId}`)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return false
  const bundle = await res.json()
  return Boolean(bundle.entry?.length)
}

function describeFailure(body) {
  const issues = []
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.resourceType === 'OperationOutcome') {
      for (const i of node.issue ?? []) {
        if (i.severity === 'error' || i.severity === 'fatal') {
          issues.push(`${i.details?.text ?? i.diagnostics ?? 'error'} @ ${(i.expression ?? []).join(',') || '?'}`)
        }
      }
    }
    Object.values(node).forEach(walk)
  }
  walk(body)
  return issues.length ? issues : ['(no OperationOutcome in the response)']
}

async function main() {
  const bundles = load()
  const totalResources = bundles.reduce((n, b) => n + b.bundle.entry.length, 0)

  console.log(`${bundles.length} patients, ${totalResources} resources:\n`)
  for (const { id, bundle } of bundles) {
    const profiled = bundle.entry.filter(e => e.resource.meta?.profile).length
    console.log(
      `  ${id}  ${String(bundle.entry.length).padStart(3)} resources`
        + `  ${String(profiled).padStart(3)} carry meta.profile`,
    )
  }

  if (!APPLY) {
    console.log('\n— dry run, nothing uploaded. Re-run with --apply.')
    return
  }

  const baseUrl = process.env.MEDPLUM_BASE_URL ?? 'https://api.medplum.com/'
  const token = await getToken(baseUrl)
  console.log(`\nloading into ${baseUrl} …\n`)

  let created = 0
  const failures = []
  for (const { id, bundle } of bundles) {
    if (!FORCE && (await alreadyLoaded(baseUrl, token, id))) {
      console.log(`  ${id}  already present — skipped (--force to load anyway)`)
      continue
    }
    const res = await fetch(new URL('fhir/R4', baseUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/fhir+json' },
      body: JSON.stringify(bundle),
    })
    const text = await res.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }

    const entries = body?.entry ?? []
    const ok = entries.filter(e => String(e.response?.status ?? '').startsWith('2')).length
    if (res.ok && ok === bundle.entry.length) {
      created += ok
      console.log(`  ${id}  ✓ ${ok} created`)
    } else {
      failures.push({ id, status: res.status, issues: describeFailure(body ?? text) })
      console.log(`  ${id}  ✗ ${res.status} — ${ok}/${bundle.entry.length} created`)
    }
  }

  if (failures.length) {
    console.error(`\n✗ ${failures.length} patient(s) failed:\n`)
    for (const f of failures) {
      console.error(`  ${f.id} (HTTP ${f.status})`)
      for (const issue of f.issues.slice(0, 8)) console.error(`      ${issue}`)
      if (f.issues.length > 8) console.error(`      … and ${f.issues.length - 8} more`)
      console.error('')
    }
    process.exit(1)
  }

  console.log(`\n✓ ${created} resources created.`)
  console.log(`  Find a patient again with: Patient?identifier=${DEMO_ID_SYSTEM}|patient-011`)
}

await main()
