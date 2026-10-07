// The IG Publisher QA gate's parse — every way it must fail, and the one way
// it must pass.
//
// The fixtures are the real lines from three CI runs on 2026-10-06: 2.3.4
// (clean), 2.3.5 before the heading fix (37 WCAG errors), and 2.3.5 after it
// (19 HTML-checker WARNINGS that the publisher's summary calls broken links).
import { describe, expect, it } from 'vitest'
import { readIgQa } from './ig-qa-counts.mjs'

const qa = (err = 0, warn = 217) =>
  `SPiER : Validation Results\n=====\n\nerr = ${err}, warn = ${warn}, info = 787\n IG Publisher Version: 2.3.4\n /x/a.json : err = 9, warn = 9\n`

const log = ({ files = 4068, invalid = 0, links = 741617, broken = 0, summary = 0 } = {}) =>
  [
    'Checking Output HTML                    (00:04.349 / 02:07.887, 1Gb)',
    `  ... ${files} html files, ${invalid} pages invalid xhtml (0%)     (00:32.890 / 02:40, 2Gb)`,
    `  ... ${links} links, ${broken} broken links (0%)                 (00:00.000 / 02:40, 2Gb)`,
    `Errors: 0, Warnings: 217, Info: 787, Broken Links: ${summary} (00:00.504 / 03:07.776, 2Gb)`,
  ].join('\n')

describe('readIgQa', () => {
  it('passes a clean 2.3.4 run, reading the IG-wide err (not a per-file one)', () => {
    const { counts, problems } = readIgQa(qa(), log())
    expect(problems).toEqual([])
    expect(counts).toMatchObject({ errors: 0, warnings: 217, brokenLinks: 0, invalidXhtml: 0, links: 741617 })
  })

  it('does NOT fail on HTML-checker warnings the summary mislabels as broken links (#1386)', () => {
    const { counts, problems } = readIgQa(qa(), log({ summary: 19 }))
    expect(problems).toEqual([])
    expect(counts.htmlCheckerMessages).toBe(19)
  })

  it('fails on a real broken link', () => {
    expect(readIgQa(qa(), log({ broken: 1 })).problems).toEqual(['1 broken link(s)'])
  })

  it('fails on HTML-checker ERRORS, which the link line never sees (the 37 WCAG pages)', () => {
    const { problems } = readIgQa(qa(), log({ invalid: 37, summary: 56 }))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^37 page\(s\) of invalid xhtml/)
  })

  it('fails on QA errors', () => {
    expect(readIgQa(qa(5), log()).problems).toEqual(['5 QA error(s)'])
  })

  it('reads the LAST pass of the HTML check when the log has several', () => {
    const twice = log({ broken: 0 }) + '\n' + log({ broken: 3 })
    expect(readIgQa(qa(), twice).counts.brokenLinks).toBe(3)
  })

  it.each([
    ['qa.txt has no err line', 'nothing here', log(), /qa\.txt/],
    ['the log has no link line', qa(), log().replace(/links, 0 broken links/, 'x'), /N links, M broken links/],
    ['the log has no html-files line', qa(), log().replace(/pages invalid xhtml/, 'x'), /pages invalid xhtml/],
    ['the HTML check never ran (Jekyll died)', qa(), 'Errors: 0, Warnings: 1, Info: 1, Broken Links: 0', /could not read/],
  ])('refuses an unknown count: %s', (_name, qaTxt, logTxt, re) => {
    const { problems } = readIgQa(qaTxt, logTxt)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(re)
  })

  it.each([
    ['0 html files', { files: 0, links: 0 }],
    ['0 links', { links: 0 }],
  ])('refuses a check that examined nothing: %s', (_name, opts) => {
    expect(readIgQa(qa(), log(opts)).problems.join()).toMatch(/saw nothing/)
  })
})
