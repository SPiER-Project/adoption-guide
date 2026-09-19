import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * What is left here is the half of the old suite that is about THIS FILE.
 *
 * ⚠️ **The other half became `npm run check:tool-view-routes`**, and the reason
 * is the `apps/` split rather than tidiness. Those assertions compared this map
 * against `../App.tsx` — one route table, reached by a relative path from a test
 * sitting beside the map. Both premises are gone: the map is now a package, and
 * the split turns one route table into one per app. A relative `../App.tsx` is
 * not merely wrong from here, it is **the wrong shape** — it can only ever check
 * one table, and the invariant is every table. The gate iterates the declared
 * app roots instead, so a second app's routes are checked the day it exists.
 *
 * ⚠️ **Reads the file as TEXT rather than importing the map**, and that is a
 * deliberate trade rather than laziness. Importing `toolViews.tsx` pulls in the
 * questionnaire registry, the care-plan mappers and the whole tool catalog —
 * which means the generated FHIR tree, which means this test could only run
 * after a 30-second SUSHI compile. The questions here are purely structural.
 */
const TOOL_VIEWS_TSX = readFileSync(resolve(__dirname, 'toolViews.tsx'), 'utf8')

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
  it('defines keys at all', () => {
    // The tripwire for the assertion below: if the object literal's form changes
    // and the regex stops matching, a comparison over an empty list would pass —
    // exactly the "green while checking nothing" failure this repo keeps
    // catching. A floor, not an exact count, so adding a tool does not fail here.
    expect(definedKeys().length).toBeGreaterThanOrEqual(25)
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
