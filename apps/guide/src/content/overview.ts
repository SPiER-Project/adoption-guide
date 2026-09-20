/**
 * The Overview page's narrative, as data.
 *
 * ─── Why a TypeScript module and not Markdown ────────────────────────────────
 *
 * The alternative considered (task C4 of docs/plans/docs-and-ig-content-consolidation.md)
 * was Markdown imported with Vite's `?raw` and rendered by a small renderer.
 * A typed module wins here for one reason that matters more than authoring
 * comfort: `tsc` and eslint stay pointed at the content. A section that loses
 * its heading, a block whose `kind` is misspelled, a door missing its `text` —
 * all of those are build failures rather than a page that renders wrong at
 * runtime. A `?raw` string is opaque to both tools, and this content carries
 * in-app routes that must keep resolving.
 *
 * It follows `data/guideSections.ts`, which is this repo's model for making one
 * ordered data file the thing everything else derives from.
 *
 * ─── The inline-markup convention ────────────────────────────────────────────
 *
 * Deliberately five rules and no more, rendered by `renderInline` in
 * `content/renderInline.tsx`:
 *
 *   **bold**          → <strong>
 *   *italic*          → <em>
 *   `code`            → <code>
 *   [text](/route)    → in-app <Link> (any href starting with "/")
 *   [text](ig)        → the published IG, opened in a new tab
 *
 * Write real characters, not HTML entities — `—`, `’`, `→` — because this is a
 * TypeScript string and not JSX, so nothing needs escaping and the source reads
 * as the sentence it is.
 *
 * ⚠️ `*` is markup here. If prose ever needs a literal asterisk, add an escape
 * to `renderInline` and a test for it; do not leave it to chance.
 *
 * ⚠️ The three `kind`s with no text of their own — `demo`, `doors`, `steps` —
 * are placements, not content. `demo` renders DEMO_CHART_PICKS from
 * `data/surfaces.ts`, so the three charts are never restated here.
 *
 * ─── What this page is for, and the length it has to hold ────────────────────
 *
 * ⚠️ **It was 1,716 words, and a reader met their first link 1,400 words in.**
 * The adoption-guide UX audit (docs/plans/adoption-guide-ux-audit-2026-09-20.md
 * §3, §4.1) measured it: Capture → Translate → Act was stated three times over,
 * the four surfaces were given five paragraphs of prose and then four cards
 * saying the same four things, and every one of the site's four readers was
 * addressed in the same paragraph.
 *
 * So the page now answers exactly three questions, in this order, and the cap
 * is **400 words before the closing step cards**:
 *
 *   1. What is SPiER?          — the lede, three sentences, no jargon.
 *   2. What do I do first?     — one instruction, three charts, one caveat.
 *   3. Where do I go next?     — three doors, one per reader, one line each.
 *
 * ⚠️ **The essays that used to sit between those are not deleted — they moved**
 * to `/guide/why-spier` (pages/WhySpier.tsx), which is where the long form of
 * Capture → Translate → Act, the two vocabularies, the four surfaces and the
 * portability case now live. Adding a paragraph here is almost always adding it
 * to the wrong page.
 */

/** A block inside a section. `demo`/`doors`/`steps` mark where a rendered
 *  component goes; the other two carry prose.
 *
 *  ⚠️ There was a third prose kind, `prose`, for a plain body paragraph. The
 *  page has none left: a section is a heading, one lead and a placement. Add it
 *  back with its renderer and its stylesheet rule if a section ever earns a
 *  second paragraph — but read the length cap above first. */
export type OverviewBlock =
  /** The section's opening paragraph, set larger than body prose. */
  | { kind: 'lead'; text: string }
  /** A quieter aside — the pointer onward, and the one interoperability caveat. */
  | { kind: 'note'; text: string }
  /** The Demo EHR button and its three charts, both from `data/surfaces.ts`. */
  | { kind: 'demo' }
  /** The three reader doors (OVERVIEW_DOORS). */
  | { kind: 'doors' }
  /** The Capture → Translate → Act cards (OVERVIEW_STEPS). */
  | { kind: 'steps' }

export interface OverviewSection {
  /** Stable key for React, and a handle for a future deep link. */
  id: string
  heading: string
  /** Extra BEM modifier on the section element, where one is needed. */
  modifier?: string
  blocks: OverviewBlock[]
}

export const OVERVIEW_EYEBROW = 'SPiER'
export const OVERVIEW_TITLE = 'Setting priorities for technology-enabled suicide-safer care'

/**
 * Three sentences, for someone who has never heard of SPiER.
 *
 * ⚠️ **The previous lede opened on "a FHIR-native reference implementation"**
 * and ran six sentences, naming the mission, the artifacts, two audiences and
 * the licence. The audit's §3 finding is that a decision-maker stops reading at
 * that first phrase. Nothing here names a standard, a resource type or an
 * audience: what SPiER is, what it does, and what it costs.
 */
