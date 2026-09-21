/**
 * @vitest-environment jsdom
 *
 * Every clinical page has a declared length, and it is measured rather than
 * remembered.
 *
 * ── The defect this exists for ────────────────────────────────────────────
 *
 * The same one `apps/guide/src/pages/pageLength.test.tsx` was written against,
 * one surface over, and with a harder constraint: the clinician's page is
 * 470×900 at best and 375×812 on a phone, and the clinical-app audit measured
 * what it holds (§3, §1.10). The chart was 318 words and 2,358px before it said
 * what to do; `/settings` was 1,520 words and 8,605px, and `/patient/pathway`
 * 1,884 and 7,674px, both reached from the panel's own links.
 *
 * ⚠️ **A length is exactly the kind of rule that cannot be enforced by
 * reviewing a diff.** Every individual addition is two sentences and
 * defensible; the page is over budget after eleven of them, and no single
 * commit is the one that did it. So §5 rule 1 is a budget per page, and this is
 * the budget.
 *
 * ── What is counted, and in which chrome ──────────────────────────────────
 *
 * **The words a reader meets on arrival, in PANEL chrome.** Panel rather than
 * the launched tab because the panel is the tight one and it is what the demo
 * shows; it also changes what some pages render (the chart draws no page header
 * there at all), so measuring the other chrome would be measuring a different
 * page. The chrome's OWN words — the host's header, `PanelShell`'s identity
 * strip — are not counted: each page is mounted on its own, so a budget is the
 * page's own words, and the strip is two lines whether the page is 60 words or
 * 600.
 *
 * ⚠️ **A closed `<details>` contributes its `summary` and nothing else**, for
 * the reason the guide's copy of this states at length: the companion rule is
 * *task first, caveats in a drawer, never deleted*, and a cap over
 * `textContent` would score demoting a caveat the same as leaving it in the
 * reader's way. On this surface the caveat's drawer is often a different PAGE
 * (§2), which the budgets below assume — `/patient/why` exists because the
 * landing screen refused to hold it.
 *
 * ── What it cannot see ────────────────────────────────────────────────────
 *
 * ⚠️ **Screens, which is what a clinician actually experiences.** jsdom
 * computes no layout. The PR that added this measured the same pages in a
 * browser at 375×812 and 470×900 and the two moved together; if they ever stop,
 * re-measure heights.
 *
 * ⚠️ **A page whose words are few and whose CONTROLS are many.** `/settings` is
 * 34 checkboxes; a word count says nothing about that, which is one of the
 * things PR 7 is for.
 *
 * ⚠️ **A budget that is mostly the PATIENT'S RECORD rather than SPiER's
 * writing.** `/patient/on-file` and `/patient/where` grow with the chart —
 * about eight words a row — so their caps are set from the fullest chart in the
 * demo population with room above it. A real chart with 60 artifacts would
 * breach them and would be right to; the number to change then is the cap, and
 * the thing to check first is whether a row has grown a sentence.
 */
import type { ReactElement } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { SurfaceLinksContext } from '@spier/tool-views/context/SurfaceLinksContext'
import { CLINICAL_SURFACE_LINKS } from '../surfaceLinks'
// ⚠️ The route table as TEXT, through Vite's `?raw`, rather than through
// `node:fs`. This project's tsconfig asks for `vite/client` and not `node`, and
// widening it so one test can read a file would give every app source under it
// the Node globals — which is the boundary `check:core-boundary` exists to keep
// on the other side of the repo.
import APP_SOURCE from '../App.tsx?raw'

/**
 * ⚠️ **The fullest chart in the demo population, on purpose.** A budget
 * measured on an empty chart is a budget nothing can breach: patient-001 is
 * eight stages with activity, an open episode and 18 records, so every page
 * below renders its long form.
 */
const scenario = POPULATION_SCENARIOS['patient-001']

vi.mock('@spier/tool-views/context/PresentationContext', () => ({
  usePresentation: () => ({ chromeMode: 'panel', hostDrawsPatientBanner: true }),
}))
vi.mock('../context/ToolConfigContext', () => ({
  useToolConfig: () => ({ isToolEnabled: () => true }),
}))
vi.mock('@spier/tool-views/context/PatientContext', () => ({
  usePatient: () => ({
    patientDisplay: { fullName: 'Jane Doe', dob: '1990-01-15', age: '36', mrn: '12345', gender: 'Female' },
    responses: scenario.responses,
    carePlans: scenario.carePlans,
    observations: scenario.observations,
    communications: scenario.communications ?? [],
    riskAlerts: scenario.riskAlerts,
    procedures: scenario.procedures ?? [],
    episodes: scenario.episodes ?? [],
    encounters: scenario.encounters ?? [],
    documentReferences: scenario.documentReferences ?? [],
    serviceRequests: scenario.serviceRequests ?? [],
    appointments: scenario.appointments ?? [],
    consents: scenario.consents ?? [],
    flags: scenario.flags ?? [],
    tasks: scenario.tasks ?? [],
    activePatientId: 'patient-001',
    isSmartConnected: true,
    isSmartSession: true,
    walkthrough: [],
    isSliceLoading: false,
    dataSourceError: null,
    writebackReport: null,
  }),
}))

