/**
 * Small text helpers shared by the gates. One definition each:
 * `check:dupes` scans `scripts/` since 2026-10-07 and fails a second copy.
 */

/**
 * Blank `/* … *\/` comments, keeping every newline so line numbers survive.
 * For CSS, and for any source where a `//` may sit inside a string (a URL).
 */
export const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

/**
 * `stripComments`, plus whole-line `//` comments, positions kept. A trailing
 * `// …` after code is left alone, so `'https://…'` is never cut.
 */
export const stripTsComments = (src) =>
  stripComments(src).replace(/^\s*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '))

/** A canonical without its `|version`. */
export const stripVersion = (canonical) => {
  const pipe = canonical.indexOf('|')
  return pipe === -1 ? canonical : canonical.slice(0, pipe)
}

/** The last path segment of a canonical — `…/StructureDefinition/spier-x` → `spier-x`. */
export const shortCanonical = (canonical) => String(canonical).split('/').pop()
