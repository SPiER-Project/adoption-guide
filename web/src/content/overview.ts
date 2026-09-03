/**
 * The Overview page's narrative, as data.
 *
 * ─── Why a TypeScript module and not Markdown ────────────────────────────────
 *
 * The alternative considered (task C4 of docs/plans/docs-and-ig-content-consolidation.md)
 * was Markdown imported with Vite's `?raw` and rendered by a small renderer.
 * A typed module wins here for one reason that matters more than authoring
 * comfort: `tsc` and eslint stay pointed at the content. A section that loses
 * its heading, a block whose `kind` is misspelled, a lens card missing its
 * `href` — all of those are build failures rather than a page that renders
 * wrong at runtime. A `?raw` string is opaque to both tools, and this content
 * carries in-app routes that must keep resolving.
 *
 * It follows `data/guideSections.ts`, which is this repo's model for making one
 * ordered data file the thing everything else derives from.
 *
 * ─── The inline-markup convention ────────────────────────────────────────────
 *
 * Deliberately five rules and no more, rendered by `renderInline` in
 * `pages/Overview.tsx`:
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
 * ⚠️ The three `kind`s with no text of their own — `steps`, `pathway`,
 * `lenses` — are placements, not content. `pathway` renders STAGES from the
 * pathway-stage CodeSystem, so the eight stages are never restated here.
 */

/** A block inside a section. `steps`/`pathway`/`lenses` mark where a rendered
 *  component goes; the rest carry prose. */
export type OverviewBlock =
  | { kind: 'prose'; text: string }
  /** The section's opening paragraph, set larger than body prose. */
  | { kind: 'lead'; text: string }
  /** A quieter aside, used for the "this site is the Adoption Guide" pointer. */
  | { kind: 'note'; text: string }
  /** A boxed illustration with its own sub-heading. */
  | { kind: 'vignette'; heading: string; text: string }
  /** The Capture → Translate → Act cards (OVERVIEW_STEPS). */
  | { kind: 'steps' }
  /** The eight pathway stages, read from the catalog. */
  | { kind: 'pathway' }
  /** The "where to go next" cards (OVERVIEW_LENSES). */
  | { kind: 'lenses' }

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

export const OVERVIEW_LEDE =
  'A FHIR-native reference implementation of the suicide-safer care pathway. SPiER’s mission is to ' +
  'make suicide-safer care the standard everywhere — and the tools to do it already exist. ' +
  'Validated screeners, risk assessments, safety plans, and response protocols live on paper, in PDFs, ' +
  'and in plain-text guidelines that no EHR can act on. SPiER makes each layer machine-actionable, ' +
  'shows EHR vendors and health-system admins what a configured implementation looks like, and ' +
  'provides the code to execute on it. The artifacts are free and open to adopt at no cost.'

/**
 * The three steps, at a glance. Each card is deliberately one claim long: the
 * numbered sections below carry the substance, and the point of the grid is
 * that a reader can hold all three in their head before reading any of them.
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

export interface OverviewLens {
  key: string
  /** BEM modifier suffix on the card. */
  variant: string
  badge: string
  title: string
  body: string
  cta: string
  /** An in-app route ("/…"), or the literal `ig` for the published IG. */
  href: string
}

export const OVERVIEW_LENSES: OverviewLens[] = [
  {
    key: 'guide',
    variant: 'guide',
    badge: 'Adopt',
    title: 'Adoption Guide',
    body:
      'How to adopt SPiER and see it running: the care pathway rendered from its published ' +
      'PlanDefinition, a tool catalog across the eight stages, a data dictionary, an ' +
      'adoption-readiness matrix and EHR adoption rubric, and a configurable Tool ' +
      'Configuration that drives the Patient View.',
    cta: 'Explore the guide →',
    href: '/guide/pathway',
  },
  {
    key: 'population',
    variant: 'population',
    badge: 'Demo',
    title: 'Population View',
    body:
      'A behavioral-health counselor’s caseload — 10 sample patients spanning every ' +
      'pathway stage and risk level. Each row surfaces the recommended next step regardless ' +
      'of which specific tools an implementation has enabled.',
    cta: 'Open the caseload →',
    href: '/population',
  },
  {
    key: 'patient',
    variant: 'patient',
    badge: 'Demo',
    title: 'Patient View',
    body:
      'One patient’s chart, organized around the eight-stage pathway: a visual stage tracker, ' +
      'CDS-style next-step recommendation cards, activity grouped by stage, encounter ' +
      'timeline, and a full FHIR document list.',
    cta: 'Open the chart →',
    href: '/patient/chart',
  },
  {
    key: 'ig',
    variant: 'ig',
    badge: 'Specification',
    // Non-breaking space before the external-link arrow, so it never wraps
    // away from the title.
    title: 'Implementation Guide ↗',
    body:
      'The published HL7 FHIR Implementation Guide — the normative spec: profiles, ' +
      'value sets, code systems, and canonical Questionnaires for suicide-safer care.',
    cta: 'Open the HL7 IG →',
    href: 'ig',
  },
]

