/**
 * The chart's problem list, kept current while the panel is open.
 *
 * The page renders the Problems section from what the server serves at load
 * (chartRecord.ts). A CAMS driver the clinician saves in the panel — or
 * resolves at the disposition session — lands on this server a moment later,
 * and until 2026-10-12 the chart showed it only after a reload. That reload
 * also reloads the panel's frame, which is the one thing a presenter mid-flow
 * cannot afford. So `chart.ts` polls `/_admin/problems` on the cadence it
 * already polls the write log, and this module patches the section in place.
 *
 * ⚠️ **Built from nodes, never from an HTML string** — the rule `renderInline`
 * in config.ts exists for. Every value is the server's own derivation of a
 * resource the panel wrote, which is exactly the reasoning that stops being
 * true one refactor later.
 *
 * ⚠️ **Placement mirrors the server's empty-column rule.** The page drops an
 * empty section, an empty column and an empty chart body (chartPage.ts), so the
 * first problem on a chart may have nowhere to go. It goes first in the side
 * column, building that column — or the chart body under `#chart-body-anchor` —
 * when the page had none. A problem list that empties again (a reset in
 * Settings) takes the section away, and the column with it if nothing else is
 * left in it.
 */
import type { ProblemLine } from './types'

const SECTION_ID = 'sect-problems'
const TONES = new Set(['critical', 'warning', 'notice', 'info'])

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** The section, exactly as `chartSection` in chartPage.ts renders it. */
function problemSection(problems: ProblemLine[]): HTMLElement {
  const section = el('section', 'sect')
  section.setAttribute('aria-labelledby', SECTION_ID)
  const title = el('h3', 'sect__title', 'Problems')
  title.id = SECTION_ID
  const list = el('ul', 'sect__list')
  for (const problem of problems) {
    const item = el('li', 'entry')
    const text = el('div', 'entry__text')
    text.append(el('p', 'entry__title', problem.title))
    if (problem.detail) text.append(el('p', 'entry__detail', problem.detail))
    item.append(text, el('span', 'entry__when', problem.when))
    if (problem.status) {
      // The tone becomes a class name, so it is held to the four the stylesheet
      // defines rather than trusted as a string.
      const tone = TONES.has(problem.tone) ? problem.tone : 'info'
      item.append(el('span', `entry__status entry__status--${tone}`, problem.status))
    }
    list.append(item)
  }
  section.append(title, list)
  return section
}

/** Keep `--single` true to the number of columns actually present. */
function syncColumnCount(cols: Element): void {
  cols.classList.toggle('chart-body__cols--single', cols.children.length === 1)
}

/** Where a new Problems section goes: first in the side column, made if missing. */
function sideColumn(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('.chart-body__col[data-col="side"]')
  if (existing) return existing

  let cols = document.querySelector<HTMLElement>('.chart-body__cols')
  if (!cols) {
    const body = el('div', 'chart-body')
    cols = el('div', 'chart-body__cols')
    body.append(cols)
    const anchor = document.getElementById('chart-body-anchor')
    if (!anchor) throw new Error('#chart-body-anchor is missing from the page')
    anchor.append(body)
  }
  const side = el('div', 'chart-body__col')
  side.dataset.col = 'side'
  cols.append(side)
  syncColumnCount(cols)
  return side
}

/** Take away a column, and the chart body, that no longer hold anything. */
function pruneEmpty(column: Element | null): void {
  if (!column || column.children.length > 0) return
  const cols = column.parentElement
  column.remove()
  if (!cols) return
  if (cols.children.length === 0) cols.closest('.chart-body')?.remove()
  else syncColumnCount(cols)
}

/**
 * Bring the Problems section in line with `problems`.
 *
 * Returns whether the page changed, so a caller polling every few seconds can
 * see that most polls do nothing — the section is replaced only when the list
 * differs, which keeps a screen reader from re-announcing it on every tick.
 */
export function renderProblems(problems: ProblemLine[]): boolean {
  const current = document.getElementById(SECTION_ID)?.closest('section') ?? null
  const signature = JSON.stringify(problems)
  if (current?.dataset.problems === signature) return false
  if (!current && problems.length === 0) return false

  if (problems.length === 0) {
    const column = current?.parentElement ?? null
    current?.remove()
    pruneEmpty(column)
    return true
  }

  const next = problemSection(problems)
  next.dataset.problems = signature
  if (current) current.replaceWith(next)
  else sideColumn().prepend(next)
  return true
}
