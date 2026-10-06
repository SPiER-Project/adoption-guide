/**
 * An ActivityDefinition's `copyright`, as a reader of the Adoption Guide sees it.
 *
 * `Tool.copyright` is `ActivityDefinition.copyright` verbatim, and that text is
 * the PUBLISHED licensing statement: it is written for the IG, where citing the
 * licensing-audit memo by its path in this repository and the issue that
 * tracks it is provenance. The guide's reader has no checkout. Rendered as-is
 * on a tool's page it showed `docs/instruments/ASQ/licensing/MEMO.md`,
 * `(issue #64)` and markdown asterisks, in a paragraph that is otherwise the
 * most careful prose on the page.
 *
 * So the FSH keeps its text, and the guide renders this instead:
 *
 *   - plain text: `**x**`, `*x*` and backticked code lose their markers and keep their words;
 *   - no repo references: a "Basis: <repo path> (issue #N)." sentence is
 *     removed; a basis that also says something (a maintainer's confirmation
 *     and when) keeps that, minus the path; a parenthetical repo path and an
 *     "(issue #N)" / "under issue #N" are dropped from the sentence they are in,
 *     and the rest of the sentence stands — "No licensing-audit memo is on file
 *     for the PHQ-9, so this notice has not been verified…" keeps its caveat;
 *   - a sentence that pointed BACK at the removed basis ("Open items recorded
 *     there: …") is reworded to stand alone ("Open items: …");
 *   - an ISO date becomes a month and year, which is what a reader needs and
 *     is not a repo date.
 *
 * Pure and React-free. `readerCopyright.test.ts` runs it over every
 * ActivityDefinition the IG publishes and holds the caveats that must survive;
 * check:jargon scans its OUTPUT, and the guide's rendered-copy test fails if a
 * page renders the raw string again.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** A path into this repository — the trees a citation in the FSH points at. */
const REPO_PATH = String.raw`(?:docs|ig|apps|packages|scripts|services)\/[^\s,()]+`

/** `[on ]2026-07-15` → `in July 2026`. */
function humanizeDates(text: string): string {
  return text.replace(/\b(?:on )?(\d{4})-(\d{2})-\d{2}\b/g, (_m, y: string, mo: string) => {
    const month = MONTHS[Number(mo) - 1] ?? mo
    return `in ${month} ${y}`
  })
}

export function readerCopyright(text: string): string {
  let out = text
    // Markdown emphasis, strong first so its markers are not read as two emphases.
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:]|$)/g, '$1$2')
    // Inline code (`registration`), which renders as backticks in a <p>.
    .replace(/`([^`]+)`/g, '$1')

  // "Basis: <repo path> (issue #N)<tail>." — the sentence goes; a tail that
  // says something more than where the memo is stays, with the path gone.
  out = out.replace(
    new RegExp(String.raw`\s*Basis: ${REPO_PATH}(?:\s*\(issue #\d+\))?([^.]*)\.`, 'g'),
    (_m, tail: string) => {
      const rest = tail.replace(/^,\s*/, '').trim()
      if (!rest) return ''
      const said = rest.replace(/^which records /, '')
      return ` Recorded in the SPiER licensing audit: ${humanizeDates(said)}.`
    },
  )

  out = out
    // A repo path in parentheses, after a basis that is NOT a path ("the notice
    // recorded on the SPiER PHQ-9 Questionnaire (ig/input/…/PHQ-9/)").
    .replace(new RegExp(String.raw`\s*\(${REPO_PATH}\)`, 'g'), '')
    // The tracking issue, wherever the sentence mentions it.
    .replace(/\s*\(issue #\d+\)/g, '')
    .replace(/ under issue #\d+/g, '')
    .replace(/\bthe issue #\d+ audit\b/g, 'the licensing audit')
    // A sentence that pointed back at the memo just removed.
    .replace(/\bOpen (items?) recorded there:/g, 'Open $1:')
    .replace(/ in-repo\b/g, '')

  return humanizeDates(out).replace(/\s{2,}/g, ' ').trim()
}
