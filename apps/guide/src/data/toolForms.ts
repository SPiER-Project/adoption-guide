import { TOOLS, type Tool } from '@spier/core/data/catalog'
import { isToolViewSlug } from '@spier/tool-views/data/toolViews'
import { launchSlug } from '@spier/tool-views/lib/launchSlug'

/**
 * Which forms a catalogued tool has on THIS surface, and which tool's page a
 * form belongs to.
 *
 * ── The two relations this reconciles ───────────────────────────────────────
 *
 * The guide's Tools section is one page per TOOL (`/guide/tools/TL-0NN`,
 * `pages/ToolPage.tsx`) since 2026-09-20 — 40 pages, one per catalogue entry,
 * keyed by the tool id the IG publishes as `ActivityDefinition.identifier`.
 * The 29 shared views in `TOOL_VIEWS` are keyed by the last segment of a
 * catalog LAUNCH PATH. Those two keys are many-to-many, and neither side can
 * be derived from the other (docs/internals/tool-views.md §5.3):
 *
 *     4 tools → 1 form    TL-036 / 039 / 040 / 041  →  safety-tasks
 *     2 tools → 1 form    TL-031 / 034              →  follow-up-appointment
 *     2 tools → 1 form    TL-033 / 035              →  outreach
 *     1 tool  → 3 forms   TL-020 (CAMS SSF-5)       →  cams-section-a / -b / -outcome-disposition
 *     8 tools → no form   TL-026 / 028 / 029 / 037 / 044 / 045, and the two
 *                         dashboard tools whose launch path is the caseload's
 *
 * So `toolForms(tool)` reads the relation off the catalog's own launch
 * actions — the same declaration `check:catalog` resolves against the clinical
 * route table — filtered to the slugs `TOOL_VIEWS` actually renders, and
 * `toolForFormSlug` inverts it once, at module scope, for the views that name
 * another view by slug (`LaunchLink`, a mapper's suggested next step).
 *
 * ⚠️ **A shared form's page is the FIRST tool's in catalog order, and that is
 * a guess stated rather than a rule discovered.** Four tools launch
 * `safety-tasks`; a recorder that says "escalate this case" names the form,
 * not the tool, and no field in the catalog says which of the four it meant.
 * Catalog order (stage, then core before optional, then id) puts the outreach
 * recorder's escalation link on TL-036, the follow-up escalation workflow,
 * which is the right page for that sentence — and every tool page lists the
 * other tools its form records, so a reader who landed on a sibling is one
 * click from the one they wanted. The clinical surface has no such choice to
 * make: its `launchHref` is the launch path itself.
 *
 * ⚠️ **Nothing here is a route literal**, so `check:surface-links` cannot see
 * these links; it walks the `to="/…"` and `…href: '/…'` forms. What pins them
 * instead: every tool id renders a page by construction (`ToolPage` looks the
 * id up in the same catalog this reads), and `PatientJourney.test.tsx` asserts
 * one link per catalogued tool resolves to that page's route shape.
 */
export interface ToolForm {
  /** The `TOOL_VIEWS` key — the last segment of the catalog launch path. */
  slug: string
  /** The catalog's label for that launch action, as the form picker shows it. */
  label: string
}

/**
 * The forms a tool's launch actions resolve to on the guide, in catalog order,
 * each slug once. Empty for a tool with no launch action, and for one whose
 * launch path is a page the guide does not render (the measure dashboard).
 */
export function toolForms(tool: Tool): ToolForm[] {
  const seen = new Set<string>()
  const forms: ToolForm[] = []
  for (const action of tool.launchActions) {
    const slug = launchSlug(action.path)
    if (!slug || seen.has(slug) || !isToolViewSlug(slug)) continue
    seen.add(slug)
    forms.push({ slug, label: action.label })
  }
  return forms
}

/** Every tool whose forms include `slug`, in catalog order. */
export function toolsSharingForm(slug: string): Tool[] {
  return TOOLS.filter((tool) => toolForms(tool).some((f) => f.slug === slug))
}

/** slug → the tool whose page renders that form. First in catalog order — see the header. */
const TOOL_BY_FORM_SLUG = new Map<string, Tool>()
for (const tool of TOOLS) {
  for (const form of toolForms(tool)) {
    if (!TOOL_BY_FORM_SLUG.has(form.slug)) TOOL_BY_FORM_SLUG.set(form.slug, tool)
  }
}

export function toolForFormSlug(slug: string): Tool | undefined {
  return TOOL_BY_FORM_SLUG.get(slug)
}

/** The guide's page for a catalogued tool. */
export function guideToolHref(toolId: string): string {
  return `/guide/tools/${toolId}`
}

/**
 * The guide's page for a form, or `null` when no tool's page renders it. A
 * tool with several forms gets the one asked for selected by `?form=`, which
 * `ToolPage` reads; a tool with one form needs no query.
 */
export function guideFormHref(slug: string): string | null {
  const tool = toolForFormSlug(slug)
  if (!tool) return null
  const href = guideToolHref(tool.id)
  return toolForms(tool).length > 1 ? `${href}?form=${slug}` : href
}
