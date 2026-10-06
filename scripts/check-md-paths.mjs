#!/usr/bin/env node
// Every repo-rooted path written as backticked prose in a tracked .md must exist.
//
// `check-md-links.mjs` resolves LINKS only. A path written as `web/src/Foo.tsx`
// in running prose is invisible to it, which is exactly how 45+ of them rotted
// through two package extractions — including the opening line of
// docs/internals/tool-views.md, a live internals doc CLAUDE.md links to.
//
// ⚠️ A bare existence check would be mostly noise, because this repo's
// convention is to SUPERSEDE rather than delete: "`foo.css` is the former
// `web/src/index.css`" is correct prose about a file that is *meant* to be gone,
// and "will live in `ig/input/pagecontent/asq.md` when that page is created" is
// a page not yet written. So a missing path is a failure unless it is in
// ALLOWED below WITH A REASON. Never a count — a reasoned list, per the same
// rule as check-sushi-output.mjs's warning allowlist.
//
// ⚠️ THE ALLOWLIST IS BUILT TO EXPIRE, and that is the half that keeps it
// honest. Two extra failure modes, both deliberate:
//   - an entry whose path NOW EXISTS is an error. `apps/guide/src/App.tsx` sat
//     in here twice as a forward reference until the apps/ split landed, and
//     this rule is what made those entries be deleted rather than left covering
//     a path nobody rechecked. `apps/patient` is the same kind of entry today.
//   - an entry whose (file, path) pair no longer OCCURS is an error, so a
//     rewritten sentence cannot leave its exemption behind.
//
// docs/plans/archive/ is exempt by directory: it is history by construction and
// retargeting a path there would falsify the record of what was true at the time.

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const ROOT = process.cwd()

// Generated trees: not tracked, so "does not exist" says nothing about the prose.
const GENERATED = [
  'ig/fsh-generated', 'packages/fhir-artifacts/generated', '.runtime-fhir',
  'ig/output', 'docs/use-cases/dist', 'dist', 'node_modules',
]

const ARCHIVE = 'docs/plans/archive/'

// A path that is deliberately absent. Key is `<md file>::<path>`; value is why.
const ALLOWED = new Map(Object.entries({
  // -- the gate's own internals doc QUOTES rotted paths as examples, which is
  //    unavoidable: a page explaining which paths rotted has to name them.
  'docs/internals/docs-gates.md::packages/ui/src/index.css': 'quoted as an example of correct supersede prose',
  'docs/internals/docs-gates.md::ig/input/fsh/population-patients.fsh': 'quoted as an example of correct supersede prose',
  'docs/internals/docs-gates.md::packages/core/src/lib/foo.ts': 'invented path, illustrating what the gate cannot see',
  'docs/internals/docs-gates.md::apps/guide/src/Foo.tsx': 'invented path, illustrating the missing-trigger hole',

  // -- per-instrument IG pages that were never authored. The licensing memos
  //    say so in as many words ("when that page is created").
  'docs/instruments/ASQ/licensing/MEMO.md::ig/input/pagecontent/asq.md': 'IG attribution page not yet authored; memo says so',
  'docs/instruments/BSSA/licensing/MEMO.md::ig/input/pagecontent/bssa.md': 'IG attribution page not yet authored; memo says so',
  'docs/instruments/PSS-3/licensing/MEMO.md::ig/input/pagecontent/pss3.md': 'IG attribution page not yet authored; memo says so',
  'docs/instruments/SAFE-T/licensing/MEMO.md::ig/input/pagecontent/safet.md': 'IG attribution page not yet authored; memo says so',

  // -- forward references to directories, visible since directories are read
  //    (2026-10-06). Each names a tree a plan or a to-do says to create.
  'docs/best-practices/licensing-verification-backlog.md::public/fonts/area/': 'the to-do: "drop the licensed WOFF2 files into" it once a licence exists',
  'docs/plans/repo-and-package-boundaries.md::apps/patient': 'phase 3, "Not started. Blocked on a decision to build it at all"',
  'docs/plans/repo-and-package-boundaries.md::apps/adoption-guide': 'the plan\'s §6 proposed layout; the split shipped as apps/guide + apps/clinical and the plan\'s status table says so',
  'docs/plans/repo-and-package-boundaries.md::apps/cds-hooks': 'same proposed layout; the Worker became services/cds',
  'docs/plans/repo-and-package-boundaries.md::apps/web': 'same proposed layout, in the section arguing for it',

  // -- history: the sentence around each of these says the file is gone.
  //
  // ⚠️ **Eleven `web/…` entries were deleted here at the tooling hoist, and
  //    their prose was NOT changed.** `web/` stopped being a tracked top-level
  //    directory, so `topLevel` no longer contains it and the scan skips every
  //    `web/…` path before it reaches this map — an entry for one can never
  //    fire, which is what `stale` reports. The sentences are still correct
  //    history ("the former `web/src/index.css`"); they are simply outside
  //    what this gate can see now. Nothing is owed unless `web/` comes back.
  'services/guide/README.md::.github/workflows/deploy-cloudflare.yml': 'reads "the collision that deleted ... in #143"',
  'packages/demo-population/src/patients/README.md::ig/input/fsh/population-patients.fsh': 'reads "They were ... until step E2"; the file left the IG in #399',
  'docs/internals/docs-gates.md::ig/input/resources/questionnaires/README.md': 'recounts a defect the links gate once found in that README, which has since gone',

  // -- the outreach one-pager pipeline, deleted whole. The README narrates it
  //    in the past tense ("were the outreach handout").
  'docs/outreach/README.md::public/SPiER-Overview-Care-Pathway.html': 'one-pager pipeline deleted; README is past tense',
  'docs/outreach/README.md::docs/one-pager.md': 'same',
  'docs/outreach/README.md::scripts/build-onepager.mjs': 'same',
  'docs/outreach/README.md::.github/workflows/onepager.yml': 'same',

  // -- the 14 demo patients left the IG in #399 (step E2a). Three plan docs
  //    narrate that move and name the file it moved from.
  'docs/plans/mock-patient-smart-launch.md::ig/input/fsh/population-patients.fsh': 'same',
  'docs/plans/repo-and-package-boundaries.md::ig/input/fsh/population-patients.fsh': 'same',
  'docs/plans/surfaces-and-distribution.md::ig/input/fsh/population-patients.fsh': 'same',

  // -- `web/` was deleted whole at the tooling hoist (#553). RETIRED_ROOTS below
  //    makes these paths visible again; every one of them is already correctly
  //    hedged as history ("formerly", "now deleted", struck through) rather
  //    than a present-tense claim, so the fix here is an allowlist entry, not a
  //    rewrite.
  '.claude/skills/assessment-to-ig/SKILL.md::web/src/pages/Roadmap.tsx': 'struck through, with an immediately-following ⚠️ saying the Roadmap page was deleted',
  // CLAUDE.md carried both of these until 2026-09-20; the sentences moved to
  // docs/internals with the rest of the reasoning (C1 of the repo-cruft audit).
  'docs/internals/docs-gates.md::web/src/index.css': 'quotes "the former `web/src/index.css`" as the example of correct supersede prose',
  'docs/internals/repo-layout.md::web/src/index.css': 'reads "formerly `web/src/index.css`"',
  'docs/internals/repo-layout.md::web/src/lib/surface.ts': 'reads "`web/src/lib/surface.ts` is deleted"',
  'docs/plans/maintainability-audit-2026-09-15.md::web/src/css/Dashboard.css': 'row is annotated "(now deleted)"',
  'docs/plans/next-session-handoff.md::web/src/data/roadmap.generated.json': 'reads "that file has since been deleted along with the Roadmap page"',
  'docs/plans/tool-loading-and-views-audit-2026-09-17.md::web/src/components/WorkflowActionView.tsx': 'table cell reads "deleted with its last caller"',
  'packages/ui/README.md::web/src/index.css': 'reads "the former `web/src/index.css`"',
}))

