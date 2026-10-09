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
 * writing.** `/patient/on-file` and `/patient/record` grow with the chart —
 * about eight words a row — so their caps are set from the fullest chart in the
 * demo population with room above it. A real chart with 60 artifacts would
 * breach them and would be right to; the number to change then is the cap, and
 * the thing to check first is whether a row has grown a sentence.
 */
import type { ReactElement } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { POPULATION_PATIENTS, POPULATION_SCENARIOS } from '@spier/demo-population'
import { LocalDataSource } from '@spier/app-shell/lib/dataSource/localDataSource'
import { SurfaceLinksContext } from '@spier/tool-views/context/SurfaceLinksContext'
import { CLINICAL_SURFACE_LINKS } from '../surfaceLinks'
// ⚠️ The route table as TEXT, through Vite's `?raw`, rather than through
// `node:fs`. This project's tsconfig asks for `vite/client` and not `node`, and
// widening it so one test can read a file would give every app source under it
// the Node globals — which is the boundary `check:core-boundary` exists to keep
// on the other side of the repo.
import APP_SOURCE from '../App.tsx?raw'
import { CLINICAL_RULES } from '../../../../scripts/lib/reader-jargon.mjs'

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
  useToolConfig: () => ({
    isToolEnabled: () => true,
    activePreset: 'guided-pathway',
    setPreset: () => {},
    toggleTool: () => {},
  }),
}))
/**
 * ⚠️ **The caseload's three pages read a COHORT, so the mock carries one.**
 * They go through `useRegistrySlices`, which asks the source; a `LocalDataSource`
 * seeded with the demo population answers it synchronously (`getSliceSync`), so
 * the caseload renders its fourteen rows on the first paint and a word count
 * taken here is a word count of the full page rather than of a loading state.
 *
 * ⚠️ `isSmartSession: false` for the same reason, and it is safe: none of the
 * six patient pages reads it, and it is what puts the hook on the local branch
 * instead of waiting a tick for `listCohort`.
 */
const DEMO_SOURCE = new LocalDataSource({
  patients: POPULATION_PATIENTS,
  scenarios: POPULATION_SCENARIOS,
})
/**
 * ⚠️ **Hoisted, and it has to be.** `useRegistrySlices` keys its read effect on
 * the cohort array's identity, so a mock returning a fresh `[...]` on every
 * render loops: effect → setState → render → new array → effect. The real
 * provider hands back a stable reference; a mock must too.
 */
const DEMO_COHORT = [...POPULATION_PATIENTS]

vi.mock('@spier/tool-views/context/PatientContext', () => ({
  usePatient: () => ({
    dataSource: DEMO_SOURCE,
    populationPatients: DEMO_COHORT,
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
    isSmartSession: false,
    walkthrough: [],
    isSliceLoading: false,
    dataSourceError: null,
    writebackReport: null,
  }),
}))

// jsdom implements neither, and more than one page's hooks call them on mount.
Element.prototype.scrollTo = () => {}
window.scrollTo = () => {}
// The caseload measures its own table to decide whether to offer the filters
// above it as well as inside the headers. jsdom computes no layout, so the
// observer never fires and the compact filters stay off — which is the state
// this budget is taken in, and the wider of the two.
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver
// `useNarrowViewport` asks for a media query; jsdom has none, and its absence
// is the "not narrow" default the hook documents.

