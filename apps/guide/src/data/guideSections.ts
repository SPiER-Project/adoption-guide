// Single source of truth for the Adoption Guide's sections. The sidebar's
// /guide children, the AdoptionGuide page header/title, and its prev/next pager
// all derive from this ordered list, so they can never drift out of sync.
//
// The matching routes are declared in App.tsx (each section maps to its own
// lazy-loaded page component); keep the `path` values here aligned with those
// route paths under /guide.
//
// Sections are additionally bucketed into GUIDE_GROUPS, because they are not
// all the same kind of thing. The sidebar renders a heading per group and the
// page header names the active section's group.
//
// ⚠️ **There were TWO groups until 2026-09-17, and 'Learn' held six sections
// that answered two different questions.** Three of them define what SPiER IS —
// the protocol, the catalogue of instruments, the data contract — and three are
// SURFACES that run it. A reader met six undifferentiated rows and could not
// tell which was which. The split is 'standard' / 'applications' / 'evaluate',
// in that reading order: what SPiER defines, what runs it, where you stand.
//
// ⚠️ **No section here writes state ANOTHER SURFACE READS, and that is the
// invariant the groups encode.** The one that did — Tool Configuration — left
// for /settings on 2026-09-15. A new section that writes state another surface
// reads does not belong in this list; it belongs in the app that owns that
// state. Read the rule precisely: Adoption Rubric persists its scores to
// localStorage and is still here, because nothing else reads them. See the
// note on the 'evaluate' group for why that is a standing question rather
// than a settled one.
//
// ⚠️ The flat order below must stay grouped-contiguous — all of one group's
// sections together, in GUIDE_GROUPS order. The pager walks this list linearly,
// so an out-of-place section would make prev/next bounce between groups.

/** Ordered categories the sections fall into. */
export type GuideGroupId = 'standard' | 'applications' | 'evaluate' | 'reference'

export interface GuideGroup {
  id: GuideGroupId
  /** Heading shown above the group's sections in the sidebar. */
  label: string
}

/** Reading order of the groups, top to bottom. */
export const GUIDE_GROUPS: GuideGroup[] = [
  // What an implementer builds AGAINST. All three are published artifacts or
  // direct renderings of them, so nothing here changes when a surface does.
  { id: 'standard', label: 'The standard' },
  // What RUNS the standard. Two SMART apps and one hosted endpoint — an EHR
  // that embeds neither app can still call the service and render the same
  // cards, which is why the CDS service is a peer here and not a footnote.
  { id: 'applications', label: 'The applications' },
  // ⚠️ There was a group called 'Configure', and it is gone rather than
  // empty (2026-09-15). It held two sections that were not the same kind of
  // thing: Tool Configuration, which had side effects on another surface, and
  // CDS Service, which configures nothing and is pure reference. The first
  // moved to /settings in the SMART app that owns the tool catalog; the second
  // is now in 'The applications', beside the two apps it is a peer of. What
  // emptied the group is the 2026-09-09 boundary finally being applied here:
  // the guide explains and hosts — it does not configure.
  //
  // ⚠️ **'Evaluate' is down to one section and that is not an oversight.**
  // Adoption Readiness left for /guide/tools/readiness on 2026-09-17 (it is a
  // view of the catalogue — see the subsection below). What is left is the
  // rubric, and it is the one section here that WRITES state: it persists
  // scores to localStorage. That makes it the odd one out against the
  // read-only invariant above, and it is the standing argument for the rubric
  // becoming its own surface beside /settings rather than a guide page. Not
  // acted on, because where those answers live is a product question: browser
  // storage does not survive a laptop, and a readiness score is something an
  // adopter shares with a vendor.
  { id: 'evaluate', label: 'Evaluate' },
  // Background: the argument for SPiER, read once and rarely returned to. It
  // holds one section today, and that is the honest state rather than a
  // placeholder — the adoption-guide UX audit
  // (docs/plans/adoption-guide-ux-audit-2026-09-20.md §4.5) proposes moving the
  // Data Dictionary, Adoption Readiness and the Adoption Rubric in beside it,
  // which is a later PR because it changes where three published paths sit in
  // the sidebar. Last, because it is what a reader reaches for after the
  // pathway, the tools and the apps rather than before them.
  { id: 'reference', label: 'Reference' },
]

