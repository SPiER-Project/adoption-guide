/** Read the page's JSON config block. The page and its module are built together, so absence is a bug. */
export function readConfig<T>(): T {
  const node = document.getElementById('spier-page-config')
  if (!node?.textContent) {
    throw new Error('spier-page-config is missing — the page did not render its config block')
  }
  return JSON.parse(node.textContent) as T
}

/** An element the page is known to render. Throws with the id rather than returning null into a later TypeError. */
export function must<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} is missing from the page`)
  return el as T
}

/** One piece of an inline message: plain text, or text to set in `<code>`. */
export type InlinePart = string | { code: string }

/**
 * Render a line of text with some substrings wrapped in `<code>`, without ever
 * building HTML from a string. Every value here (patient/topic ids, SMART
 * intents) is fixture or crypto.randomUUID() data today, but a concatenated
 * innerHTML is one refactor away from reflected markup injection — and that
 * refactor was invisible while this lived inside a template literal.
 */
export function renderInline(target: HTMLElement, parts: InlinePart[]): void {
  target.replaceChildren()
  for (const part of parts) {
    if (typeof part === 'object') {
      const code = document.createElement('code')
      code.textContent = part.code
      target.appendChild(code)
    } else {
      target.appendChild(document.createTextNode(part))
    }
  }
}