const { PatientChart } = await import('./PatientChart')
const { PatientOnFile } = await import('./PatientOnFile')
const { PatientRecord } = await import('./PatientRecord')
const { WhyThis } = await import('./WhyThis')
const { PathwayProtocol } = await import('./PathwayProtocol')
const { PathwayStage } = await import('./PathwayStage')
const { PopulationView } = await import('./PopulationView')
const { PopulationAlerts } = await import('./PopulationAlerts')
const { PopulationSummaryEmbed } = await import('./PopulationSummaryEmbed')
const { MeasureDashboard } = await import('./MeasureDashboard')
const { ToolConfiguration } = await import('./ToolConfiguration')

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
    cap: 300,
    why:
      'The chart IS the eight-stage pathway now (Brad, 2026-09-22), opened at what the record owes. ' +
      'Audit §4.1 budgeted this page at 60 words when it was one card with the stage list a link ' +
      'away; the list came back onto it, so its 134 words came with it — 219 on the fullest chart in ' +
      'the demo population, which is the old /patient/where measurement plus the act now drawn inside ' +
      'the open stage. Most of it is the patient’s record, about eight words a row, so the cap is set ' +
      'from the fullest chart with room above it rather than from prose. What it still forbids is the ' +
      'thing §4.3 cut: CodeSystem definitions written to an EHR vendor, and a second retelling of ' +
      'what is due.',
  },
  '/patient/why': {
    cap: 150,
    why:
      'The reasoning behind the one recommendation (§4.2), 80 words. PR 4 measured it at 73 in a ' +
      'browser and at 470×900 it fits without scrolling, which is the property to keep. Its ' +
      'alternatives list is a closed drawer, so it costs its summary and not its contents.',
  },
  '/patient/on-file': {
    cap: 400,
    why:
      'One list, one row per artifact (§4.4): what was recorded, when, by which instrument. 170 words ' +
      'for the 18 records of the fullest demo chart, so a row costs about eight and the cap allows ' +
      'roughly twice that chart. Three sections in three vocabularies, with an explanation of the ' +
      'FHIR R4 reference model to justify one of them, is what it replaced.',
  },
  '/patient/on-file/:recordKey': {
    cap: 200,
    why:
      'One record opened (2026-09-22): the nine PHQ-9 questions, the nine answers given to them, and ' +
      'the two results it produced. 180 words, and about 170 of them are the INSTRUMENT’s wording and ' +
      'the patient’s own — so this is the weaker of the two numbers the page is held to, exactly like ' +
      'the caseload’s. `RECORD_CHROME_CAP` below is the one that expresses the rule: this page writes ' +
      'almost nothing of its own. Raise this one for a longer instrument; never raise it for a sentence.',
  },
  '/patient/pathway': {
    cap: 1150,
    why:
      'The published protocol, rendered from the artifact. 1,667 words until 2026-10-09, when the artifact ' +
      'began marking which of its notes are written for the clinician and this view stopped rendering the ' +
      'rest — modelling rationale, codes and definition names now render only in the guide — and it measured ' +
      '1,118. What remains is every step, the tier obligations and the clinician-facing notes, rendered from ' +
      'the artifact rather than written here; lower this again if the artifact sheds a note, never raise it.',
  },
  '/population/caseload': {
    cap: 1100,
    why:
      'The care manager’s screen. 1,001 words, and about 950 of them are the FOURTEEN ROWS — a ' +
      'row is a name, an MRN, a stage, a risk word, its open work, its last activity and its ' +
      'recommended next step with a rationale, which is roughly 65 words. So this cap is nearly ' +
      'all data and it is the weaker of the two numbers this page is held to: `CHROME_CAP` below ' +
      'is the one that expresses audit §1.11, because a worklist’s defect is what sits ABOVE the ' +
      'first patient and not how many patients there are. Raise this one for a bigger caseload; ' +
      'never raise it for a sentence.',
  },
  '/population/alerts': {
    cap: 260,
    why:
      'Every alert on the caseload, on the page the count opens (§4.8). 19 alerts over 8 patients ' +
      'on the demo caseload, each group a closed <details> costing its summary — which is the ' +
      'patient’s name and their alert labels, and is the whole reason the drawer is the unit. The ' +
      'cap is the chrome plus today’s worst day with room above it.',
  },
  '/population/summary': {
    cap: 310,
    why:
      'The framed half of the caseload — tiles, census, alerts — with no table and no page header, ' +
      'embedded by the demo EHR at the top of its front door in a 503px box on a phone (§8.8). ' +
      '279 words, most of it the alert groups’ own summaries: ten patients, each with the ' +
      'labels of what they are owed. It is not smaller because this is the ONE place the inline ' +
      'alert list is still right — a host framing an activity has nowhere to send a reader — and ' +
      'the audit did not ask for the host’s layout to change. ' +
      '⚠️ Raised from 260/233 when patients 013 and 014 gained the `interpretation` their own ' +
      'ASQ mapper writes: both acute positive screens had been invisible to `isPositive`, so ' +
      'neither could miss `screen-to-assessment`, so neither raised an alert. This is the ' +
      'caseload’s rule — raise for more CASELOAD, never for a sentence — and two patients newly ' +
      'visible to a measure is more caseload.',
  },
  '/population/measures': {
    cap: 560,
    why:
      'The quality lead’s screen: eight measures, each a table plus an explanation when it has ' +
      'nothing to score. 294 words on the fourteen-patient caseload today (503 when §8.3 measured it — the cap was set from that and has room to come down). Nearly all of it is ' +
      'the measures’ own published titles and group names, so the cap allows a ninth measure ' +
      'without allowing a page of prose about them. What it replaced: 937 words on a session with ' +
      'no cohort at all, because eight empty denominators each explained themselves (§8.7) — that ' +
      'page renders one line now.',
  },
  '/settings': {
    cap: 420,
    why:
      'The operator’s page (§4.9). 1,501 words and 8,641px on a phone before this PR: an intro ' +
      'about the difference between this setting and the EHR’s capability, eight stage ' +
      'descriptions written to an EHR vendor, and forty published tool purposes each ending ' +
      '“Belongs to the … stage of the SPiER pathway”. It is the preset picker, the checklist and ' +
      'one sentence now. The cap is roughly today plus a fifth preset — the forty tool NAMES are ' +
      'most of it, and a forty-first is a word, not a paragraph.',
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
  '/population/caseload': PopulationView,
  '/population/alerts': PopulationAlerts,
  '/population/summary': PopulationSummaryEmbed,
  '/population/measures': MeasureDashboard,
  '/settings': ToolConfiguration,
  '/patient/why': WhyThis,
  '/patient/on-file': PatientOnFile,
  '/patient/on-file/:recordKey': PatientRecord,
  '/patient/pathway': PathwayProtocol,
  '/patient/pathway/:stageId': PathwayStage,
}