export interface GuideSection {
  /** Route segment under /guide, e.g. 'tools' → /guide/tools. */
  path: string
  /** Label shown in the sidebar, the page title, and the pager. */
  label: string
  /** Which GUIDE_GROUPS bucket this section belongs to. */
  group: GuideGroupId
  /**
   * Which of the two page-width tokens the guide renders this section at.
   *
   * The guide is one layout with one header, so `.implementation-guide` owns
   * the page width for every sub-page and a sub-page may not declare its own —
   * `check:template` RULE 5a forbids it, because seven of them used to, at five
   * different widths, and the pager walked a reader through all five.
   *
   * That single owner still has to serve two kinds of content. A routes table
   * wants every pixel; a page of prose and curl commands does not, and giving
   * it 1200px anyway is what read as "the paragraphs are too thin": prose is
   * capped at a reading measure of ~80 characters (`--measure-prose`), which
   * fills ~68% of a 900px column and only ~48% of a 1200px one. The measure is
   * right at both — the page width is what is wrong. So the width stays the
   * layout's to set, and this says which token to set it to.
   *
   * ⚠️ **Required, with no default, deliberately.** A new section has to make
   * the choice at the point of being added rather than inherit whichever value
   * happened to be commonest. And the two mistakes are not symmetrical: `wide`
   * on a prose page is invisible — it just looks slightly wrong forever —
   * while `prose` on a page with a table shows up immediately as a scrollbar
   * the author cannot miss. When it is genuinely unclear, `prose` is the guess
   * that reports its own error.
   *
   * `wide` is earned by content that needs the room — a table, a fixed
   * multi-column grid — never by a page merely being long.
   */
  width: 'prose' | 'wide'
  /**
   * Pages that live UNDER this section: reachable from it, but not a sidebar
   * row and not a pager step.
   *
   * ⚠️ **Declared here for the gates, not for the sidebar.**
   * `check:guide-boundary` derives the guide's whole page set by parsing every
   * `path:` in this file, and `check:catalog` asserts each one resolves to a
   * registered route. A page under `/guide` that is NOT named here is
   * unchecked by both — CLAUDE.md flags exactly that hole ("a hand-rolled
   * route outside the list would be unchecked"). So a subsection is declared
   * even though nothing renders this array. `resolveGuidePath` does read it,
   * to give the page its drill-in header.
   *
   * ⚠️ `path` is the FULL sub-path under `/guide`, e.g. `tools/readiness` and
   * never `readiness`. Both gates build `/guide/${path}`, so a bare segment
   * would assert against `/guide/readiness`, which is not a route.
   *
   * A subsection has no `width`: it inherits its owning section's, because the
   * guide layout owns the width for every page under it and a sub-page root
   * may not declare one (`check:template` RULE 5a).
   */
  subsections?: { path: string; label: string }[]
}

/**
 * Reading order of the guide, top to bottom. Grouped-contiguous — see above.
 *
 * 'overview' is deliberately absent. It used to open the Learn group, but it
 * merged with the old standalone front door and moved up to the top-level
 * /overview lens, so it is no longer a section of the guide. /guide and
 * /guide/overview both still resolve — see the routes in App.tsx.
 */
