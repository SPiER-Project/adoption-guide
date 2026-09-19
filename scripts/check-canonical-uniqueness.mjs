#!/usr/bin/env node
/**
 * One canonical URL, one definition — enforced across BOTH resource trees.
 *
 * SPiER defines FHIR resources in two places on purpose:
 *   - `ig/input/fsh/` → compiled by SUSHI to `ig/fsh-generated/resources/`
 *   - `ig/input/resources/questionnaires/<tool>/` → hand-authored JSON, published into the IG
 *     through a symlink + per-folder `path-resource` entries
 *
 * CLAUDE.md's rule is that a canonical URL may be defined in exactly one of
 * them. That rule is not decorative: three ASQ CodeSystems once collided, and
 * the `ig/input/resources/questionnaires` copies silently shadowed the IG's with drifted `display`
 * values.
 *
 * ⚠️ **Why this gate exists when SUSHI already rejects duplicates.** SUSHI's
 * duplicate detection keys on resourceType + id, and it never reads
 * `ig/input/resources/questionnaires/` at all (`copy-fhir.mjs`: "Not a SUSHI input"). So it covers
 * exactly one of the two collision shapes, and only because the pre-defined
 * resource happens to reach the publisher by another route:
 *
 *   | planted                    | SUSHI | before this gate |
 *   |----------------------------|-------|------------------|
 *   | same url, SAME id          | error | caught           |
 *   | same url, DIFFERENT id     | quiet | NOTHING          |
 *
 * The second row was verified by planting it (2026-09-18): `copy-fhir --force`
 * passed, `check-ig-narrative` passed, `check-ig-menu` passed. `build-ig-groups
 * --check` failed — but on "published with no groupingId", which a control test
 * showed fires for ANY new resource, colliding or not. So the collision itself
 * was caught by nothing, and a groupingId rule would have let it through.
 *
 * Canonical URL is FHIR's resolution key: a `valueSet` binding or a
 * `Questionnaire.derivedFrom` pointing at a URL that two resources claim is
 * ambiguous, and which one a consumer resolves is an accident of load order.
 *
 * ⚠️ This reads SUSHI's OUTPUT, not the FSH source, because a canonical can be
 * assembled from `sushi-config.yaml`'s canonical base plus an id — it is not
 * reliably a literal in the `.fsh` file. So `ig/fsh-generated/resources/` must
 * exist: run `npx fsh-sushi .` in `ig/`, or `npm run copy-fhir` in `web/`. A
 * missing tree is a hard error rather than a skip, because "nothing to compare"
 * is indistinguishable from "nothing collides" and this repo has shipped that
 * mistake before.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const HAND_AUTHORED = join(repoRoot, 'ig/input/resources/questionnaires')
const GENERATED = join(repoRoot, 'ig', 'fsh-generated', 'resources')

// Scan floors. A gate that reads zero files passes every check it makes, which
// is the silent-pass shape this repo keeps rediscovering. These are deliberately
// well below today's counts (237 canonicals over both trees as of 2026-09-18) —
// they catch "the tree moved / the glob broke", not "someone added a resource".
const FLOOR_HAND_AUTHORED = 10
const FLOOR_GENERATED = 50

const rel = (p) => relative(repoRoot, p)

/** Every `.json` under `dir`, recursively. */
function jsonFiles(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...jsonFiles(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

/**
 * Canonical-bearing resources only. A canonical URL is `url` on a definitional
 * resource; instances (Patient, Observation, QuestionnaireResponse) have none,
 * and `Bundle.entry[].resource` is not a definition either — so anything
 * without a top-level `url` is simply not in scope here.
 */
function collect(dir, tree) {
  const found = []
  for (const file of jsonFiles(dir)) {
    let json
    try {
      json = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      // Not this gate's job to report — validate-fhir.mjs and SUSHI both fail
      // loudly on unparseable JSON, and duplicating that would mean two places
      // to update when the message changes.
      continue
    }
    if (!json || typeof json.url !== 'string') continue
    found.push({ url: json.url, id: json.id, type: json.resourceType, file, tree })
  }
  return found
}

if (!existsSync(GENERATED)) {
  console.error(
    `\n✗ check-canonical-uniqueness: ${rel(GENERATED)} does not exist, so there is nothing to ` +
      'compare the hand-authored tree against.\n\n' +
      '  Compile the IG first — `npx fsh-sushi .` in ig/, or `npm run copy-fhir` in web/.\n' +
      '  This is a hard error on purpose: an empty comparison would report "no collisions"\n' +
      '  while checking nothing.\n',
  )
  process.exit(1)
}

const handAuthored = collect(HAND_AUTHORED, 'ig/input/resources/questionnaires')
const generated = collect(GENERATED, 'ig (FSH)')

if (handAuthored.length < FLOOR_HAND_AUTHORED || generated.length < FLOOR_GENERATED) {
  console.error(
    `\n✗ check-canonical-uniqueness: read ${handAuthored.length} canonical(s) from ` +
      `${rel(HAND_AUTHORED)} (floor ${FLOOR_HAND_AUTHORED}) and ${generated.length} from ` +
      `${rel(GENERATED)} (floor ${FLOOR_GENERATED}).\n\n` +
      '  One of the trees is empty or moved. Refusing to pass on a scan that read almost\n' +
      '  nothing — that is indistinguishable from "no collisions".\n',
  )
  process.exit(1)
}

const byUrl = new Map()
for (const r of [...handAuthored, ...generated]) {
  if (!byUrl.has(r.url)) byUrl.set(r.url, [])
  byUrl.get(r.url).push(r)
}

const collisions = [...byUrl.entries()].filter(([, defs]) => defs.length > 1)

if (collisions.length) {
  console.error(`\n✗ check-canonical-uniqueness: ${collisions.length} canonical URL(s) defined more than once:\n`)
  for (const [url, defs] of collisions) {
    console.error(`  ${url}`)
    for (const d of defs) console.error(`      ${d.tree.padEnd(15)} ${d.type}/${d.id}  ${rel(d.file)}`)
    const trees = new Set(defs.map((d) => d.tree))
    if (trees.size > 1) {
      console.error(
        '      ⚠️ ACROSS BOTH TREES — the hand-authored copy shadows the FSH one, which is the\n' +
          '         shape that shipped drifted `display` values in the three ASQ CodeSystems.',
      )
    }
    console.error('')
  }
  console.error(
    '  `ig/` is canonical for CodeSystems and ValueSets; `ig/input/resources/questionnaires/` holds Questionnaires.\n' +
      '  Delete the duplicate, or give it its own URL — never let two resources claim one canonical.\n',
  )
  process.exit(1)
}

console.log(
  `✓ check-canonical-uniqueness: ${byUrl.size} distinct canonical URL(s), each defined once.`,
)
console.log(
  `  scanned ${rel(HAND_AUTHORED)}: ${handAuthored.length} (floor ${FLOOR_HAND_AUTHORED})  ` +
    `${rel(GENERATED)}: ${generated.length} (floor ${FLOOR_GENERATED})`,
)
