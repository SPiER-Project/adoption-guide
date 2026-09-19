#!/usr/bin/env node
/**
 * Load SPiER's CONFORMANCE resources into a Medplum project.
 *
 * This is step 1 of the Medplum evaluation: put the IG's profiles, code systems
 * and value sets on a FHIR server **we did not write**, so that `meta.profile`
 * on a resource means something checked by somebody else's validator. SPiER's
 * own mock EHR says outright that nothing observed there is evidence of
 * interoperability (`services/mock-ehr/README.md`) and that the portability
 * claim has to be made separately, against a server we do not control. This
 * script is the first half of discharging that.
 *
 *   node scripts/medplum-upload.mjs              # compile + validate, upload NOTHING
 *   node scripts/medplum-upload.mjs --apply      # actually write to the project
 *   node scripts/medplum-upload.mjs --reuse      # skip the ~30s compile
 *
 * `--check` is the default and `--apply` is the verb, the same split as
 * `scripts/shift-scenario-dates.mjs`: this one talks to a live server over
 * the network, so the default has to be the one that cannot surprise anybody.
 *
 * ─── ⚠️ The snapshot, which is the whole reason this is a script ──────────────
 *
 * Medplum's validator reads `StructureDefinition.snapshot` and **ignores
 * `differential`** — their own FSH guide says so ("The server tooling only looks
 * at `snapshot`"). SUSHI's `--snapshot` flag defaults to **false**, and SPiER
 * never passes it: all 47 StructureDefinitions in `ig/fsh-generated/` are
 * differential-only.
 *
 * So the obvious version of this script — glob `ig/fsh-generated/`, POST it —
 * would upload 47 profiles, get 47 happy `201`s, and leave a project where
 * every `meta.profile` resolves to a profile that constrains **nothing**. Every
 * subsequent write would pass. That is the failure this repo names constantly:
 * a green result from a check that was never checking. It is worse than a red
 * one, because the demo would then *look* like independent validation.
 *
 * Two things follow, and both are deliberate:
 *
 *   - this script compiles the IG **itself**, with `-s`, into its own output
 *     tree — it never reads `ig/fsh-generated/`, so it cannot accidentally
 *     inherit the differential-only build that every other consumer wants;
 *   - a StructureDefinition that arrives here without a populated
 *     `snapshot.element` is a **hard failure that uploads nothing**, not a
 *     warning. If the flag ever silently stops working, this stops too.
 *
 * ⚠️ It writes to `ig/fsh-generated-snapshot/`, NOT to `ig/fsh-generated/`.
 * Adding snapshots to the canonical tree would change what `copy-fhir`, the IG
 * Publisher and `check-sushi-output.mjs` all consume, for the benefit of one
 * external server. Two trees, one source.
 *
 * ─── ⚠️ Ids are stripped, and they have to be ───────────────────────────────
 *
 * Medplum requires every resource id to be a UUID —
 * `packages/server/src/fhir/repo.ts` rejects anything else with
 * `badRequest('Invalid id')`, on read as well as write, with no escape hatch.
 * SUSHI names resources for humans (`spier-asq-response`), so every id here
 * would be refused.
 *
 * Nothing is lost by dropping them: conformance resources are resolved by
 * canonical `url`, which is exactly what `meta.profile` carries and what this
 * script upserts on. The id is the IG's page name, not the profile's identity.
 *
 * ─── What this does NOT upload ──────────────────────────────────────────────
 *
 * Only the four types below. ActivityDefinitions, PlanDefinitions, Measures,
 * the Library and the IG's example instances are *content*, not conformance:
 * they are not what makes a write get validated, and the examples belong with
 * the demo population in step 1b, where they need reference rewriting this
 * script deliberately does not do. Uploading them here would mean this script
 * had two jobs and no clear failure mode for either.
 *
 * ⚠️ **An accepted upload is not yet evidence of anything.** It means the
 * profiles are *present*. The claim needs a resource carrying `meta.profile` to
 * be accepted or rejected on its merits — and CLAUDE.md records that SPiER's
 * instrument mappers currently stamp no profile at all, so that is real work,
 * not a follow-on. Medplum's `Project.defaultProfile` can stamp per resource
 * type server-side and is worth considering there.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SUSHI_VERSION } from './lib/sushi-version.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const IG_DIR = join(REPO, 'ig')
const OUT_NAME = 'fsh-generated-snapshot'
// ⚠️ `-o <dir>` is the project output ROOT, not the resources folder: SUSHI
// still appends its own `fsh-generated/` inside it. The help text ("the path to
// the output folder", default `fsh-generated`) reads like the opposite.
const OUT_DIR = join(IG_DIR, OUT_NAME, 'fsh-generated', 'resources')

/**
 * Upload order is dependency order: a ValueSet's `compose` names CodeSystems, a
 * profile's bindings name ValueSets, and a ConceptMap names both ends. Medplum
 * resolves these lazily so the order is not strictly required — but a project
 * that is briefly inconsistent while a load is half done is a confusing thing
 * to debug, and the ordering costs nothing.
 */
const CONFORMANCE_TYPES = ['CodeSystem', 'ValueSet', 'StructureDefinition', 'ConceptMap']