export const GUIDE_SECTIONS: GuideSection[] = [
  // ── The standard ────────────────────────────────────────────────────────
  // What SPiER defines and an implementer builds against. All three render
  // published artifacts or the contract over them, so nothing here changes
  // when a surface does.
  //
  // Care Pathway and Tools are two surfaces because they answer two questions
  // that were previously answered by one page. Care Pathway is the *protocol*:
  // it renders PlanDefinition/SPiERSuicideSaferCarePathway — screen, gate,
  // assess, branch by tier — from the published artifact, so what the page says
  // and what SPiER publishes cannot drift. Tools is the *catalogue*: which
  // instruments and recorders exist, grouped by the eight pathway stages, with
  // launch paths into the provider app.
  //
  // ⚠️ `pathway` is a REPURPOSED path, not a new one. It served the tool
  // catalogue until Phase 3 of docs/plans/suicide-safer-care-pathway.md; the
  // catalogue moved to `tools` and `/guide/pathway#stage-…` deep links are
  // forwarded there by CarePathway.tsx. Since 2026-09-20 the path is the
  // EXPLAINER — what a pathway does, plus the simulator — and the rendered
  // artifact is its subsection below.
  // `wide`: the tier table is four columns at a 44rem floor and scrolls in
  // its own box below that. It is also the same rendered protocol as
  // /patient/pathway (PathwayProtocol.tsx), which is `wide` as its own route —
  // one artifact should not change measure with the chrome. The explainer at
  // /guide/pathway is prose, and caps every run at the reading measure instead
  // (2026-09-20, adoption-guide UX audit §4.2 decision (b): keep the section
  // wide rather than make the protocol page a sidebar row or let a
  // subsection choose its own width — the only option that touched neither
  // the sidebar nor check:template RULE 5a).
  //
  // ⚠️ **The published protocol is a SUBSECTION here, for the same reason
  // Adoption Readiness is one under Tools.** /guide/pathway says what a
  // suicide-safer care pathway does and lets a reader try one against the
  // tier table; /guide/pathway/protocol is the same artifact rendered in full
  // — spine, gates, pending definitions, provenance, JSON — for the
  // implementer. A second view of one section, reached by one link from the
  // explainer and not a pager step. It is the one page in the guide that says
  // "rendered from the published PlanDefinition" (audit §5 rule 5).
  {
    path: 'pathway',
    label: 'Care Pathway',
    group: 'standard',
    width: 'wide',
    subsections: [{ path: 'pathway/protocol', label: 'The published protocol' }],
  },
  // `wide`: two catalogue tables.
  //
  // ⚠️ **Adoption Readiness is a SUBSECTION here, not a sibling, and that is
  // not a filing preference.** pages/AdoptionReadiness.tsx imports `TOOLS` and
  // `groupToolsByStage` from the catalog and renders one row per catalogued
  // instrument; its own header comment says "Data is reused, not duplicated:
  // everything here comes from the catalog." It is a second VIEW of this
  // section — scored by build status, inclusion status and target maturity —
  // so it belongs under the thing it is a view of. It was a top-level
  // 'Evaluate' section until 2026-09-17. `/guide/adoption-readiness` still
  // redirects, and so does `/guide/roadmap`, which pointed at it.
  //
  // ⚠️ **The tool page is a PARAMETERISED subsection, and it is declared for
  // the gates alone.** `/guide/tools/TL-0NN` (pages/ToolPage.tsx, 2026-09-20)
  // is one page per catalogued tool — the form in front, the detail behind —
  // registered as a SIBLING of the guide layout because it draws its own
  // header. Naming it here with its full sub-path is what makes it CHECKED:
  // check:guide-boundary resolves the component through the route table and
  // walks its imports, and check:catalog asserts the route pattern is
  // registered. Both gates accept the sibling's absolute `/guide/…` form.
  // `resolveGuidePath` never matches a `:param` literally and falls back to
  // this section for `/guide/tools/TL-003`, which is right — but the tool
  // page is outside the layout and never asks. The label is a placeholder for
  // the same reason: nothing renders it.
  {
    path: 'tools',
    label: 'Tools',
    group: 'standard',
    width: 'wide',
    subsections: [
      { path: 'tools/readiness', label: 'Adoption Readiness' },
      { path: 'tools/:toolRef', label: 'Tool' },
    ],
  },
  // `wide`: four tables, the widest being the per-concept routes table whose
  // whole purpose is comparing routes side by side.
  { path: 'data-dictionary', label: 'Data Dictionary', group: 'standard', width: 'wide' },

  // ── The applications ────────────────────────────────────────────────────
  // What RUNS the standard. The two apps the guide HOSTS, plus the endpoint an
  // EHR can call instead of embedding either — three things that walk the same
  // pathway, which is why they are one group rather than two apps and a
  // footnote.
  //
  // ⚠️ The first two are what /patient/chart and /population redirect to,
  // decided 2026-09-09: the guide explains and hosts, the mock EHR holds and
  // launches. Being SECTIONS rather than hand-rolled routes is load-bearing —
  // check:guide-boundary derives the guide's page set from this list, so
  // "an explainer holds no patient data" is gated rather than merely intended.
  //
  // `prose` throughout: paragraphs, lists and curl blocks, no table and no
  // grid, so they are the case the `width` doc comment describes — `wide`
  // would be invisibly wrong, and every text run is already capped at the
  // reading measure. The CDS page was the clearest case of the 48% problem
  // that field exists to fix.
  //
  // ⚠️ **`provider-app` was `patient-app` until 2026-09-17, and the rename is
  // about the USER, not the subject.** A clinician launches it from a patient's
  // chart; the patient is what it is *about*. Naming it for its subject made it
  // read as something a patient opens, and it occupied the name the genuinely
  // patient-facing app would want if one is ever built. `/guide/patient-app`
  // stays as a redirect — it was published and is what /patient/chart pointed
  // at. ⚠️ The "patient app" in repo-and-package-boundaries.md and
  // licensing-verification-backlog.md means that FUTURE patient-facing app and
  // is deliberately not renamed.
  { path: 'provider-app', label: 'Provider App', group: 'applications', width: 'prose' },
  { path: 'dashboard', label: 'Population Dashboard', group: 'applications', width: 'prose' },
  // The THIRD thing that runs the pathway. It was filed under "Configure"
  // until 2026-09-15, which misread it — the page configures nothing, it is
  // prose, four curl blocks and a read-only probe of the live discovery
  // document. Under 'Learn' until 2026-09-17, which filed it beside the
  // reference material rather than beside its two peers.
  { path: 'cds-service', label: 'CDS Service', group: 'applications', width: 'prose' },

  // ── Evaluate ────────────────────────────────────────────────────────────
  // 'measures' is deliberately absent. It moved to the EHR side as
  // /population/measures (step D, #391): it was the one guide section that read
  // patient data, and measures over a caseload belong beside the caseload —
  // which is also where they would sit in a real deployment. /guide/measures
  // still redirects, because it is a published tool launch path.
  //
  // `wide`: the rubric is an auto-fit grid of stage columns, and more columns
  // visible at once is the point of scoring against it.
  { path: 'adoption-rubric', label: 'Adoption Rubric', group: 'evaluate', width: 'wide' },

  // ── Reference ───────────────────────────────────────────────────────────
  // ⚠️ **This page is where the Overview's essays went, not new writing.** The
  // front door stated Capture → Translate → Act three times, gave the four
  // surfaces five paragraphs and then four cards repeating them, and ran 1,716
  // words before a reader reached a link (audit §3, §4.1). The argument was
  // worth keeping and the front door was the wrong place for it.
  //
  // ⚠️ The model itself is canonical in the IG's how-to-read page, which is
  // what `OVERVIEW_STEPS` is kept in step with. This page is the same model for
  // a reader who has not opened a specification; when they disagree, the IG
  // wins.
  //
  // `prose`: paragraphs, one stage list and one callout — no table, no grid.
  { path: 'why-spier', label: 'Why SPiER', group: 'reference', width: 'prose' },
]

