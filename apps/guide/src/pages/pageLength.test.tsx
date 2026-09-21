/**
 * @vitest-environment jsdom
 *
 * Every guide page has a declared length, and it is measured rather than
 * remembered.
 *
 * ── The defect this exists for ────────────────────────────────────────────
 *
 * The adoption-guide UX audit measured the site and found the third of its
 * three findings was simply LENGTH
 * (docs/plans/adoption-guide-ux-audit-2026-09-20.md §2, §3): the Overview ran
 * 1,716 words before a reader reached a link to anything, the Care Pathway
 * 2,445, Tools eleven screens of accordion, the Data Dictionary seventeen. Four
 * PRs cut three of those. Nothing stopped the fifth paragraph going back on.
 *
 * ⚠️ **A length is exactly the kind of rule that cannot be enforced by
 * reviewing a diff.** Every individual addition is two sentences and defensible;
 * the page is over budget after eleven of them, and no single commit is the one
 * that did it. So §5 rule 4 is a budget per page, and this is the budget.
 *
 * ── What is counted: the words a reader meets ON ARRIVAL ──────────────────
 *
 * ⚠️ **Not `textContent`, and the difference is the whole point.** The audit's
 * companion rule (§5 rule 2, inherited from the mock-EHR UX pass) is *task
 * first, caveats in a drawer* — a caveat is DEMOTED into a closed `<details>`,
 * never deleted. A cap over `textContent` counts a closed drawer's body in
 * full, so it would score demoting a caveat exactly the same as leaving it in
 * the reader's way, and reward deleting it instead. That is the opposite of the
 * rule it is meant to serve. So a closed `<details>` contributes its `summary`
 * and nothing else — which is precisely what a reader sees.
 *
 * The numbers this produces are the audit's, independently: it measured
 * `/guide/data-dictionary` at 1,980 words in a real browser and this reads
 * 2,001; `/guide/dashboard` 462 against 457; `/guide/adoption-rubric` 368
 * against 377. That agreement is why a jsdom count is allowed to stand in for
 * the browser one here, where `check:prose` had to refuse the same trade.
 *
 * ── What it cannot see ────────────────────────────────────────────────────
 *
 * ⚠️ **Screens, which is what a reader actually experiences.** Words are a
 * proxy: jsdom computes no layout, so a page that doubles its height with
 * images, cards or whitespace passes untouched. The audit measured both and
 * they moved together; if they ever stop, re-measure heights in a browser.
 *
 * ⚠️ **The layout's own chrome** — `PageHeader`, the group eyebrow and the
 * pager are rendered by `AdoptionGuide`, not by the page. Each page is mounted
 * on its own, so the budgets are the page's own words.
 *
 * ⚠️ **A page could pass by being unreadable rather than short.** Nothing here
 * says the words are in paragraphs a person can follow.
 */
import type { ReactElement } from 'react'
import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { InspectContext } from '@spier/tool-views/context/InspectContext'
import { GUIDE_SECTIONS } from '../data/guideSections'
import { AdoptionReadiness } from './AdoptionReadiness'
import { CarePathway } from './CarePathway'
import { CarePathwayProtocol } from './CarePathwayProtocol'
import { CdsServiceGuide } from './CdsServiceGuide'
import { DataDictionary } from './DataDictionary'
import { EhrAdoptionRubric } from './EhrAdoptionRubric'
import { Overview } from './Overview'
import { PatientJourney } from './PatientJourney'
import { PopulationDashboardGuide } from './PopulationDashboardGuide'
import { ProviderAppGuide } from './ProviderAppGuide'
import { WhySpier } from './WhySpier'

afterEach(cleanup)

/**
 * The CDS page probes its own live discovery document. Stubbed to a failure so
 * the count is the page's own words rather than a Worker's JSON, and so the
 * suite stays offline — `services/guide` verifies with no network at all.
 */
const realFetch = globalThis.fetch
beforeAll(() => {
  globalThis.fetch = (() => Promise.reject(new Error('offline'))) as typeof fetch
})
afterAll(() => {
  globalThis.fetch = realFetch
})