// Repo-rooted prefixes are DERIVED from the tracked tree, not typed, so a new
// top-level directory is covered the day it appears.
const tracked = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n')
const topLevel = new Set(tracked.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))
// Roots that used to be tracked and are named in historical or superseded
// prose. Once a root leaves the tree, `topLevel` forgets it and every path
// under it (e.g. `web/src/Foo.tsx`) skips the scan instead of being checked —
// which is exactly how 45+ `web/…` paths rotted through the tooling hoist.
// Naming them here keeps those paths visible to the gate: current-tense claims
// about a retired root now fail, and correctly historical ones need an
// ALLOWED entry, same as any other missing path.
const RETIRED_ROOTS = ['web', 'FHIR-Resources']
RETIRED_ROOTS.forEach((r) => topLevel.add(r))

const mdFiles = tracked.filter((f) => f.endsWith('.md') && !f.startsWith(ARCHIVE))

// `<Component>`, `${expr}`, globs, an elided `…` and the patient-0NN template
// are not paths.
const PLACEHOLDER = /[<>${}*…]|0NN/

/**
 * A backticked token → the repo path it names, or null.
 *
 * ⚠️ Until 2026-10-06 only a token ending in a file EXTENSION was read, so
 * every directory (`ig/input/resources/questionnaires/CARS-S/`), every
 * extensionless file, every `./`-prefixed path and every `file.ts:137` /
 * `doc.md#anchor` reference was invisible — 650+ paths in live docs, one of
 * them a licensing memo giving a "Repository location" that did not exist.
 * Now the suffixes are stripped before resolving, not used to skip.
 */
