#!/usr/bin/env node
// The IG Publisher QA gate: read the counts out of a finished run and fail on
// any error, any broken link, or any page of invalid XHTML. ONE definition,
// consumed by ig-publish.yml at PR time and deploy.yml on the deploy path —
// both used to carry the same inline bash, with nothing comparing them.
//
// ─── Why it does not read "Broken Links: N" (2026-10-06) ───────────────────
//
// The publisher's closing summary line, "Errors: 5, … Broken Links: 56", is not
// a count of broken links. It counts every message whose source is the HTML
// checker, at ANY level (ValidationPresenter: `Source.HtmlChecker → link++`).
// On 2.3.4 that happened to agree with the link check. On 2.3.5 it took in
// warnings on pages SPiER does not write — the template's searchform.html, and
// duplicate FHIRHelpers anchors the publisher renders on every Measure page —
// and reported 19 "broken links" on a build whose link check said:
//
//     ... 719350 links, 0 broken links (0%)
//
// (HL7/fhir-ig-publisher#1386.) So this gate reads the HTML check's own two
// lines instead:
//
//     ... 4070 html files, 37 pages invalid xhtml (0%)
//     ... 717293 links, 0 broken links (0%)
//
// ⚠️ BOTH lines, never only the link line. The HTML checker's ERROR-level
// findings — 2.3.5's WCAG heading errors, malformed markup we authored — show
// up in "pages invalid xhtml", not in the link count. Reading the link line
// alone would have passed the run that had 37 WCAG errors. Warnings fail
// neither line; they are still in qa.html.
//
// ⚠️ A run that checked NOTHING must not read as zero broken links. Jekyll
// failing, or the check being skipped, leaves the lines out or reports 0 files
// — so a missing line is a failure, and so is 0 html files or 0 links.
//
// The summary's figure is still printed, labelled for what it is.

import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The last match of `re` in `text`, as an array of integers, or null. */
function lastInts(text, re) {
  let m
  let last = null
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  while ((m = g.exec(text)) !== null) last = m
  return last ? last.slice(1).map(Number) : null
}

/**
 * @param {string} qaTxt contents of output/qa.txt
 * @param {string} log contents of publisher.log
 * @returns {{ counts: object, problems: string[] }} `problems` is empty only
 *   when every count was read AND every gated count is zero.
 */
export function readIgQa(qaTxt, log) {
  // qa.txt: the FIRST "err = N, warn = M, info = K" is the IG-wide total; later
  // lines are per-file. The log: the LAST occurrence of each line is the final
  // pass.
  const [errors] = qaTxt.match(/err\s*=\s*(\d+)/i)?.slice(1).map(Number) ?? []
  const [warnings] = qaTxt.match(/warn\s*=\s*(\d+)/i)?.slice(1).map(Number) ?? []
  const [htmlFiles, invalidXhtml] = lastInts(log, /(\d+) html files, (\d+) pages invalid xhtml/) ?? []
  const [links, brokenLinks] = lastInts(log, /(\d+) links, (\d+) broken links/) ?? []
  const [htmlCheckerMessages] = lastInts(log, /Broken Links:\s*(\d+)/i) ?? []

  const counts = { errors, warnings, htmlFiles, invalidXhtml, links, brokenLinks, htmlCheckerMessages }
  const problems = []

  const unread = []
  if (errors === undefined) unread.push("qa.txt's `err = N`")
  if (htmlFiles === undefined) unread.push("the log's `N html files, K pages invalid xhtml`")
  if (links === undefined) unread.push("the log's `N links, M broken links`")
  if (unread.length) {
    problems.push(`could not read ${unread.join(', ')} — the publisher's output format may have changed, or the HTML check never ran. Refusing to pass on an unknown count.`)
    return { counts, problems }
  }
  if (htmlFiles === 0 || links === 0) {
    problems.push(`the HTML check examined ${htmlFiles} html file(s) and ${links} link(s) — a check that saw nothing proves nothing`)
  }
  if (errors !== 0) problems.push(`${errors} QA error(s)`)
  if (brokenLinks !== 0) problems.push(`${brokenLinks} broken link(s)`)
  if (invalidXhtml !== 0) problems.push(`${invalidXhtml} page(s) of invalid xhtml (HTML-checker errors, e.g. WCAG heading structure)`)
  return { counts, problems }
}

// CLI: `node scripts/lib/ig-qa-counts.mjs [igDir]` — reads <igDir>/output/qa.txt
// and <igDir>/publisher.log, prints the counts, appends a table to
// $GITHUB_STEP_SUMMARY when set, and exits 1 with ::error:: lines on failure.
//
// ⚠️ `fileURLToPath`, not a string compare against process.argv[1] — this
// checkout's path has a space in it; see ig-publisher-release.mjs.
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  const dir = process.argv[2] ?? '.'
  const qaPath = resolve(dir, 'output/qa.txt')
  const logPath = resolve(dir, 'publisher.log')
  for (const p of [qaPath, logPath]) {
    if (!existsSync(p)) {
      console.error(`::error::no ${p} — the IG Publisher did not complete`)
      process.exit(1)
    }
  }
  // latin1: the log can carry bytes that are not UTF-8 (#512); the lines read
  // here are ASCII either way.
  const { counts: c, problems } = readIgQa(readFileSync(qaPath, 'latin1'), readFileSync(logPath, 'latin1'))
  const show = (v) => (v === undefined ? 'unparsed' : v)
  console.log(
    `QA → errors=${show(c.errors)} warnings=${show(c.warnings)} brokenLinks=${show(c.brokenLinks)}/${show(c.links)} ` +
      `invalidXhtml=${show(c.invalidXhtml)}/${show(c.htmlFiles)} htmlCheckerMessages=${show(c.htmlCheckerMessages)}`,
  )
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '### IG Publisher QA',
        '',
        '| Errors | Warnings | Broken links | Invalid xhtml pages | HTML-checker messages (incl. warnings) |',
        '|---|---|---|---|---|',
        `| ${show(c.errors)} | ${show(c.warnings)} | ${show(c.brokenLinks)} of ${show(c.links)} | ${show(c.invalidXhtml)} of ${show(c.htmlFiles)} | ${show(c.htmlCheckerMessages)} |`,
        '',
        'The last column is the publisher\'s own "Broken Links" figure, which counts HTML-checker warnings too; it is reported, not gated.',
        'Full report (`qa.html`) is in the **ig-site** artifact.',
        '',
      ].join('\n'),
    )
  }
  for (const p of problems) console.error(`::error::IG Publisher QA: ${p}`)
  process.exit(problems.length ? 1 : 0)
}
