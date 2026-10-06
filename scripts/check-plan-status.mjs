#!/usr/bin/env node
// D9 (docs/plans/archive/repo-cruft-audit-2026-09-20.md): keeps docs/plans/ from
// re-accumulating the drift #557 cleaned up once — a plan whose own status
// line says the work already shipped, sitting outside docs/plans/archive/
// where nothing tells a reader it is history rather than a live proposal.
// Six plans were exactly that on 2026-09-20 (self-declared IMPLEMENTED/DONE
// or complete-with-a-PR-number, still in the active directory).
//
// Two rules, one gate:
//
//  1. A non-archive plan (any depth under docs/plans/, outside archive/) whose
//     own STATUS declaration says the work shipped fails — that plan belongs
//     in docs/plans/archive/ instead, with an "> Archived <date>: …" banner
//     (rule 2) taking the status's place.
//  2. A docs/plans/archive/**.md file with no "> Archived <date>: …" banner
//     near the top fails — an archived plan with no banner reads, to a future
//     skim, exactly like a live one still open for comment.
//
// ⚠️ Rule 1 is deliberately narrow: it reads only a STATUS DECLARATION, never
// the whole document. A whole-file scan for these words flags ordinary prose
// as if the entire plan were finished — maintainability-audit-2026-09-15.md
// has a dated addendum reading "§2 is complete and merged (#506–#509)" while
// its PRIMARY status says "everything else is a recommendation", and
// tool-bundling-audit-2026-09-19.md says two *findings* "WERE implemented in
// the same PR" while its own axes were "an audit and nothing was implemented
// for them". Neither should archive on that wording, and a bare keyword scan
// cannot tell the difference. A dated or scoped addendum ("**Status 2026-09-16
// (reskin):**") is a sub-section's status, not the plan's, and is not read.
//
// ⚠️ What counts as a status declaration — every form a live plan has used:
//   - a `Status:` / `**Status:**` line, also inside a blockquote (`> `) or a
//     list item (`- `), or as a `## Status: …` heading;
//   - the inline header form `**Date:** … · **Status:** …`;
//   - a `## Status` heading over a TABLE: the plan shipped when EVERY row's
//     last cell says so (one open row keeps it live); over prose, its first
//     paragraph is the status.
// The first version read only the bare `**Status:**` line and the words
// IMPLEMENTED/DONE/COMPLETE/MERGED, so `**Status:** all seven PRs have
// shipped.` passed for two weeks on clinical-app-ux-audit-2026-09-21.md
// (found by the 2026-10-06 gates audit).
//
// A status that also names OPEN work ("merged except §4", "not yet merged",
// "PR open") is not a shipped claim — the qualifier list below is what keeps
// a partly-done plan in the active directory. Word-boundaried throughout, so
// "condone" and "completely" cannot match DONE / COMPLETE as substrings.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const PLANS_DIR = join(ROOT, 'docs/plans')
const ARCHIVE_DIR = join(PLANS_DIR, 'archive')

const STATUS_PREFIX = String.raw`\*{0,2}Status:\*{0,2}\s*(.*)$`
// A line that IS a status declaration, after a blockquote/list/heading marker.
const STATUS_LINE_RE = new RegExp(String.raw`^(?:>\s*)*(?:[-*+]\s+)?(?:#{1,6}\s+)?${STATUS_PREFIX}`, 'i')
// The inline header form: `**Date:** … · **Status:** …`.
const STATUS_INLINE_RE = new RegExp(String.raw`·\s*${STATUS_PREFIX}`, 'i')
// A bare `## Status` heading, whose body is the status.
const STATUS_HEADING_RE = /^#{1,6}\s+Status\s*$/i
const DONE_WORDS_RE = /\b(?:IMPLEMENTED|DONE|COMPLETED?|MERGED|SHIPPED|LANDED|FINISHED)\b/i
const OPEN_WORDS_RE =
  /\b(?:not|open|pending|in progress|remaining|partial(?:ly)?|draft|proposed|todo|blocked|except|next|unbuilt|unmerged|outstanding|deferred|superseded)\b/i
const ARCHIVED_BANNER_RE = /^>\s*Archived\s+\d{4}-\d{2}-\d{2}\s*:/

const shipped = (text) => DONE_WORDS_RE.test(text) && !OPEN_WORDS_RE.test(text)
/** A table state's lead clause — up to the first dash, semicolon, colon or full stop. */
const lead = (state) => state.replace(/\*\*/g, '').split(/\s[—–-]\s|[;:.(]/)[0].slice(0, 80)

/** Every .md under `dir`, recursively, optionally skipping one subtree. */
function mdFiles(dir, skip) {
  const out = []
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name)
    if (d.isDirectory()) {
      if (p !== skip) out.push(...mdFiles(p, skip))
    } else if (d.isFile() && d.name.endsWith('.md')) {
      out.push(p)
    }
  }
  return out.sort()
}

