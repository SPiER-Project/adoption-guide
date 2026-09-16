/**
 * The build surface — the third axis beside chrome mode and data source
 * (docs/plans/surfaces-and-distribution.md §3): what a build *contains*.
 *
 *   demo      everything — the Adoption Guide lenses, both SMART apps, the
 *             bundled demo population. What the public site serves.
 *   clinical  the two SMART apps only. No guide routes are registered, and
 *             `@spier/demo-population` resolves to an empty shim (see
 *             vite.config.ts), so no synthetic patient is compiled in. A
 *             clinician inside a client's EHR can never reach a caseload
 *             containing Jane Doe — that, not bundle weight, is the reason
 *             this axis exists.
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
