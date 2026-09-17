import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `TOOL_VIEWS` is read by two callers that cannot see each other: `App.tsx`'s
 * `/patient/assessments/*` and `/patient/workflow/*` routes, which look up a
 * literal key, and `/guide/tools/:slug/try`, which looks up whatever is in the
 * URL. A key present for one and not the other is a blank page, and TypeScript
 * cannot catch it — `Record<string, ReactNode>` is happy with a missing key and
 * the route elements are string literals.
 *
 * ⚠️ **Reads both files as TEXT rather than importing the map**, and that is a
 * deliberate trade rather than laziness. Importing `toolViews.tsx` pulls in the
 * questionnaire registry, the care-plan mappers and the whole tool catalog —
 * which means the generated FHIR tree, which means this test could only run
 * after a 30-second SUSHI compile. The question here is purely structural: do
 * two lists of string literals agree. `web/scripts/lib/route-table.mjs` makes
 * the same trade for the same reason, and documents it.
 */
const here = __dirname
const APP_TSX = readFileSync(resolve(here, '../App.tsx'), 'utf8')
const TOOL_VIEWS_TSX = readFileSync(resolve(here, 'toolViews.tsx'), 'utf8')

/** Every `<Route path="assessments/x" element={TOOL_VIEWS['y']} />` in App.tsx. */
function routeLookups(): { path: string; key: string }[] {
  const re = /<Route path="(assessments|workflow)\/([\w-]+)" element=\{TOOL_VIEWS\['([\w-]+)'\]\} \/>/g
  return [...APP_TSX.matchAll(re)].map(m => ({ path: `${m[1]}/${m[2]}`, key: m[3] }))
}

/** Every key defined in the TOOL_VIEWS object literal. */
function definedKeys(): string[] {
  const body = TOOL_VIEWS_TSX.slice(
    TOOL_VIEWS_TSX.indexOf('export const TOOL_VIEWS'),
    TOOL_VIEWS_TSX.indexOf('/** Is `slug` something'),
  )
  // Keys are quoted and start a line; the values are JSX containing colons, so
  // anchoring to the line start is what keeps this from matching inside one.
  return [...body.matchAll(/^\s{2}'([\w-]+)':/gm)].map(m => m[1])
}

describe('TOOL_VIEWS', () => {
  it('is read by App.tsx, and defines keys at all', () => {
    // The tripwire for every assertion below: if either form changes and a
    // regex stops matching, the comparisons would pass over empty lists —
    // exactly the "green while checking nothing" failure this repo keeps
    // catching. Floors, not exact counts, so adding a tool does not fail here.
    expect(routeLookups().length).toBeGreaterThanOrEqual(25)
    expect(definedKeys().length).toBeGreaterThanOrEqual(25)
  })

  it('defines every key App.tsx looks up', () => {
    const defined = new Set(definedKeys())
    expect(routeLookups().filter(r => !defined.has(r.key)).map(r => r.key)).toEqual([])
  })

  it('keys the map by the last segment of the clinician route', () => {
    // The guide's try route is /guide/tools/<slug>/try, and <slug> is this
    // segment. A key that did not match its route's last segment would give the
    // clinician a working form and the implementer "no such tool".
    expect(routeLookups().filter(r => r.path.split('/')[1] !== r.key)).toEqual([])
  })

  it('defines no view that no route renders', () => {
    // A view nothing routes to is either a dead definition or a route deleted
    // without its element.
    const routed = new Set(routeLookups().map(r => r.key))
    expect(definedKeys().filter(k => !routed.has(k))).toEqual([])
  })

  it('defines each key exactly once', () => {
    const keys = definedKeys()
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('isToolViewSlug', () => {
  it('guards against inherited Object properties', () => {
    // `TOOL_VIEWS` is an object literal, so a bare `slug in TOOL_VIEWS` would
    // answer yes for 'toString' and hand ToolTryIt a function to render. The
    // behavioural version of this needs the generated FHIR tree to import the
    // module (see the note at the top), so the guard is pinned by shape.
    expect(TOOL_VIEWS_TSX).toContain('Object.prototype.hasOwnProperty.call(TOOL_VIEWS, slug)')
    expect(TOOL_VIEWS_TSX).not.toMatch(/return\s+slug\s+in\s+TOOL_VIEWS/)
  })
})