/**
 * Teach Medplum how to recognise an extension slice.
 *
 * ⚠️ **Without this, every sliced extension in every SPiER profile reads as
 * absent, and a conformant resource is REJECTED.** Found the hard way: the
 * first population load rejected all 8 EpisodeOfCare fixtures with
 * `slice 'entryReason': expected 1..1, but found 0`, while all 8 carried the
 * extension at exactly the canonical the profile names.
 *
 * FHIR slices extensions with `discriminator: {type: 'value', path: 'url'}`, and
 * SUSHI expresses which extension a slice accepts as `type[0].profile` — it emits
 * **no** element constraining the slice's own `url`. A validator is expected to
 * resolve the referenced extension definition and read its `url`. Medplum does
 * not: `matchDiscriminant` (`packages/core/src/typeschema/validation.ts`) matches
 * a `value` discriminator only against `sliceElement.pattern` or
 * `sliceElement.fixed`, looked up as `slice.elements['url']`. No such element, no
 * match, ever.
 *
 * So the snapshot is given the element Medplum looks for: `<slice>.url` fixed to
 * the extension's canonical, which is what the discriminator would have resolved
 * to anyway. This adds no constraint that the profile did not already express —
 * it restates one in the shape this particular server can read.
 *
 * ⚠️ The `type` is copied from the base spec's own `Extension.url`
 * (`http://hl7.org/fhirpath/System.String` carrying a `structuredefinition-fhir-type`
 * of `uri`) rather than written as `uri` directly, because Medplum compares the
 * discriminator with `deepEquals` over the whole TypedValue — **including its
 * type** — so a plausible-looking `uri` here can silently never match.
 *
 * ⚠️ A slice that already constrains its own `url` is left alone: the profile
 * author said something specific and this must not overwrite it.
 */
const EXTENSION_URL_TYPE = [
  {
    extension: [
      {
        url: 'http://hl7.org/fhir/StructureDefinition/structuredefinition-fhir-type',
        valueUrl: 'uri',
      },
    ],
    code: 'http://hl7.org/fhirpath/System.String',
  },
]

function addExtensionSliceUrls(sd) {
  const elements = sd.snapshot?.element
  if (!elements) return 0

  const existing = new Set(elements.map(e => e.id))
  const out = []
  let added = 0

  for (const element of elements) {
    out.push(element)
    const isExtensionSlice =
      element.sliceName
      && /\.(extension|modifierExtension)$/.test(element.path ?? '')
      && element.type?.[0]?.code === 'Extension'
    const canonical = element.type?.[0]?.profile?.[0]
    if (!isExtensionSlice || !canonical) continue
    if (existing.has(`${element.id}.url`)) continue // the author constrained it already

    out.push({
      id: `${element.id}.url`,
      path: `${element.path}.url`,
      // ⚠️ `definition` is not decoration — invariant sdf-3 is
      // `element.all(definition.exists() and min.exists() and max.exists())`, and
      // Medplum enforces it on write: without it the whole StructureDefinition is
      // refused with a 400, which is how this line came to be here.
      short: 'identifies the meaning of the extension',
      definition: `Fixed to ${canonical} so the slice discriminator can resolve.`,
      min: 1,
      max: '1',
      base: { path: 'Extension.url', min: 1, max: '1' },
      type: EXTENSION_URL_TYPE,
      fixedUri: canonical,
    })
    added += 1
  }

  if (added) sd.snapshot.element = out
  return added
}

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const REUSE = args.has('--reuse')