// jsdom implements neither, and more than one page's hooks call them on mount.
Element.prototype.scrollTo = () => {}
window.scrollTo = () => {}

const { PatientChart } = await import('./PatientChart')
const { PatientWhere } = await import('./PatientWhere')
const { PatientOnFile } = await import('./PatientOnFile')
const { WhyThis } = await import('./WhyThis')
const { PathwayProtocol } = await import('./PathwayProtocol')
const { PathwayStage } = await import('./PathwayStage')

afterEach(cleanup)

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
 * ⚠️ **A cap is a BUDGET, not a record of today's count**, and on this surface
 * it is also a claim about a 900px frame. Every number below is the audit's
 * target for the page, with today's measurement in the `why`.
 *
 * Nothing re-derives these. Re-measure when a page is rewritten; do not nudge a
 * cap up to make a red run green, which is the one move that turns this file
 * into a comment.
 */
const CAPS: Record<string, { cap: number; why: string }> = {
  '/patient/record': {
    cap: 60,
    why:
      'Audit §4.1: who, one card, one link, two links with a fact each — "that is the whole screen", ' +
      'and in a 470×900 panel it fits without scrolling. 34 words today on the fullest chart in the ' +
      'demo population. This is the smallest budget in the repo and it is meant to be: anything ' +
      'needing more words than this belongs on one of the pages the two links open.',
  },
  '/patient/why': {
    cap: 150,
    why:
      'The reasoning behind the one recommendation (§4.2), 80 words. PR 4 measured it at 73 in a ' +
      'browser and at 470×900 it fits without scrolling, which is the property to keep. Its ' +
      'alternatives list is a closed drawer, so it costs its summary and not its contents.',
  },
  '/patient/where': {
    cap: 260,
    why:
      'The eight-stage rail (§4.3): eight rows, the open ones carrying one clinician sentence and what ' +
      'is recorded there. 134 words. It has a budget rather than a shorter form because most of its ' +
      'length is the patient’s record — what §4.3 cut was the CodeSystem definitions written to an EHR ' +
      'vendor and the tool chips, and this cap is what stops them coming back as something else.',
  },
  '/patient/on-file': {
    cap: 400,
    why:
      'One list, one row per artifact (§4.4): what was recorded, when, by which instrument. 148 words ' +
      'for the 18 records of the fullest demo chart, so a row costs about eight and the cap allows ' +
      'roughly twice that chart. Three sections in three vocabularies, with an explanation of the ' +
      'FHIR R4 reference model to justify one of them, is what it replaced.',
  },
  '/patient/pathway': {
    cap: 1700,
    why:
      'The published protocol, rendered from the artifact, and the ONE page here the audit does not ask ' +
      'to shorten — §1.10’s finding is that a clinician was SENT to it from the panel’s own ' +
      'navigation, which PR 4 fixed by removing those links. 1,667 words: every step, gate and tier ' +
      'obligation, rendered from the published artifact rather than written. So this is today’s ' +
      'measurement rounded up — it stops the page growing PROSE while the artifact stays the artifact, ' +
      'and it is meant to be LOWERED by the PR that rewrites it, never raised.',
  },
  '/patient/pathway/:stageId': {
    cap: 150,
    why:
      'One stage, with the instrument the pathway names already chosen. 74 words: the stage’s ' +
      'clinician sentence, one tool card and a closed drawer of alternatives. The tool purposes are ' +
      'the catalogue’s first sentence (`lib/toolCopy.ts`), which is what keeps this small — the whole ' +
      '`purpose` adds "Belongs to the … stage of the SPiER pathway" to every card.',
  },
}

/**
 * Clinical routes with no budget, and why not. ⚠️ An exemption is a page
 * nothing measures — keep this list at the length a reader can check by eye.
 */
const NO_BUDGET: Record<string, string> = {
  '/settings':
    'The operator’s page — 1,520 words and 34 checkboxes (§1.10). Audit §4.9 moves it off the ' +
    'panel’s navigation rather than shortening it, and that is PR 7; a cap now would either pass ' +
    'at today’s length or fail on a page nobody is rewriting yet.',
  '/population/caseload':
    'The care manager’s screen, and the audit’s §1.11 says its problem is the ORDER rather than ' +
    'the length — the first patient row at 936px under a seven-tile summary. PR 7 audits it first.',
  '/population/measures':
    'Eight tables under a patient-bound token (§1.10). PR 7, with the caseload it belongs to.',
  '/population/summary':
    'Not a page a clinician opens: the summary and alerts with no table and no header, framed by ' +
    'the mock EHR at the top of its front door. Its length is the HOST’s layout problem, and ' +
    '§1.12 — about 400 requests to draw six tiles — is what PR 7 owes it.',
  '/patient/assessments/*':
    'The 18 fillers: almost every word is the INSTRUMENT’s, and the C-SSRS is longer than the ASQ ' +
    'because it asks more. The guide’s `ToolPage.test.tsx` caps the part SPiER writes.',
  '/patient/workflow/*':
    'The 11 recorders, capped by `check:fhir-render` RULE 3 on what they may SAY rather than on how ' +
    'much; PR 6 is the pass over their submit flow.',
}