/** The stage the parameterised page is measured at — the one the demo lands on. */
const MEASURED_STAGE = 'document-safety-actions'

/**
 * The record the opened-record page is measured at: patient-001's PHQ-9.
 *
 * ⚠️ **The LONGEST form on the fullest chart, chosen for that** — nine
 * questions, nine answers and the two results it produced. The C-SSRS asks more
 * and the Stanley-Brown plan is seven groups; neither is on this patient, and a
 * cap measured on the CAMS section here (one question) would be a cap nothing
 * could breach. What the number below therefore cannot see is a longer
 * instrument's record, which is the same limit `MEASURED_STAGE` carries — and
 * the reason the chrome cap under it exists.
 */
const MEASURED_RECORD = 'form-p001-phq9'

/** Below this, the page did not render and a cap would pass on nothing. */
const RENDER_FLOOR = 30

/** Mounts one page at its measured entry, in the clinical app's surface links. */
function renderPage(path: string): HTMLElement {
  const Page = PAGES[path]
  const entry = path.replace(':stageId', MEASURED_STAGE).replace(':recordKey', MEASURED_RECORD)
  const { container } = render(
    <MemoryRouter initialEntries={[entry]}>
      <SurfaceLinksContext.Provider value={CLINICAL_SURFACE_LINKS}>
        <Routes>
          <Route path={path} element={<Page />} />
        </Routes>
      </SurfaceLinksContext.Provider>
    </MemoryRouter>,
  )
  return container
}

function measure(path: string): number {
  return arrivalWords(renderPage(path))
}

/**
 * The caseload's SECOND number: the words a care manager meets before the first
 * patient.
 *
 * ⚠️ **A whole-page cap cannot express audit §1.11.** The caseload is 1,001
 * words and 950 of them are the fourteen rows, so a page cap moves with the
 * caseload's size and says nothing about the thing that was wrong: a seven-tile
 * summary, a nineteen-alert panel and a 37-word lede between the reader and the
 * worklist, with the first row at 1,104px on a laptop and 1,419px on a phone.
 * This counts what is rendered ABOVE the table, which is the number §4.8 is
 * about.
 */
const CHROME_CAP = 60

describe('the caseload leads with the worklist', () => {
  it(`renders at most ${CHROME_CAP} words above the first patient`, () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/population/caseload']}>
        <SurfaceLinksContext.Provider value={CLINICAL_SURFACE_LINKS}>
          <PopulationView />
        </SurfaceLinksContext.Provider>
      </MemoryRouter>,
    )
    const page = container.querySelector('.population-view')
    const table = container.querySelector('table')
    expect(page, 'the caseload did not render').toBeTruthy()
    expect(table, 'the caseload rendered no table — a cap over nothing').toBeTruthy()
    expect(table!.querySelectorAll('tbody tr').length).toBeGreaterThan(10)

    let above = 0
    for (const child of [...page!.children]) {
      if (child.contains(table)) break
      above += arrivalWords(child)
    }
    expect(
      above,
      `${above} words sit above the first patient row, over the ${CHROME_CAP} this page allows.\n` +
        '        Audit §4.8: the table first, the summary below it, the alerts as one line that\n' +
        '        opens a page. Anything longer than a lede and a count belongs under the table.',
    ).toBeLessThanOrEqual(CHROME_CAP)
  })
})