/** The words a reader meets on arrival. See the header for why not `textContent`. */
function arrivalWords(root: Element): number {
  const visible = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? ''
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return ''
    if (el.hasAttribute('hidden')) return ''
    if (el.tagName === 'DETAILS' && !(el as HTMLDetailsElement).open) {
      const summary = el.querySelector('summary')
      return summary ? visible(summary) : ''
    }
    // Joined with a space: adjacent inline elements are separate words, and
    // `textContent` would run the last word of one into the first of the next.
    return [...el.childNodes].map(visible).join(' ')
  }
  return visible(root).trim().split(/\s+/).filter(Boolean).length
}

/**
 * ⚠️ **A cap is a BUDGET, not a record of today's count.** Two kinds of entry,
 * and the `why` says which: a page the audit has already been applied to
 * carries the number that audit asked for, and a page it has not yet reached
 * carries today's measurement rounded up — which stops it growing while PR 5
 * is still to come, and is meant to be LOWERED by that PR rather than raised.
 *
 * Nothing re-derives these. Re-measure when a page is rewritten; do not nudge a
 * cap up to make a red run green, which is the one move that turns this file
 * into a comment.
 */
const SURFACE_GUIDE_CAP = 330
const SURFACE_GUIDE_WHY =
  'One of the three "see it running" pages, which §4.4 made one pattern and PR 5 applied: what it is in two ' +
  'sentences, what you see in four bullets, the button, then two closed drawers. 268 / 241 / 290 words visible ' +
  'today. The caveats are not gone — they are inside the drawers, where a reader who wants them opens one and a ' +
  'reader who does not is not charged for them.'

const CAPS: Record<string, { cap: number; why: string }> = {
  '/overview': {
    cap: 450,
    why: 'Audit §4.1 asks for ~300 and §5 rule 4 caps it at 400; content/overview.ts holds its own 400-word ' +
      'assertion over the prose. This is the rendered page, so it also carries the headings, the three chart ' +
      'picks and the step cards — 423 today.',
  },
  pathway: {
    cap: 1250,
    why: 'PR 3 brought it from 2,445 to 1,203: about 460 of the page’s own prose, 180 of the simulator’s ' +
      'questions and 580 of the artifact’s tier table. The table is rendered from the PlanDefinition, so most ' +
      'of this budget is not writing anyone does here.',
  },
  'pathway/protocol': {
    cap: 1950,
    why: 'The implementer’s page: the spine with its table, the pending-definition strip and provenance, ' +
      'nearly all of it rendered from the artifact. Long on purpose, and the reason the explainer is short.',
  },
  tools: {
    cap: 1300,
    why: 'PR 4 replaced 40 accordion cards with 40 rows. Almost all of it is the catalogue — a tool’s name and ' +
      'the first sentence of its purpose — so the page’s own prose is the part under §5 rule 4, and PatientJourney.test.tsx pins that.',
  },
  'tools/readiness': {
    cap: 780,
    why: 'Eight tables of catalogue rows plus a legend; 732 today. The audit leaves its content alone (§4.5).',
  },
  // ⚠️ **The three "see it running" pages share ONE budget, because §4.4 made
  // them one pattern**: what it is, what you see, the button, then two closed
  // drawers. PR 5 brought them to 268, 241 and 290 words visible — from 996,
  // 460 and 701 — and not one caveat was deleted to do it; all four of the
  // Provider App's Notices are drawer content now. A separate number per page
  // would let one of the three drift back into an essay while the pattern still
  // looked intact, which is the thing that made them 2.9 screens the first time.
  'provider-app': { cap: SURFACE_GUIDE_CAP, why: SURFACE_GUIDE_WHY },
  dashboard: { cap: SURFACE_GUIDE_CAP, why: SURFACE_GUIDE_WHY },
  'cds-service': { cap: SURFACE_GUIDE_CAP, why: SURFACE_GUIDE_WHY },
  'data-dictionary': {
    cap: 1200,
    why: '§4.5 asked for navigation rather than cuts, and got it on 2026-09-21: the eight stage tables are closed ' +
      'drawers, arrival opens the first, a jump opens its target and a search opens every stage with a match. ' +
      'From 2,001 words to 1,155 on arrival — the description, the filters, the jump nav, the normalization layer ' +
      'and ONE table (the first stage holds the most rows). Not a row was cut.',
  },
  'adoption-rubric': {
    cap: 420,
    why: 'A grid of stage columns and little prose; 377 today, and the audit does not ask it to change.',
  },
  'why-spier': {
    cap: 1150,
    why: 'The Overview’s essays, moved here by PR 2 rather than deleted — Capture → Translate → Act at length, the ' +
      'two vocabularies, the four surfaces and the portability case. Reference material a reader chooses to open, ' +
      'which is the argument for it being long AND for it being last in the sidebar.',
  },
}

