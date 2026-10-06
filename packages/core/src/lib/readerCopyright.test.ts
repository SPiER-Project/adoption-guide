import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TOOLS } from '../data/catalog'
import { readerCopyright } from './readerCopyright'

/**
 * Over EVERY ActivityDefinition the IG publishes, not a sample: the transform is
 * a set of rewrites over a statement nobody here may edit, and the failure it
 * guards against is a new sentence shape that slips a path through.
 */
const GENERATED = fileURLToPath(new URL('../../../fhir-artifacts/generated/', import.meta.url))
const AD_COPYRIGHTS: { id: string; copyright: string }[] = readdirSync(GENERATED)
  .filter((f) => f.startsWith('ActivityDefinition-') && f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(GENERATED + f, 'utf8')) as { id: string; copyright?: string })
  .filter((ad): ad is { id: string; copyright: string } => typeof ad.copyright === 'string')

/** What a reader with no checkout must not meet. */
const REPO_PATH = /\b(?:docs|ig|apps|packages|scripts|services)\/[\w./-]+/
const ISSUE = /#\d{2,4}\b/
const MARKDOWN = /\*\*|(^|[\s(])\*\S|\S\*(?=[\s).,;:]|$)|`/
const ISO_DATE = /\b20\d\d-\d\d-\d\d\b/
const MEMO_FILE = /\bMEMO\.md\b|\.md\b/

describe('readerCopyright', () => {
  it('reads every published ActivityDefinition', () => {
    // Liveness: 43 today. A generated tree that stopped being read would make
    // every assertion below vacuous.
    expect(AD_COPYRIGHTS.length).toBeGreaterThan(30)
  })

  it.each(AD_COPYRIGHTS)('$id reads as plain text with no repo reference', ({ copyright }) => {
    const out = readerCopyright(copyright)
    expect(out).not.toMatch(REPO_PATH)
    expect(out).not.toMatch(ISSUE)
    expect(out).not.toMatch(MARKDOWN)
    expect(out).not.toMatch(ISO_DATE)
    expect(out).not.toMatch(MEMO_FILE)
    expect(out).not.toMatch(/\s{2,}/)
    // Nothing is lost that was not a reference: the reader's version is at most
    // the original, and never empty.
    expect(out.length).toBeGreaterThan(40)
    expect(out.length).toBeLessThanOrEqual(copyright.length)
  })

  it('covers every tool the catalogue renders a notice for', () => {
    const fromTools = TOOLS.map((t) => t.copyright).filter((c): c is string => !!c)
    expect(fromTools.length).toBeGreaterThan(10)
    for (const c of fromTools) expect(AD_COPYRIGHTS.map((a) => a.copyright)).toContain(c)
  })

  /**
   * The caveats are the point of the notice. Each phrase below is in the
   * published text and must survive the rewrite in every notice that has it.
   */
  it.each([
    'not been verified',
    'NO-GO',
    'commercial instrument',
    'Do NOT read this as free reuse',
    'Written permission from the authors is required',
    'still to be filed',
    'must obtain its own',
    'does NOT transfer',
    'maintainer',
    'UNKNOWN',
  ])('keeps "%s" wherever the published notice says it', (phrase) => {
    const carrying = AD_COPYRIGHTS.filter((a) => a.copyright.includes(phrase))
    expect(carrying.length, `no published notice says "${phrase}" — update this list`).toBeGreaterThan(0)
    for (const { id, copyright } of carrying) {
      expect(readerCopyright(copyright), id).toContain(phrase)
    }
  })

  it('rewrites the shapes it was written from', () => {
    expect(
      readerCopyright(
        'No permission required. Basis: the notice recorded on the SPiER PHQ-9 Questionnaire (ig/input/resources/questionnaires/PHQ-9/). ' +
          'No licensing-audit memo is on file for the PHQ-9 under issue #64, so this notice has not been verified against the publisher\'s current terms.',
      ),
    ).toBe(
      'No permission required. Basis: the notice recorded on the SPiER PHQ-9 Questionnaire. ' +
        'No licensing-audit memo is on file for the PHQ-9, so this notice has not been verified against the publisher\'s current terms.',
    )
    expect(readerCopyright('Free. Basis: docs/instruments/X/licensing/MEMO.md (issue #64). Open items recorded there: a letter.')).toBe(
      'Free. Open items: a letter.',
    )
    expect(readerCopyright('Free. Basis: docs/instruments/X/licensing/MEMO.md (issue #64), maintainer-confirmed 2026-07-15.')).toBe(
      'Free. Recorded in the SPiER licensing audit: maintainer-confirmed in July 2026.',
    )
    expect(readerCopyright('A **commercial instrument** in *Psychological Assessment*.')).toBe(
      'A commercial instrument in Psychological Assessment.',
    )
  })
})