function fail(msg) {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

// ── 1. Compile the IG with snapshots ────────────────────────────────────────

function compile() {
  if (REUSE && existsSync(OUT_DIR)) {
    console.log(`reusing ${OUT_NAME}/ (--reuse)`)
    return
  }
  console.log(`compiling ${IG_DIR} with fsh-sushi@${SUSHI_VERSION} --snapshot …`)
  const run = spawnSync('npx', ['-y', `fsh-sushi@${SUSHI_VERSION}`, '.', '-s', '-o', OUT_NAME], {
    cwd: IG_DIR,
    encoding: 'utf8',
  })
  if (run.error) fail(`could not run fsh-sushi: ${run.error.message}`)
  if (run.status !== 0) {
    console.error(run.stdout ?? '')
    console.error(run.stderr ?? '')
    fail(`fsh-sushi exited ${run.status}`)
  }
}

// ── 2. Read and validate ────────────────────────────────────────────────────

function collect() {
  if (!existsSync(OUT_DIR)) fail(`no compiled output at ${OUT_DIR}`)
  const byType = new Map(CONFORMANCE_TYPES.map(t => [t, []]))

  for (const name of readdirSync(OUT_DIR)) {
    if (!name.endsWith('.json')) continue
    let resource
    try {
      resource = JSON.parse(readFileSync(join(OUT_DIR, name), 'utf8'))
    } catch (err) {
      fail(`${name} is not valid JSON: ${err.message}`)
    }
    const bucket = byType.get(resource.resourceType)
    if (!bucket) continue
    if (!resource.url) fail(`${name} has no canonical url — nothing to upsert on`)
    bucket.push({ file: name, resource })
  }

  // The guard this script exists for. A differential-only profile uploads
  // cleanly and validates nothing, so it must stop the run rather than warn.
  const flat = [...byType.values()].flat()
  const unusable = flat.filter(
    e => e.resource.resourceType === 'StructureDefinition' && !e.resource.snapshot?.element?.length,
  )
  if (unusable.length) {
    console.error(
      `\n✗ ${unusable.length} StructureDefinition(s) have no snapshot.element.\n`
        + '  Medplum validates against `snapshot` and ignores `differential`, so these\n'
        + '  would upload cleanly and constrain nothing. Did the `-s` flag stop working?\n',
    )
    for (const e of unusable.slice(0, 10)) console.error(`    ${e.file}`)
    if (unusable.length > 10) console.error(`    … and ${unusable.length - 10} more`)
    process.exit(1)
  }

  // Restate every extension slice's url so Medplum can discriminate on it.
  let patchedSlices = 0
  let patchedProfiles = 0
  for (const entry of byType.get('StructureDefinition')) {
    const added = addExtensionSliceUrls(entry.resource)
    if (added) {
      patchedSlices += added
      patchedProfiles += 1
    }
  }

  const total = flat.length
  if (!total) fail('no conformance resources found — is the output tree empty?')
  return { byType, total, patchedSlices, patchedProfiles }
}

// ── 3. Talk to Medplum ──────────────────────────────────────────────────────

function env(name, fallback) {
  const v = process.env[name] ?? fallback
  if (v === undefined) {
    fail(
      `${name} is not set.\n`
        + '  Set MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET (a ClientApplication with\n'
        + '  client_credentials), or MEDPLUM_TOKEN for an access token you already hold.\n'
        + '  MEDPLUM_BASE_URL defaults to https://api.medplum.com/ — point it at\n'
        + '  http://localhost:8103/ for a self-hosted server.',
    )
  }
  return v
}

async function getToken(baseUrl) {
  if (process.env.MEDPLUM_TOKEN) return process.env.MEDPLUM_TOKEN
  const clientId = env('MEDPLUM_CLIENT_ID')
  const clientSecret = env('MEDPLUM_CLIENT_SECRET')
  const res = await fetch(new URL('oauth2/token', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) fail(`token request failed: ${res.status} ${await res.text()}`)
  const body = await res.json()
  if (!body.access_token) fail('token response carried no access_token')
  return body.access_token
}

/**
 * Upsert by canonical url — FHIR conditional update, which Medplum documents as
 * its `upsert` operation. One request, idempotent, so a re-run after a partial
 * failure is safe and does not leave duplicate profiles behind.
 */
async function upsert(baseUrl, token, entry) {
  const { resourceType, url } = entry.resource
  const body = { ...entry.resource }
  delete body.id // see the note at the top: Medplum ids must be UUIDs

  const target = new URL(`fhir/R4/${resourceType}`, baseUrl)
  target.searchParams.set('url', url)

  const res = await fetch(target, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/fhir+json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, status: res.status, detail: text.slice(0, 400) }
  return { ok: true, status: res.status }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  compile()
  const { byType, total, patchedSlices, patchedProfiles } = collect()

  console.log(`\n${total} conformance resources ready:`)
  for (const type of CONFORMANCE_TYPES) {
    console.log(`  ${String(byType.get(type).length).padStart(3)}  ${type}`)
  }
  console.log(
    `\n  ${patchedSlices} extension slice(s) across ${patchedProfiles} profile(s) given an`
      + ' explicit url\n  so Medplum can discriminate on them (see addExtensionSliceUrls).',
  )

  if (!APPLY) {
    console.log(
      '\n— dry run, nothing uploaded. Re-run with --apply to write to the project.\n'
        + '  (every StructureDefinition above carries a populated snapshot)',
    )
    return
  }

  const baseUrl = env('MEDPLUM_BASE_URL', 'https://api.medplum.com/')
  const token = await getToken(baseUrl)
  console.log(`\nuploading to ${baseUrl} …`)

  const failures = []
  let done = 0
  for (const type of CONFORMANCE_TYPES) {
    for (const entry of byType.get(type)) {
      const result = await upsert(baseUrl, token, entry)
      done += 1
      if (result.ok) {
        process.stdout.write(`\r  ${done}/${total}`)
      } else {
        failures.push({ file: entry.file, ...result })
        process.stdout.write(`\r  ${done}/${total} (${failures.length} failed)`)
      }
    }
  }
  process.stdout.write('\n')

  if (failures.length) {
    console.error(`\n✗ ${failures.length} of ${total} failed:\n`)
    for (const f of failures.slice(0, 15)) {
      console.error(`  ${f.file} → ${f.status}\n    ${f.detail}\n`)
    }
    if (failures.length > 15) console.error(`  … and ${failures.length - 15} more`)
    process.exit(1)
  }

  console.log(`\n✓ ${total} conformance resources upserted.`)
  console.log(
    '  Next: a resource carrying meta.profile has to be accepted or REJECTED on its\n'
      + '  merits before any of this is evidence. Presence is not validation.',
  )
}

await main()