/**
 * The opened record's SECOND number: the words SPiER writes on it.
 *
 * ⚠️ **A whole-page cap says almost nothing here.** 180 of that page's words are
 * the PHQ-9's nine questions and the nine answers given to them, so the cap
 * moves with whichever record is measured and would absorb a paragraph of
 * explanation without noticing. What is worth gating is the property the page
 * was built on: it frames the record and explains nothing. This counts
 * everything outside the record's own content — the eyebrow, the section
 * titles — which on the measured record is a handful of words.
 *
 * ⚠️ The page TITLE and LEDE are the record's, not SPiER's: the title is what
 * was recorded and the lede is its kind, its state and its date. They are
 * excluded for the same reason the answers are.
 */
const RECORD_CHROME_CAP = 15

/** The containers holding the record itself rather than the page's own words. */
const RECORD_CONTENT = '.record-answers, .record-reading, .record-links, .page-header__title, .page-header__lede'

describe('an opened record explains nothing', () => {
  it(`writes at most ${RECORD_CHROME_CAP} words of its own`, () => {
    const { container } = render(
      <MemoryRouter initialEntries={[`/patient/on-file/${MEASURED_RECORD}`]}>
        <SurfaceLinksContext.Provider value={CLINICAL_SURFACE_LINKS}>
          <Routes>
            <Route path="/patient/on-file/:recordKey" element={<PatientRecord />} />
          </Routes>
        </SurfaceLinksContext.Provider>
      </MemoryRouter>,
    )
    const page = container.querySelector('.patient-record')
    expect(page, 'the record page did not render').toBeTruthy()
    const content = [...page!.querySelectorAll(RECORD_CONTENT)]
    // Liveness: a cap over a page that rendered none of the record is a cap
    // over nothing, and it would be the easiest of all these to pass by mistake.
    expect(content.length, 'the record page rendered none of the record').toBeGreaterThan(1)

    const own = arrivalWords(page!) - content.reduce((n, el) => n + arrivalWords(el), 0)
    expect(
      own,
      `${own} words on the opened record are SPiER's own, over the ${RECORD_CHROME_CAP} this page allows.\n` +
        '        The page frames what was recorded and explains nothing: an eyebrow, a title that is the\n' +
        '        record\u2019s own name, and one heading per section. An explanation of what a record is,\n' +
        '        or of where it came from, belongs on the Adoption Guide.',
    ).toBeLessThanOrEqual(RECORD_CHROME_CAP)
  })
})

