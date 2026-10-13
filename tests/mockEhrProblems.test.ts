/**
 * @vitest-environment jsdom
 *
 * The mock EHR chart's live problem list — `services/mock-ehr/src/client/problems.ts`.
 *
 * ⚠️ **Here, not beside its subject**, because it needs a DOM and the Workers'
 * dev dependencies are one set across all four services (`check:toolchain`):
 * jsdom is a root dependency, and adding it to one service is the drift that
 * gate exists to fail. The module itself is plain DOM code with no Worker
 * import, so the root suite can load it directly.
 *
 * What is held is PLACEMENT, because that is the part the server-rendered page
 * cannot show: the page drops empty sections, columns and the whole chart body,
 * so the first problem saved on a chart may have nowhere to go.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderProblems } from '../services/mock-ehr/src/client/problems'
import type { ProblemLine } from '../services/mock-ehr/src/client/types'

const DRIVER: ProblemLine = {
  title: 'Unbearable guilt about the relapse',
  detail: 'Suicide Driver · Direct Driver',
  when: '15 Jul 2026',
  status: 'active',
  tone: 'warning',
}
const RESOLVED: ProblemLine = { ...DRIVER, status: 'resolved', tone: 'info' }

/** The chart body as chartPage.ts renders it, from its column names. */
function page(columns: Array<'main' | 'side'>) {
  const cols = columns
    .map(name => `<div class="chart-body__col" data-col="${name}"><section class="sect"><h3 class="sect__title">${name}</h3></section></div>`)
    .join('')
  document.body.innerHTML = `<div id="chart-body-anchor">${
    columns.length > 0
      ? `<div class="chart-body"><div class="chart-body__cols${columns.length === 1 ? ' chart-body__cols--single' : ''}">${cols}</div></div>`
      : ''
  }</div>`
}

const section = () => document.getElementById('sect-problems')?.closest('section')
const titles = () => [...document.querySelectorAll('#chart-body-anchor .entry__title')].map(n => n.textContent)
const cols = () => document.querySelector('.chart-body__cols')

describe('the live problem list', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('builds the chart body for the first problem on a bare chart', () => {
    page([])
    expect(renderProblems([DRIVER])).toBe(true)
    expect(titles()).toEqual([DRIVER.title])
    expect(section()?.parentElement?.dataset.col).toBe('side')
    expect(cols()?.classList.contains('chart-body__cols--single')).toBe(true)
  })

  it('adds a side column beside a main-only chart, and stops calling it single', () => {
    page(['main'])
    renderProblems([DRIVER])
    expect([...cols()!.children].map(c => (c as HTMLElement).dataset.col)).toEqual(['main', 'side'])
    expect(cols()!.classList.contains('chart-body__cols--single')).toBe(false)
  })

  it('goes FIRST in an existing side column', () => {
    page(['main', 'side'])
    renderProblems([DRIVER])
    const side = document.querySelector('[data-col="side"]')!
    expect(side.firstElementChild).toBe(section())
  })

  it('changes nothing when the list has not changed — a poll is not a re-announcement', () => {
    page(['main', 'side'])
    renderProblems([DRIVER])
    const before = section()
    expect(renderProblems([DRIVER])).toBe(false)
    expect(section()).toBe(before)
  })

  it('replaces the section in place when a driver is resolved', () => {
    page(['main', 'side'])
    renderProblems([DRIVER])
    expect(renderProblems([RESOLVED])).toBe(true)
    expect(document.querySelectorAll('#sect-problems')).toHaveLength(1)
    expect(document.querySelector('.entry__status')?.textContent).toBe('resolved')
    expect(document.querySelector('.entry__status')?.classList.contains('entry__status--info')).toBe(true)
  })

  it('takes away what it built when the list empties (a reset in Settings)', () => {
    page([])
    renderProblems([DRIVER])
    renderProblems([])
    expect(section()).toBeFalsy()
    expect(document.querySelector('.chart-body')).toBeNull()

    page(['main'])
    renderProblems([DRIVER])
    renderProblems([])
    expect([...cols()!.children].map(c => (c as HTMLElement).dataset.col)).toEqual(['main'])
    expect(cols()!.classList.contains('chart-body__cols--single')).toBe(true)
  })

  it('holds a tone to the four the stylesheet defines', () => {
    page([])
    renderProblems([{ ...DRIVER, tone: 'x onmouseover' as ProblemLine['tone'] }])
    expect(document.querySelector('.entry__status')?.className).toBe('entry__status entry__status--info')
  })
})
