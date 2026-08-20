/**
 * hostChrome — the few things every page of this mock's UI shares: the brand
 * palette, an HTML escaper, and the page frame (head + a breadcrumb bar).
 *
 * Extracted when step 5 added a second and third page. The palette had one
 * definition in `controlPage.ts`; three copies of two hex values is exactly the
 * hand-duplicated drift `CLAUDE.md` warns about, and it is cheaper to fix now
 * than to grep for later.
 *
 * ⚠️ **This is not the app's design system, and must not pretend to be.** The
 * SPiER app enforces design tokens through stylelint (`web/.stylelintrc.json`)
 * and raw hex is rejected there. These pages are a *host* — a stand-in for
 * someone else's EHR — served as self-contained strings from a Worker with no
 * stylesheet, no build step and no token file. Matching the app's palette makes
 * the screenshot legible; matching its architecture would be pretending the
 * host is part of the product.
 */

/** thespierproject.org brand plum / raspberry (project_spier_official_brand). */
export const PLUM = '#341528'
export const RASPBERRY = '#cc3366'
/** Body copy and rules, tinted toward the plum rather than neutral grey. */
export const INK = '#5c4a54'
export const RULE = '#d8cdd4'
export const TINT = '#f3eef1'
export const TINT_WARM = '#fdf5f8'

/**
 * Escape text interpolated into HTML.
 *
 * Every value these pages render comes from the repo's own fixtures, so this is
 * not guarding against an attacker today. It guards against the day a scenario
 * grows a name with an apostrophe and the page silently breaks — and against
 * this file being read as an example of how to build the real thing.
 */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** CSS shared by every page here. Page-specific rules are appended per page. */
export const BASE_CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 1.5rem; color: ${PLUM}; background: #fff; }
  a { color: ${RASPBERRY}; }
  h1 { font-size: 1.4rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.05rem; margin: 2rem 0 .5rem; }
  p.lede { margin: 0 0 1.5rem; color: ${INK}; }
  code { background: ${TINT}; padding: .1em .35em; border-radius: 3px; font-size: .9em; }
  .crumbs { display: flex; gap: .4rem; align-items: baseline; font-size: .85rem; color: ${INK}; margin: 0 0 1rem; }
  .crumbs a { text-decoration: none; }
  .crumbs span[aria-hidden] { color: ${RULE}; }
  .warn { margin-top: 2rem; padding: .75rem 1rem; border-left: 3px solid ${RASPBERRY}; background: ${TINT_WARM}; font-size: .9rem; }
`

/**
 * The page frame. `bodyClass` is only used by the chart page, which needs a
 * wider column than the prose pages.
 */
export function page({
  title,
  css = '',
  body,
  script = '',
  bodyClass = '',
}: {
  title: string
  css?: string
  body: string
  script?: string
  bodyClass?: string
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${BASE_CSS}${css}</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${body}
${script ? `<script>${script}</script>` : ''}
</body>
</html>`
}

/** A breadcrumb trail. The last entry is the current page and is not a link. */
export function crumbs(trail: Array<{ label: string; href?: string }>): string {
  return `<nav class="crumbs">${trail
    .map((c, i) => {
      const sep = i > 0 ? '<span aria-hidden="true">/</span>' : ''
      return c.href
        ? `${sep}<a href="${esc(c.href)}">${esc(c.label)}</a>`
        : `${sep}<strong>${esc(c.label)}</strong>`
    })
    .join('')}</nav>`
}

/**
 * The standing disclaimer. Every page carries it because every page of this
 * server is capable of being screenshotted on its own.
 *
 * Not boilerplate: this host is controlled by the same project it demonstrates,
 * so nothing observed here is evidence of interoperability. The panel plan's §8
 * guardrails make saying so a binding condition rather than good manners.
 */
export const DISCLAIMER = `
  <p class="warn">
    <strong>Demonstration host only.</strong> This is not a real EHR and holds only synthetic patients.
    It is controlled by the same project it demonstrates, so nothing observed here is evidence of
    interoperability — that claim is only made against a public sandbox.
  </p>`