describe('every clinical page has a budget', () => {
  it('covers every route in the app that renders a page', () => {
    // ⚠️ Derived from the ROUTE TABLE, not from the keys above — a hand-kept
    // page list is the failure this repo keeps writing gates against: the page
    // that escapes the cap is the new one, and a new one added to a hand list
    // is a page whose author chose whether to measure it.
    //
    //
    // ⚠️ Each `<Route …>` tag is READ, attribute by attribute, in any order. This
    // matched `<Route\s+path="…"\s+element={…` — so a new page written
    // `<Route element={<Page />} path="why-long" />` was not in the table this
    // test derives, carried no budget and passed. A path the tag spells as an
    // expression rather than a literal cannot be budgeted, so it fails here
    // instead of being skipped.
    const src = APP_SOURCE
    const tags: { at: number; path: string | null; computedPath: boolean; element: string | null; selfClosing: boolean }[] = []
    for (const m of src.matchAll(/<Route\b/g)) {
      const start = m.index ?? 0
      let i = start + m[0].length
      let depth = 0
      let quote: string | null = null
      for (; i < src.length; i++) {
        const c = src[i]
        if (quote) {
          if (c === quote) quote = null
        } else if (c === '"' || c === "'" || c === '`') quote = c
        else if (c === '{') depth++
        else if (c === '}') depth--
        else if (c === '>' && depth === 0) break
      }
      const tag = src.slice(start, i + 1)
      const attrs = tag.replace(/^<Route\b/, '')
      const literal = /\bpath=(?:"([^"]*)"|\{\s*(['"`])([^'"`$]*)\2\s*\})/.exec(attrs)
      const at = /\belement=\{/.exec(attrs)
      let element: string | null = null
      if (at) {
        let d = 0
        let j = at.index + 'element='.length
        for (; j < attrs.length; j++) {
          if (attrs[j] === '{') d++
          else if (attrs[j] === '}' && --d === 0) break
        }
        element = attrs.slice(at.index + 'element={'.length, j)
      }
      tags.push({
        at: start,
        path: literal ? (literal[1] ?? literal[3]) : null,
        computedPath: !literal && /\bpath=/.test(attrs),
        element,
        selfClosing: /\/>$/.test(tag),
      })
    }
    expect(tags.filter(t => t.computedPath), 'a <Route> whose path is an expression cannot be budgeted').toEqual([])
    // The nesting `<Route path="/…">` wrappers, so a child path resolves
    // against the one it is actually inside rather than against a guess.
    const parents = tags.filter(t => t.path?.startsWith('/') && t.element === null && !t.selfClosing)
    const parentOf = (at: number) =>
      parents.filter(p => p.at < at).at(-1)?.path ?? ''
    const declared = tags
      .filter((t): t is typeof t & { path: string; element: string } => t.path !== null && t.element !== null)
      // A redirect renders no page, and neither do the two SMART legs.
      // `…Redirect` covers `LegacyChartRedirect`, which is a `<Navigate>` with
      // the patient id carried through rather than a page of its own.
      .filter(t => !/Navigate|Redirect/.test(t.element) && !['/launch', '/redirect'].includes(t.path))
      .map(t => (t.path.startsWith('/') ? t.path : `${parentOf(t.at)}/${t.path}`))
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

/**
 * What every clinical page RENDERS names no wire format — measured on the page,
 * not on the source.
 *
 * ⚠️ **`check:jargon`'s clinician scan reads source strings, and this surface's
 * worst leak was never in one.** `/patient/pathway` draws the published protocol:
 * its step labels (`ActivityDefinition/AdministerPHQ9`), its notes ("a
 * suicide-risk result on LOINC 93374-7 valued from SPiERSuicideRiskTier") and its
 * codes arrive from the artifact at runtime, so on 2026-10-09 a clinician met
 * five resource-type labels, two profile names and three codes on it with the
 * gate green. This applies the SAME rule list (`CLINICAL_RULES`, from
 * `scripts/lib/reader-jargon.mjs`) to every text run each page renders — closed
 * drawers included, because a clinician can open one — on every page this file
 * already proves is the whole route table. `check:jargon` runs this file.
 *
 * Excluded, as on the guide's copy of this test: `<pre>` (the wire format shown
 * on purpose, and only under inspection) and form-control values. And ONE
 * element by name: a CDS card's detail (`.cds-card-rationale`). That text is the
 * CDS Hooks card as the service sends it to every EHR — the problem-list card's
 * job is to name the codes behind a coding decision (problemListCard.ts) — and
 * `PatientPathway.tsx` prints it verbatim on purpose rather than rewording a
 * standard payload for one renderer. It is the one place a clinician here meets
 * a code, and it is listed rather than silently passed. Decided 2026-10-09: the
 * card stays as the service sends it — this exemption is the decision, not a
 * gap waiting for one.
 *
 * What it cannot see: text a page renders only after an interaction, and a
 * patient other than the fullest chart the budgets are measured on.
 */
function renderedRuns(root: Element): string[] {
  const runs: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim()
      if (t) runs.push(t)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    if (['SCRIPT', 'STYLE', 'PRE', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
    if (el.classList.contains('cds-card-rationale')) return
    node.childNodes.forEach(walk)
  }
  walk(root)
  return runs
}

describe('what every clinical page renders names no wire format', () => {
  it.each(Object.keys(PAGES))('%s', path => {
    const runs = renderedRuns(renderPage(path))
    expect(runs.length, `${path} rendered nothing`).toBeGreaterThan(RENDER_FLOOR / 3)
    const hits = runs.flatMap(run =>
      CLINICAL_RULES.filter(rule => rule.re.test(run)).map(
        rule => `${rule.name}: "${run.match(rule.re)?.[0]}" in "${run.slice(0, 140)}"`,
      ),
    )
    expect(hits).toEqual([])
  })
})