/**
 * Guide paths with no budget, and why not. ⚠️ An exemption is a page nothing
 * measures — keep this list at the length a reader can check by eye.
 */
const NO_BUDGET: Record<string, string> = {
  'tools/:toolRef':
    'One page per catalogued tool, and most of its words are the INSTRUMENT’s — the C-SSRS is longer than the ' +
    'ASQ and neither is the guide’s writing. §5 rule 4 caps the part that is (the prose above the form, ≤ 150 ' +
    'words) and ToolPage.test.tsx measures exactly that.',
}

/** path → the component the route renders. */
const PAGES: Record<string, () => ReactElement> = {
  '/overview': Overview,
  pathway: CarePathway,
  'pathway/protocol': CarePathwayProtocol,
  tools: PatientJourney,
  'tools/readiness': AdoptionReadiness,
  'provider-app': ProviderAppGuide,
  dashboard: PopulationDashboardGuide,
  'cds-service': CdsServiceGuide,
  'data-dictionary': DataDictionary,
  'adoption-rubric': EhrAdoptionRubric,
  'why-spier': WhySpier,
}

/** Below this, the page did not render and a cap would pass on nothing. */
const RENDER_FLOOR = 100

function measure(path: string): number {
  const Page = PAGES[path]
  const { container } = render(
    <MemoryRouter initialEntries={[path.startsWith('/') ? path : `/guide/${path}`]}>
      {/* The guide layout provides this to every page under it: raw FHIR
          renders inside /guide and nowhere else. Mounting a page without it
          would measure the clinical surface's version of it. */}
      <InspectContext.Provider value>
        <Page />
      </InspectContext.Provider>
    </MemoryRouter>,
  )
  return arrivalWords(container)
}

describe('every guide page has a budget', () => {
  it('covers every section and subsection in GUIDE_SECTIONS', () => {
    // ⚠️ Derived from the section list, not from the keys above — a hand-kept
    // page list is the failure this repo keeps writing gates against: the page
    // that escapes the cap is the new one, and a new one added to a hand list
    // is a page whose author chose whether to measure it.
    const declared = GUIDE_SECTIONS.flatMap(s => [s.path, ...(s.subsections ?? []).map(x => x.path)])
    expect(declared.length).toBeGreaterThan(8)
    for (const path of declared) {
      const budgeted = path in CAPS
      const exempt = path in NO_BUDGET
      expect(budgeted || exempt, `/guide/${path} has no word budget and no exemption — add one to CAPS or NO_BUDGET`).toBe(true)
      if (budgeted) expect(path in PAGES, `${path} is budgeted but has no component in PAGES`).toBe(true)
    }
    // The front door is not a section, and is the page the audit measured first.
    expect(CAPS['/overview']).toBeDefined()
    // Every exemption is still a real page: an entry for a path that no longer
    // exists is an exemption nobody will ever notice has gone stale.
    for (const path of Object.keys(NO_BUDGET)) expect(declared).toContain(path)
  })

  it.each(Object.keys(CAPS))('%s is inside its budget', path => {
    const words = measure(path)
    // Liveness first: a page that rendered nothing satisfies any cap.
    expect(words, `${path} rendered ${words} words — it did not render`).toBeGreaterThan(RENDER_FLOOR)
    expect(
      words,
      `${path} renders ${words} words on arrival, over its budget of ${CAPS[path].cap}.\n` +
        `        ${CAPS[path].why}\n` +
        '        Cut it, or demote a caveat into a closed <details> — a closed drawer costs its summary only.\n' +
        '        Raising the number is the one fix that makes this file decorative.',
    ).toBeLessThanOrEqual(CAPS[path].cap)
  })
})
