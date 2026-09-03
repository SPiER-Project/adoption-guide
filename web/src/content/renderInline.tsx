/**
 * The renderer for the content modules' inline-markup convention.
 *
 * Lives beside the content it renders, and in its own file because eslint's
 * `react-refresh/only-export-components` (correctly) refuses a non-component
 * export from a component file.
 *
 * The convention is five rules and no more — see the header of
 * `content/overview.ts` for why, and for how to write against it:
 *
 *   **bold**          → <strong>
 *   *italic*          → <em>
 *   `code`            → <code>
 *   [text](/route)    → in-app <Link> (any href starting with "/")
 *   [text](ig)        → the published IG, opened in a new tab
 *
 * Everything that is not markup is emitted verbatim, so prose keeps its real
 * em-dashes, arrows and curly quotes rather than HTML entities.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// The published HL7 IG is a sibling static site (web/dist/ig/), not a hash
// route — see the note on IG_HREF in AppShell.tsx for how the base resolves.
export const IG_HREF = `${import.meta.env.BASE_URL}ig/`

/**
 * The content modules' `href` convention: an in-app route starts with "/", and
 * the literal `ig` means the published Implementation Guide. Kept as a token
 * rather than a URL in the content, because IG_HREF is computed from
 * `import.meta.env.BASE_URL` and differs between hosts.
 */
export const IG_TOKEN = 'ig'

// One regex, one pass, alternation ordered longest-first so `**bold**` is not
// mistaken for two `*italic*` runs. Reversing those two branches fails five
// tests in Overview.renderInline.test.tsx — verified, not assumed.
const INLINE = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  // Defensive: the loop below runs to exhaustion, which already resets
  // `lastIndex` on this module-level /g regex. It matters only if someone adds
  // an early `break` — and no test would catch that, so leave it in place.
  INLINE.lastIndex = 0

  for (let m = INLINE.exec(text); m !== null; m = INLINE.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const [, linkText, href, bold, italic, code] = m

    if (linkText !== undefined && href !== undefined) {
      if (href === IG_TOKEN) {
        out.push(
          <a key={key++} href={IG_HREF} target="_blank" rel="noopener noreferrer">
            {linkText}
          </a>,
        )
      } else {
        out.push(
          <Link key={key++} to={href}>
            {linkText}
          </Link>,
        )
      }
    } else if (bold !== undefined) {
      out.push(<strong key={key++}>{bold}</strong>)
    } else if (italic !== undefined) {
      out.push(<em key={key++}>{italic}</em>)
    } else if (code !== undefined) {
      out.push(<code key={key++}>{code}</code>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