function toPath(token) {
  let p = token.replace(/[),.;]+$/, '').replace(/^\.\//, '')
  p = p.replace(/#.*$/, '') // `doc.md#anchor` — the anchor is the links gate's problem, not this one
  p = p.replace(/:\d+(?:[-–,]\d+)*(?::\d+)?$/, '').replace(/:$/, '') // `file.ts:137`, `:43–67`, `:145,171`
  if (!p.includes('/')) return null
  if (!topLevel.has(p.split('/')[0])) return null
  if (PLACEHOLDER.test(p)) return null
  if (GENERATED.some((g) => p === g || p.startsWith(`${g}/`))) return null
  // A DIRECTORY under a retired root (`web/`, `web/src`, `FHIR-Resources/`) is
  // the name of a tree RETIRED_ROOTS already declares gone — history by
  // construction, named ~50 times in live docs ("`web/src` becomes
  // `apps/guide/src`"). Files under a retired root are still checked, exactly
  // as before directories were read at all: those are the claims that rot.
  if (RETIRED_ROOTS.includes(p.split('/')[0]) && !/\.[A-Za-z0-9]{1,6}$/.test(p.replace(/\/$/, ''))) return null
  return p
}

const findings = []
for (const f of mdFiles) {
  const lines = readFileSync(`${ROOT}/${f}`, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/`([^`\s]+)`/g)) {
      const p = toPath(m[1])
      if (p) findings.push({ f, line: i + 1, p })
    }
  })
}

// Build output and anything else gitignored is correct to name and absent from
// a clean checkout — asked of git (trailing-slash probe for directory-only
// patterns), the same way check-md-links.mjs does, rather than hardcoded.
function ignoredSet(paths) {
  const probes = [...new Set(paths.flatMap((p) => [p.replace(/\/$/, ''), `${p.replace(/\/$/, '')}/`]))]
  if (probes.length === 0) return new Set()
  let out = ''
  try {
    out = execSync('git check-ignore --no-index --stdin', { encoding: 'utf8', input: probes.join('\n') })
  } catch (err) {
    if (err.status !== 1) throw err
    out = err.stdout ?? ''
  }
  return new Set(out.split('\n').filter(Boolean).map((p) => p.replace(/\/$/, '')))
}
const absent = findings.filter((r) => !existsSync(`${ROOT}/${r.p}`))
const ignored = ignoredSet(absent.map((r) => r.p))

const missing = []
const seenPairs = new Set()
let pathsChecked = 0

for (const { f, line, p } of findings) {
  if (ignored.has(p.replace(/\/$/, ''))) continue
  pathsChecked++
  const key = `${f}::${p}`
  seenPairs.add(key)
  if (existsSync(`${ROOT}/${p}`)) {
    if (ALLOWED.has(key)) missing.push({ f, line, p, kind: 'EXPIRED', why: ALLOWED.get(key) })
    continue
  }
  if (!ALLOWED.has(key)) missing.push({ f, line, p, kind: 'MISSING' })
}

// An entry whose (file, path) pair no longer occurs is stale whether or not the
// path exists — the first version only reported it when the path was ALSO
// gone, so a rewritten sentence about a path that came back left its
// exemption behind.
const stale = [...ALLOWED.keys()].filter((k) => !seenPairs.has(k))

// ⚠️ FLOORS. Every rule above is a rule about paths this scan FOUND, so all of
// them pass vacuously over a scan that found nothing — a broken regex, a
// `git ls-files` that returns empty in a shallow checkout, a prefix set that
// stops matching. check-md-links.mjs carries a floor for the same reason, and
// docs/internals/web-gates.md records a scan that fell from 47 modules to 20
// and reported ✓. Raise these when the repo grows; never lower them to make a
// change pass.
const FLOOR_PATHS = 530 // ~half of the 1058 read on 2026-10-06, when directories joined the scan
const FLOOR_FILES = 100

console.log(`check-md-paths: ${pathsChecked} backticked repo-rooted paths in ${mdFiles.length} tracked .md files ` +
            `(${ALLOWED.size} allowed, archive exempt)`)

let failed = false

if (pathsChecked < FLOOR_PATHS || mdFiles.length < FLOOR_FILES) {
  failed = true
  console.error(`\n✗ scan floor: saw ${pathsChecked} paths in ${mdFiles.length} files, ` +
                `expected at least ${FLOOR_PATHS} in ${FLOOR_FILES}. The scan is reading ` +
                `less than it should — every other rule here passes vacuously when it does.`)
}
const byKind = (k) => missing.filter((r) => r.kind === k)

if (byKind('MISSING').length) {
  failed = true
  console.error(`\n✗ ${byKind('MISSING').length} path(s) named in prose do not exist:`)
  for (const r of byKind('MISSING')) console.error(`  ${r.f}:${r.line}  ${r.p}`)
  console.error('\n  Retarget the path, fix the sentence, or add it to ALLOWED with a reason.')
}
if (byKind('EXPIRED').length) {
  failed = true
  console.error(`\n✗ ${byKind('EXPIRED').length} allowlist entr(ies) whose path NOW EXISTS — delete them:`)
  for (const r of byKind('EXPIRED')) console.error(`  ${r.f}::${r.p}  (was: ${r.why})`)
}
if (stale.length) {
  failed = true
  console.error(`\n✗ ${stale.length} allowlist entr(ies) no longer occur in that file — delete them:`)
  for (const k of stale) console.error(`  ${k}`)
}

if (failed) process.exit(1)
console.log('✓ every path named in prose exists, or is allowed with a reason')