export const OVERVIEW_SECTIONS: OverviewSection[] = [
  {
    id: 'how-it-works',
    heading: 'How SPiER works',
    modifier: 'steps',
    blocks: [
      {
        kind: 'lead',
        text:
          'Everything that matters in suicide prevention currently lives only in human-readable form — ' +
          'validated screeners on paper, the equivalences between different tools in clinicians’ heads, ' +
          'response protocols in plain-text guidelines. SPiER’s work is to encode each layer so software ' +
          'can act on it, in three steps that build on each other: **Capture → Translate → Act**.',
      },
      { kind: 'steps' },
      {
        kind: 'note',
        text:
          'This site is the **Adoption Guide** — how to adopt SPiER and see it running. For ' +
          'the normative spec — profiles, value sets, and canonical Questionnaires — see the ' +
          '[published HL7 FHIR Implementation Guide](ig).',
      },
    ],
  },
  {
    id: 'capture',
    heading: '1. Capture — make the tools writable',
    blocks: [
      {
        kind: 'prose',
        text:
          'HL7 is the standards body that defines how healthcare data is structured and exchanged (FHIR is ' +
          'their modern standard). National standards like **US Core** and **USCDI** already ' +
          'cover the basics — demographics, diagnoses, medications — but they don’t yet specify *how* ' +
          'suicide screeners, risk assessments, and safety plans should be captured. So today every EHR captures ' +
          'that information a little differently — same questions, different shapes — which makes the ' +
          'data hard to share, hard to measure, and hard to act on. That’s the gap SPiER fills.',
      },
      {
        kind: 'prose',
        text:
          'SPiER translates each tool (the **ASQ**, **Columbia**, ' +
          '**Stanley-Brown**, and others) into a single canonical FHIR shape — a ' +
          '`Questionnaire` and its `QuestionnaireResponse` — so the ' +
          'same instrument is recorded identically everywhere it’s used, and contributes that work to the ' +
          'existing HL7 workgroups already shaping clinical data standards. The path is ' +
          '**draft → test with partners → contribute to HL7 → influence the published standard**, ' +
          'paired with a coalition of provider organizations who can collectively *demand* that consistency ' +
          'from their EHR vendors.',
      },
    ],
  },
  {
    id: 'translate',
    heading: '2. Translate — make different tools mutually intelligible',
    blocks: [
      {
        kind: 'prose',
        text:
          'Partners don’t all use the same instruments — one site screens with the ASQ, another with the ' +
          'Columbia, another with PHQ-9 Item 9 — and a result is useless to a system that can’t read the ' +
          'instrument behind it. SPiER defines an instrument-agnostic **concept layer**: a single ' +
          'common suicide-risk tier (carried on a generic LOINC) that every tool maps *into*, so a receiving ' +
          'system can act on a result **without having to run the same tool that produced it**.',
      },
      {
        kind: 'prose',
        text:
          'This mirrors the approach HL7’s **Gravity Project** took for social-determinants ' +
          'screening. The derived concept is screening-level and *unconfirmed* — it flags a need for ' +
          'follow-up, not a diagnosis — and is always linked back to the full-fidelity capture layer it came ' +
          'from. It is also SPiER’s most contributable standards artifact.',
      },
    ],
  },
  {
    id: 'act',
    heading: '3. Act — make the response protocols executable',
    blocks: [
      {
        kind: 'prose',
        text:
          'The clinical response to a positive screen already exists as written, endorsed guidelines — they ' +
          'just can’t fire on their own. SPiER encodes them as executable logic (`PlanDefinition` ' +
          'plus CDS Hooks) so the right next step surfaces at the right moment: an acute positive ASQ prompts a ' +
          'safety evaluation and a safety plan, a transition prompts a caring-contact follow-up.',
      },
      {
        kind: 'prose',
        text:
          'This is the frontier of SPiER’s work — and notably an *encoding* problem rather than a ' +
          '*consensus* problem, because the protocol content is already settled. Throughout, ' +
          '**SPiER recommends; the clinician (or the institution’s configured policy) decides.**',
      },
    ],
  },
  {
    // Two vocabularies run through this app and they are easy to mistake for
    // competing taxonomies. They are orthogonal: Capture/Translate/Act is the
    // artifact axis (canonical in the IG's how-to-read page), the eight stages
    // are the clinical axis (canonical in the pathway-stage CodeSystem, via
    // FSH). Navigation follows the clinical axis, so say so once, here, rather
    // than leaving a reader to reconcile them.
    id: 'axes',
    heading: 'How that maps to what you see in this app',
    blocks: [
      {
        kind: 'prose',
        text:
          '**Capture → Translate → Act** describes what SPiER does to the ' +
          '*artifacts*. It is not what you navigate by. The app is organized around the thing a ' +
          'clinician actually moves through — the **eight-stage Suicide Safer Care Pathway**, ' +
          'which is the common entry point for every partner conversation and the vocabulary used by the ' +
          'Patient View, the Population View, and the Measures dashboard:',
      },
      { kind: 'pathway' },
      {
        kind: 'prose',
        text:
          'Every stage is a place a patient can be. Each of the three steps above cuts across all eight of ' +
          'them — a stage needs its instruments captured, its results translated, and its next action ' +
          'made executable. Start with the ' +
          '[Care Pathway](/guide/pathway) for the protocol itself — rendered from the ' +
          'published PlanDefinition — the [Tools](/guide/tools) catalog for the ' +
          'stage-by-stage instrument detail, or the ' +
          '[Adoption Readiness matrix](/guide/adoption-readiness) to see where each instrument ' +
          'stands today — what’s built, what its licensing requires, and how deeply it integrates.',
      },
    ],
  },
  {
    id: 'portability',
    heading: 'Why it matters: portability across care transitions',
    blocks: [
      {
        kind: 'prose',
        text:
          'A patient at risk of suicide moves through a lot of hands: ED, inpatient, outpatient, primary care, ' +
          'crisis line, community provider. Right now, the safety plan and risk assessment too often stay behind ' +
          'with the system that created them. EHRs hold the data; **Health Information Exchanges move it ' +
          'between organizations** — but exchange is only meaningful once the data is captured in a ' +
          'standard shape, translated into a concept any system can read, and tied to a clear next action.',
      },
      {
        kind: 'prose',
        text:
          'When all three come together, ' +
          '**the patient’s safety information becomes available wherever they show up next — not just ' +
          'locked in the chart that first created it.**',
      },
      {
        kind: 'vignette',
        heading: 'A concrete example',
        text:
          'A patient is screened with the **ASQ** in an emergency department, assessed with the ' +
          '**Columbia Scale**, and discharged with a **Stanley-Brown Safety Plan**. Forty-eight ' +
          'hours later, they’re seen by an outpatient clinician at a different organization. Today, ' +
          'that clinician usually starts from scratch — re-screens, re-asks, re-builds the plan. ' +
          'With SPiER’s work in place, the clinician can see what’s already been done — what screener, ' +
          'what risk level, what coping strategies and supports the patient already identified — and ' +
          'pick up where the ED left off.',
      },
      {
        kind: 'prose',
        text:
          'The same standardized data also gives systems a foundation for measuring whether the pathway is ' +
          'working — a path to quality improvement at the population level.',
      },
    ],
  },
  {
    id: 'next',
    heading: 'Where to go next',
    blocks: [{ kind: 'lenses' }],
  },
]
