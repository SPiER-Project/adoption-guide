/**
 * Blank the comments out of a `.tsx` source before scanning it for code.
 *
 * ── The defect this exists for ──────────────────────────────────────────────
 *
 * This repo has **two** hand-rolled `<Route>` scanners — `check-ig-narrative.mjs`
 * (which app links an IG page may point at) and `web/scripts/lib/route-table.mjs`
 * (which navigation targets resolve). Both searched the raw file for `<Route`.
 *
 * Then a comment was added to `App.tsx` quoting the shape a route must be
 * declared in:
 *
 *     {@literal /}* Declared in this exact `<Route path="x" element={<Comp /​>}>`
 *        form on purpose … *{@literal /}
 *
 * Both scanners read that as a real, **unclosed** `<Route>`, pushed `/guide/x`
 * onto their nesting stack, and never popped it. Every guide route after the
 * comment was registered as `/guide/x/tools`, `/guide/x/adoption-readiness` and
 * so on — eleven phantom paths, and eleven real ones missing.
 *
 * ⚠️ **The two gates failed in opposite directions, which is why this is a
 * shared module rather than a fix in one of them.** The IG gate reported a
 * genuine live route (`/guide/adoption-readiness`) as a dead link — a loud false
 * positive on an unrelated file. `route-table.mjs` reported nothing at all,
 * because no catalog launch path happens to target a `/guide/*` route: it went on
 * passing while its table was wrong. A gate that lies quietly is the worse of
 * the two, and neither scanner's "did I parse anything?" bail could see it —
 * both parsed plenty, just wrongly.
 *
 * Offsets are preserved: comment bodies become spaces and newlines stay
 * newlines, so a scanner's error message can still name a real position in the
 * original file.
 *
 * String state is tracked, so a `//` inside a string literal (a URL, say) is not
 * mistaken for the start of a comment.
 */

/**
 * @param {string} src TypeScript/TSX source.
 * @returns {string} the same source, same length, with comment bodies blanked.
 */
export function stripComments(src) {
  const out = Array.from(src)
  /** @type {'"' | "'" | '`' | null} */
  let quote = null
  let i = 0

  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== '\n') out[k] = ' '
    }
  }

  while (i < src.length) {
    const c = src[i]

    if (quote) {
      // A backslash escapes the next character, including a closing quote.
      if (c === '\\') { i += 2; continue }
      if (c === quote) quote = null
      i++
      continue
    }

    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue }

    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i)
      blank(i, end === -1 ? src.length : end)
      i = end === -1 ? src.length : end
      continue
    }

    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      blank(i, stop)
      i = stop
      continue
    }

    i++
  }

  return out.join('')
}