export const OVERVIEW_LEDE =
  'Suicide-safer care already has validated tools — screeners, risk assessments and safety plans — ' +
  'and most of them live on paper and in PDFs that software cannot act on. SPiER encodes them, so ' +
  'an electronic health record can capture a result the same way everywhere, read a result some ' +
  'other tool produced, and put the right next step in front of the clinician. Everything SPiER ' +
  'publishes is free to adopt.'

/**
 * Three readers, three first destinations.
 *
 * ⚠️ **These replaced four cards that sorted by SURFACE, not by reader**
 * (audit §4.1). The cards named the Demo EHR, this guide, the CDS service and
 * the IG — a correct list of the four things SPiER is, and no help at all to
 * someone deciding which of them to open. How the four fit together is a real
 * question and still gets a real answer, on `/guide/why-spier`; it is just not
 * the question the front door has to answer.
 *
 * Each door is ONE sentence. A second sentence is the beginning of the essay
 * this page was before.
 */
export interface OverviewDoor {
  key: string
  /** Names the reader, in their own words: "If you are …". */
  reader: string
  /** One sentence, carrying the links. */
  text: string
}

export const OVERVIEW_DOORS: OverviewDoor[] = [
  {
    key: 'adopt',
    reader: 'If you are deciding whether to adopt',
    text:
      'Read the [Care Pathway](/guide/pathway) for the protocol SPiER implements, then ' +
      '[Adoption Readiness](/guide/tools/readiness) for where each instrument stands today.',
  },
  {
    key: 'implement',
    reader: 'If you are implementing this in an EHR',
    text:
      'Start with the [Tools](/guide/tools) catalog and the ' +
      '[Data Dictionary](/guide/data-dictionary), then the ' +
      '[CDS service](/guide/cds-service) an EHR can call without embedding anything.',
  },
  {
    key: 'spec',
    reader: 'If you are reviewing the specification',
    text:
      'The [published HL7 FHIR Implementation Guide](ig) holds the profiles, value sets and ' +
      'questionnaires that everything above is built from.',
  },
]

/**
 * The three steps, at a glance. Each card is deliberately one claim long, and
 * the long form lives on `/guide/why-spier` — the point of the grid is that a
 * reader can hold all three in their head without reading any of them.
 * Wording is kept in step with `ig/input/pagecontent/how-to-read.md`, which is
 * the canonical statement of this model.
 */
export const OVERVIEW_STEPS = [
  {
    key: 'capture',
    name: 'Capture',
    lead: 'Validated tools live on paper and in PDFs.',
    body: 'SPiER turns each one into a single canonical FHIR shape, so it is recorded identically in every system that uses it.',
  },
  {
    key: 'translate',
    name: 'Translate',
    lead: 'Different sites use different tools.',
    body: 'SPiER defines a shared risk concept that every tool maps into, so a receiving system can act on a result without running the same tool.',
  },
  {
    key: 'act',
    name: 'Act',
    lead: 'The response protocols already exist, but cannot fire on their own.',
    body: 'SPiER encodes them as executable logic so the right next step surfaces at the right moment. SPiER recommends; the clinician decides.',
  },
] as const

export const OVERVIEW_SECTIONS: OverviewSection[] = [
  {
    // The one instruction, and the only call to action on the page. It is first
    // because the fastest way to understand SPiER is to watch it run, and
    // because every previous ordering put a reader through the argument before
    // offering them the demonstration.
    id: 'start',
    heading: 'See it running, in about ten minutes',
    blocks: [
      {
        kind: 'lead',
        text:
          'The quickest way to understand SPiER is to watch it work inside a chart. Open the Demo ' +
          'EHR, pick one of these three patients, and press *Launch SPiER*.',
      },
      { kind: 'demo' },
      {
        // ⚠️ **The site's ONE statement of this caveat, and it is deliberately
        // quiet.** `data/surfaces.ts` records why the claim is load-bearing and
        // must survive: a host written and run by this project proves the app
        // behaves as a guest, not that it interoperates. The audit found the
        // same sentence on four pages, set at the same weight as the
        // instruction it followed (§3, §5 rule 2) — so it is stated once, here,
        // under the instruction rather than in front of it.
        kind: 'note',
        text:
          'The Demo EHR is run by the same project as the app it launches. That shows SPiER ' +
          'behaves correctly as a guest — not that it works against a server nobody here controls.',
      },
    ],
  },
  {
    id: 'next',
    heading: 'Where to go next',
    blocks: [{ kind: 'doors' }],
  },
  {
    id: 'how-it-works',
    heading: 'What SPiER does to a tool',
    modifier: 'steps',
    blocks: [
      { kind: 'steps' },
      {
        kind: 'note',
        text:
          '[Why SPiER](/guide/why-spier) takes each of the three steps in turn, and explains how ' +
          'the guide, the Demo EHR, the CDS service and the specification fit together.',
      },
    ],
  },
]
