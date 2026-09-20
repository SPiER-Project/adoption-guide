#!/usr/bin/env node
// D9 (docs/plans/repo-cruft-audit-2026-09-20.md): keeps docs/plans/ from
// re-accumulating the drift #557 cleaned up once — a plan whose own status
// line says the work already shipped, sitting outside docs/plans/archive/
// where nothing tells a reader it is history rather than a live proposal.
// Six plans were exactly that on 2026-09-20 (self-declared IMPLEMENTED/DONE
// or complete-with-a-PR-number, still in the active directory).
//
// Two rules, one gate:
//
//  1. A non-archive docs/plans/*.md file whose own "Status:" line claims the
//     work is IMPLEMENTED, DONE, complete, or MERGED fails — that plan
//     belongs in docs/plans/archive/ instead, with an "> Archived <date>: …"
//     banner (rule 2) taking the "Status:" line's place.
//  2. A docs/plans/archive/*.md file with no "> Archived <date>: …" banner
//     near the top fails — an archived plan with no banner reads, to a future
//     skim, exactly like a live one still open for comment.
//
// ⚠️ Rule 1 is deliberately narrow: it reads only a line that IS a status
// declaration ("Status:" / "**Status:**", nothing else between "Status" and
// the colon), never the whole document. A whole-file scan for these words
// flags ordinary prose as if the entire plan were finished —
// maintainability-audit-2026-09-15.md has a dated addendum reading "§2 is
// complete and merged (#506–#509)" while its PRIMARY Status line says
// "everything else is a recommendation", and tool-bundling-audit-2026-09-19.md
// says two *findings* "WERE implemented in the same PR" while its own axes
// were "an audit and nothing was implemented for them". Neither should
// archive on that wording, and a bare keyword scan cannot tell the difference.
// Word-boundaried so "condone" and "completely" cannot match DONE / COMPLETE
// as substrings.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const PLANS_DIR = join(ROOT, 'docs/plans')
const ARCHIVE_DIR = join(PLANS_DIR, 'archive')

// "Status:" or "**Status:**" at the start of the (trimmed) line, with nothing
// else between "Status" and the colon — excludes a dated/scoped addendum like
// "**Status 2026-09-16 (reskin):**", which describes a sub-section, not the
// whole plan.
const STATUS_LINE_RE = /^\*{0,2}Status:\*{0,2}\s*(.*)$/i
const DONE_WORDS_RE = /\b(?:IMPLEMENTED|DONE|COMPLETE|MERGED)\b/i
const ARCHIVED_BANNER_RE = /^>\s*Archived\s+\d{4}-\d{2}-\d{2}\s*:/

const mdFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.md'))
    .map((d) => d.name)
    .sort()

const planFiles = mdFiles(PLANS_DIR)
const archiveFiles = mdFiles(ARCHIVE_DIR)

const failures = []

for (const name of planFiles) {
  const text = readFileSync(join(PLANS_DIR, name), 'utf8')
  for (const line of text.split('\n')) {
    const m = line.trim().match(STATUS_LINE_RE)
    if (m && DONE_WORDS_RE.test(m[1])) {
      failures.push(
        `docs/plans/${name}: status line claims the work shipped — "${line.trim()}"\n` +
        '    Move it to docs/plans/archive/ with an "> Archived <date>: …" banner instead.',
      )
      break
    }
  }
}

for (const name of archiveFiles) {
  const text = readFileSync(join(ARCHIVE_DIR, name), 'utf8')
  const preamble = text.split('\n').slice(0, 6)
  if (!preamble.some((l) => ARCHIVED_BANNER_RE.test(l.trim()))) {
    failures.push(`docs/plans/archive/${name}: no "> Archived <date>: …" banner in its first 6 lines.`)
  }
}

// A scan that read zero files in either directory passed every rule above
// vacuously — the same floor convention as check-md-paths.mjs's FLOOR_PATHS.
const FLOOR_PLANS = 5
const FLOOR_ARCHIVE = 5
if (planFiles.length < FLOOR_PLANS || archiveFiles.length < FLOOR_ARCHIVE) {
  failures.push(
    `scan floor: saw ${planFiles.length} plan(s) and ${archiveFiles.length} archived plan(s), ` +
    `expected at least ${FLOOR_PLANS} and ${FLOOR_ARCHIVE}. docs/plans/ or docs/plans/archive/ ` +
    'probably moved.',
  )
}

console.log(
  `scanned docs/plans: ${planFiles.length} active plan(s), ${archiveFiles.length} archived plan(s)`,
)

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`)
  console.error(`\n${failures.length} plan-status problem(s).`)
  process.exit(1)
}

console.log('✓ check:plan-status: no un-archived "done" claims, no un-bannered archive entries')
