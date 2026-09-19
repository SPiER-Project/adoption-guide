/**
 * The build surface — the third axis beside chrome mode and data source
 * (docs/plans/surfaces-and-distribution.md §3): what a build *contains*.
 *
 *   demo      the Adoption Guide: the case, the pathway, the Data Dictionary
 *             and the tool fillers. What the public site serves.
 *   clinical  the two SMART apps only. No guide routes are registered.
 *
 * ⚠️ **Neither surface carries the demo population any more (2026-09-19).** The
 * guide used to ship the two SMART apps AND the 14 synthetic patients so a
 * workflow could be walked with no host running. It no longer does: the chart
 * experience belongs to the mock EHR, which is live and is what the sidebar's
 * "Try it" already points at. The guide keeps the *instrument* fillers, which
 * need no population — `packages/tool-views` carries its own single
 * `DEMO_PATIENT`, and an unseeded store is exactly the blank "play with forms"
 * state. So the axis is now about WHICH APP, not about who is compiled in.
 *
 * `import.meta.env.VITE_SURFACE` is replaced with a literal at build time, so
 * both constants fold: a `IS_DEMO && …` route block and a
 * `IS_DEMO ? lazy(…) : …` page loader disappear from the clinical bundle
 * rather than shipping dark. `scripts/check-surface.mjs` builds both surfaces
 * and asserts that from the output — never from this file.
 */
export type Surface = 'demo' | 'clinical'

export const SURFACE: Surface = import.meta.env.VITE_SURFACE === 'clinical' ? 'clinical' : 'demo'

export const IS_DEMO = SURFACE === 'demo'

/**
 * The complement, named rather than written `!IS_DEMO` at each site.
 *
 * ⚠️ It exists because the flag now folds in BOTH directions: the guide build
 * drops the clinical pages exactly as the clinical build drops the guide's.
 * A `!IS_DEMO ? lazy(…)` reads as a negation to skim past; this reads as the
 * claim it is, and `check-surface.mjs` asserts both directions from the two
 * bundles rather than from this file.
 */
export const IS_CLINICAL = SURFACE === 'clinical'