/** path → the component the route renders. */
const PAGES: Record<string, () => ReactElement> = {
  '/patient/record': PatientChart,
  '/patient/why': WhyThis,
  '/patient/where': PatientWhere,
  '/patient/on-file': PatientOnFile,
  '/patient/pathway': PathwayProtocol,
  '/patient/pathway/:stageId': PathwayStage,
}

/** The stage the parameterised page is measured at — the one the demo lands on. */
const MEASURED_STAGE = 'document-safety-actions'

/** Below this, the page did not render and a cap would pass on nothing. */
const RENDER_FLOOR = 30

function measure(path: string): number {
  const Page = PAGES[path]
  const entry = path.replace(':stageId', MEASURED_STAGE)
  const { container } = render(
    <MemoryRouter initialEntries={[entry]}>
      <SurfaceLinksContext.Provider value={CLINICAL_SURFACE_LINKS}>
        <Routes>
          <Route path={path} element={<Page />} />
        </Routes>
      </SurfaceLinksContext.Provider>
    </MemoryRouter>,
  )
  return arrivalWords(container)
}

describe('every clinical page has a budget', () => {
  it('covers every route in the app that renders a page', () => {
    // ⚠️ Derived from the ROUTE TABLE, not from the keys above — a hand-kept
    // page list is the failure this repo keeps writing gates against: the page
    // that escapes the cap is the new one, and a new one added to a hand list
    // is a page whose author chose whether to measure it.
    //
    const src = APP_SOURCE
    // The two nesting `<Route path="/…">` wrappers, so a child path resolves
    // against the one it is actually inside rather than against a guess.
    const parents = [...src.matchAll(/<Route path="(\/\w+)">/g)].map(m => ({
      at: m.index ?? 0,
      path: m[1],
    }))
    const parentOf = (at: number) =>
      parents.filter(p => p.at < at).at(-1)?.path ?? ''
    const declared = [...src.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([^}]*)/g)]
      // A redirect renders no page, and neither do the two SMART legs.
      // `…Redirect` covers `LegacyChartRedirect`, which is a `<Navigate>` with
      // the patient id carried through rather than a page of its own.
      .filter(
        ([, path, element]) =>
          !/Navigate|Redirect/.test(element) && !['/launch', '/redirect'].includes(path),
      )
      .map(m => (m[1].startsWith('/') ? m[1] : `${parentOf(m.index ?? 0)}/${m[1]}`))
      // `/patient/record/:patientId` is `/patient/record` with the id in the
      // URL instead of in context — one page, one budget.
      .map(path => path.replace('/record/:patientId', '/record'))
    expect(declared.length).toBeGreaterThan(30)

    const budgeted = new Set(Object.keys(CAPS))
    const exempt = Object.keys(NO_BUDGET)
    const covers = (rule: string, path: string) =>
      rule.endsWith('*') ? path.startsWith(rule.slice(0, -1)) : rule === path
    for (const path of new Set(declared)) {
      const covered = budgeted.has(path) || exempt.some(e => covers(e, path))
      expect(covered, `${path} has no word budget and no exemption — add one to CAPS or NO_BUDGET`).toBe(true)
    }
    // Every exemption is still a real route: an entry for a path that no longer
    // exists is an exemption nobody will notice has gone stale.
    for (const e of exempt) {
      expect(declared.some(path => covers(e, path)), `${e} is exempted but no route matches it`).toBe(true)
    }
    // …and every budgeted path is one too, which is the direction that catches
    // a page renamed out from under its own cap.
    for (const path of budgeted) {
      expect(declared, `${path} is budgeted but is not in the route table`).toContain(path)
    }
  })

  it.each(Object.keys(CAPS))('%s is inside its budget', path => {
    const words = measure(path)
    // Liveness first: a page that rendered nothing satisfies any cap.
    expect(words, `${path} rendered ${words} words — it did not render`).toBeGreaterThan(RENDER_FLOOR)
    expect(
      words,
      `${path} renders ${words} words on arrival in a panel, over its budget of ${CAPS[path].cap}.\n` +
        `        ${CAPS[path].why}\n` +
        '        Cut it, demote a caveat into a closed <details>, or move it to a page of its own —\n' +
        '        on this surface the caveat’s drawer is often a different page (audit §2).\n' +
        '        Raising the number is the one fix that makes this file decorative.',
    ).toBeLessThanOrEqual(CAPS[path].cap)
  })
})