const GUIDE_BASE = '/guide'

/** Absolute HashRouter path for a guide section. */
export function guideHref(path: string): string {
  return `${GUIDE_BASE}/${path}`
}

/** Display label for a group id, for the page header's eyebrow. */
export function guideGroupLabel(id: GuideGroupId): string {
  return GUIDE_GROUPS.find(g => g.id === id)?.label ?? id
}

/**
 * What the guide layout should render for a path under `/guide`.
 *
 * Returns the owning `section` — which decides the width, the group eyebrow and
 * the pager's neighbours — plus the `subsection` when the path names one. A
 * subsection is a page of its section, so the pager treats it as though the
 * reader were on the section itself rather than as a step of its own.
 *
 * ⚠️ **Matches the LONGEST path first, and that is load-bearing.**
 * `tools/readiness` and `tools` both prefix-match `/guide/tools/readiness`; a
 * first-match-wins loop over `GUIDE_SECTIONS` would resolve it to Tools and the
 * subsection would never be seen. Subsections are therefore checked before
 * sections, not alongside them.
 *
 * `undefined` for a path that names no section — the layout falls back to the
 * first section, as it did when `/guide` itself rendered a titleless header.
 */
export function resolveGuidePath(
  path: string,
): { section: GuideSection; subsection?: { path: string; label: string } } | undefined {
  // Everything under /guide, with the leading and trailing slashes gone.
  const rest = path.replace(/^\/guide\/?/, '').replace(/\/$/, '')
  if (!rest) return undefined
  for (const section of GUIDE_SECTIONS) {
    for (const sub of section.subsections ?? []) {
      if (sub.path === rest) return { section, subsection: sub }
    }
  }
  // A section matches on its FIRST segment, so a deep link the guide does not
  // know about (a stage anchor) — or a parameterised subsection, which the
  // literal comparison above can never match — still renders its section's
  // chrome rather than falling back to the first section in the list.
  const segment = rest.split('/')[0]
  const section = GUIDE_SECTIONS.find(s => s.path === segment)
  return section ? { section } : undefined
}