/** Split a markdown table row into its cells. */
const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())

/**
 * The plan's own status claims, as `{ form, text, shipped }`. Never the body
 * prose — see the header.
 */
function statusClaims(text) {
  const lines = text.split('\n')
  const claims = []
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (/^(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) continue

    const direct = STATUS_LINE_RE.exec(line)
    if (direct) {
      claims.push({ form: 'status line', line: i + 1, text: direct[1], shipped: shipped(direct[1]) })
      continue
    }
    const inline = STATUS_INLINE_RE.exec(line)
    if (inline) {
      claims.push({ form: 'inline status', line: i + 1, text: inline[1], shipped: shipped(inline[1]) })
      continue
    }
    if (!STATUS_HEADING_RE.test(line)) continue

    // `## Status` — read its body up to the next heading.
    const body = []
    for (let j = i + 1; j < lines.length && !/^#{1,6}\s/.test(lines[j].trim()); j++) body.push(lines[j].trim())
    const rows = body.filter((l) => l.startsWith('|'))
    if (rows.length >= 3) {
      // Header, separator, then data rows; the LAST cell is the state.
      // Each state is judged on its LEAD clause ("done, #512 — …"), not the
      // whole cell: a done row's detail routinely says "not" or "next" about
      // something else, and a whole-cell reading makes a finished table look
      // open. A row is DONE, OPEN, or neither (a decision, a note); the table
      // says the plan shipped when no row is open and at least one is done.
      const data = rows.slice(2).filter((r) => !/^\|?\s*:?-{3,}/.test(r))
      const leads = data.map((r) => lead(cells(r).at(-1) ?? ''))
      const open = leads.filter((l) => OPEN_WORDS_RE.test(l)).length
      const done = leads.filter((l) => !OPEN_WORDS_RE.test(l) && DONE_WORDS_RE.test(l)).length
      claims.push({
        form: 'status table',
        line: i + 1,
        text: `${done} done, ${open} open, ${leads.length - done - open} other of ${leads.length} rows`,
        shipped: open === 0 && done > 0,
      })
    } else {
      const para = []
      for (const l of body) {
        if (l === '' && para.length) break
        if (l !== '') para.push(l)
      }
      const t = para.join(' ')
      claims.push({ form: 'status section', line: i + 1, text: t, shipped: shipped(t) })
    }
  }
  return claims
}

const planFiles = mdFiles(PLANS_DIR, ARCHIVE_DIR)
const archiveFiles = mdFiles(ARCHIVE_DIR)
const rel = (p) => relative(ROOT, p)

const failures = []
let claimsRead = 0

for (const file of planFiles) {
  const claims = statusClaims(readFileSync(file, 'utf8'))
  claimsRead += claims.length
  // The plan's PRIMARY status is the first declaration in the file.
  const primary = claims[0]
  if (primary?.shipped) {
    failures.push(
      `${rel(file)}:${primary.line}: ${primary.form} claims the work shipped — "${primary.text.slice(0, 120)}"\n` +
        '    Move it to docs/plans/archive/ with an "> Archived <date>: …" banner instead.',
    )
  }
}

for (const file of archiveFiles) {
  const preamble = readFileSync(file, 'utf8').split('\n').slice(0, 6)
  if (!preamble.some((l) => ARCHIVED_BANNER_RE.test(l.trim()))) {
    failures.push(`${rel(file)}: no "> Archived <date>: …" banner in its first 6 lines.`)
  }
}

// A scan that read zero files in either directory passed every rule above
// vacuously — the same floor convention as check-md-paths.mjs's FLOOR_PATHS.
// The claims floor is the same idea one level down: a status reader that
// matches nothing would pass every plan.
const FLOOR_PLANS = 5
const FLOOR_ARCHIVE = 5
const FLOOR_CLAIMS = 5
if (planFiles.length < FLOOR_PLANS || archiveFiles.length < FLOOR_ARCHIVE || claimsRead < FLOOR_CLAIMS) {
  failures.push(
    `scan floor: saw ${planFiles.length} plan(s), ${archiveFiles.length} archived plan(s) and ` +
      `${claimsRead} status declaration(s), expected at least ${FLOOR_PLANS}, ${FLOOR_ARCHIVE} and ` +
      `${FLOOR_CLAIMS}. docs/plans/ moved, or the status reader stopped matching.`,
  )
}

console.log(
  `scanned docs/plans: ${planFiles.length} active plan(s) (${claimsRead} status declaration(s)), ` +
    `${archiveFiles.length} archived plan(s)`,
)

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`)
  console.error(`\n${failures.length} plan-status problem(s).`)
  process.exit(1)
}

console.log('✓ check:plan-status: no un-archived "done" claims, no un-bannered archive entries')
