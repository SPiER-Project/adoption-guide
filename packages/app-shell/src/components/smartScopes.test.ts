import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The SMART scope request must cover what the app actually does.
 *
 * ⚠️ **This list was wrong for a long time and nothing noticed.** `getSlice`
 * searches 13 resource types and `saveArtifact` writes the same set; the scope
 * request named four of them. Nine reads and eight writes were being attempted
 * with no scope asking for permission.
 *
 * It survived because neither server SPiER had ever launched from enforces read
 * scopes. The mock EHR says so about itself, in its own README — *"no read is
 * refused for a missing scope. Do not describe this mock as proving SMART
 * scopes work"* — and the first real third-party server, Medplum, granted the
 * blanket `user/*.read` the app requests on every launch, which covers the gap
 * by accident. Two green servers, one real defect, invisible from both.
 *
 * The failure it hides is the bad kind. Every best-effort read in `getSlice` is
 * wrapped in `.catch(() => [])`, so against a server that grants exactly what
 * was asked for, the chart renders a patient with a thin record rather than an
 * error — plausible and wrong. The writes fail loudly instead, but only after a
 * clinician has filled the form in.
 *
 * ⚠️ **Reads both files as TEXT rather than importing them**, for the reason
 * `toolViews.test.ts` documents: importing `smartDataSource` pulls the tool
 * catalog and therefore the generated FHIR tree, so this could then only run
 * after a SUSHI compile. The question here is structural — do two lists of
 * string literals agree.
 *
 * ── What this gate CANNOT see ───────────────────────────────────────────────
 *
 * Only two sets are derivable from the source with any rigour: the types
 * `getSlice` searches (`this.search('X')`) and the types `saveArtifact` PUTs
 * (`LIFECYCLE_RESOURCE_TYPES`). A type that is only ever **POSTed** — built
 * inline by a recorder and handed to `saveArtifact` — cannot be enumerated by
 * parsing, because `saveArtifact` takes `FhirResource` and the construction is
 * spread across the recorders and mappers. `Procedure` is one of those today.
 * So a green run here means the two derivable sets are covered, NOT that every
 * write has a scope.
 */
const here = __dirname
const SMART_LAUNCH = readFileSync(resolve(here, 'SmartLaunch.tsx'), 'utf8')
const SMART_DATA_SOURCE = readFileSync(
  resolve(here, '../../../core/src/lib/dataSource/smartDataSource.ts'),
  'utf8',
)
const LIFECYCLE_TYPES = readFileSync(
  resolve(here, '../../../core/src/lib/dataSource/lifecycleTypes.ts'),
  'utf8',
)

/** The `patient/<Type>.<access>` scopes the launch requests. */
function requestedScopes(access: 'read' | 'write'): Set<string> {
  return new Set(
    [...SMART_LAUNCH.matchAll(/'patient\/([A-Za-z]+)\.(read|write)'/g)]
      .filter(m => m[2] === access)
      .map(m => m[1]),
  )
}

/**
 * Every resource type a slice read searches for.
 *
 * ⚠️ **Read off `SLICE_READS`, not off `this.search('X')`.** The fourteen
 * searches became a table when the cohort read arrived (clinical-app audit
 * §8.8) — two callers, one list — and the old pattern then matched **nothing**.
 * This gate's own liveness assertion is what said so, on the first run after
 * the refactor, which is the whole reason that assertion exists.
 */
function searchedTypes(): string[] {
  const block = /const SLICE_READS: SliceRead\[\] = \[([\s\S]*?)\n\]/.exec(SMART_DATA_SOURCE)
  if (!block) throw new Error('could not find SLICE_READS — has it been renamed?')
  return [...new Set([...block[1].matchAll(/type: '([A-Za-z]+)'/g)].map(m => m[1]))]
}

/** Every resource type `saveArtifact` PUTs rather than POSTs. */
function lifecycleTypes(): string[] {
  const block = /LIFECYCLE_RESOURCE_TYPES[^[]*\[([\s\S]*?)\]/.exec(LIFECYCLE_TYPES)
  if (!block) throw new Error('could not find LIFECYCLE_RESOURCE_TYPES — has it been renamed?')
  return [...block[1].matchAll(/'([A-Za-z]+)'/g)].map(m => m[1])
}

describe('SMART scope request', () => {
  // Both derivations fail loudly when they read nothing: a rename that made
  // either return [] would otherwise leave this asserting over an empty set and
  // passing everything, which is the failure mode this repo keeps writing gates
  // against.
  it('finds the lists it is comparing', () => {
    expect(searchedTypes().length).toBeGreaterThan(8)
    expect(lifecycleTypes().length).toBeGreaterThan(4)
    expect(requestedScopes('read').size).toBeGreaterThan(4)
  })

  it('requests a read scope for every type getSlice searches', () => {
    const read = requestedScopes('read')
    const missing = searchedTypes().filter(t => !read.has(t))
    expect(missing).toEqual([])
  })

  it('requests a write scope for every lifecycle type saveArtifact PUTs', () => {
    const write = requestedScopes('write')
    const missing = lifecycleTypes().filter(t => !write.has(t))
    expect(missing).toEqual([])
  })

  it('requests Patient.read, without which no launch can resolve its context', () => {
    expect(requestedScopes('read').has('Patient')).toBe(true)
  })
})
