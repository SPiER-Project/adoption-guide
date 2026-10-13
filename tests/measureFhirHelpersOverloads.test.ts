/**
 * The measure library calls each FHIRHelpers function through ONE overload.
 *
 * The IG Publisher's Measure narrative lists every function a measure's logic
 * uses and anchors each entry by library and function NAME — not signature. So
 * a measure that reaches two overloads of one function (FHIRHelpers has a
 * `ToString` per FHIR primitive and code type) renders two entries under one
 * anchor: "The html source has duplicate anchor Ids" on the page and "The XHTML
 * … contains more than one node for each of the following node ids" on the
 * narrative. Until 2026-10-13 that was 14 warnings across all 7 Measures, from
 * 2 overloads of `ToDateTime` and 7 of `ToString`.
 *
 * Nearly all of those calls were IMPLICIT: comparing a FHIR status to a string
 * (`A.status = 'fulfilled'`) or testing a FHIR dateTime with `during` makes the
 * translator insert a conversion. Each overload returns the primitive's
 * `.value`, so the CQL now reads `.value` itself and calls neither.
 *
 * This reads the translated ELM, so it sees the implicit calls a text search of
 * the CQL cannot. What it cannot see: the publisher's narrative itself. A
 * different cause of duplicate anchors would pass here and still warn there.
 */
import { describe, it, expect } from 'vitest'
import { translateMeasureLibrary } from './cql/cqlMeasureEngine'

type ElmNode = Record<string, unknown>

/** Every FHIRHelpers function the library calls, with the overload signatures it reaches. */
async function fhirHelpersOverloads(): Promise<Map<string, Set<string>>> {
  const { measures } = await translateMeasureLibrary()
  const calls = new Map<string, Set<string>>()
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!node || typeof node !== 'object') return
    const n = node as ElmNode
    if (n.type === 'FunctionRef' && n.libraryName === 'FHIRHelpers') {
      const signature = Array.isArray(n.signature)
        ? (n.signature as ElmNode[]).map(s => String(s.name ?? s.type)).join(', ')
        : '(unknown)'
      const name = String(n.name)
      calls.set(name, (calls.get(name) ?? new Set()).add(signature))
    }
    Object.values(n).forEach(visit)
  }
  visit(measures)
  return calls
}

describe('measure library → FHIRHelpers overloads', () => {
  it('calls no FHIRHelpers function through more than one overload', async () => {
    const calls = await fhirHelpersOverloads()
    // Liveness: the library does use FHIRHelpers (ToInterval for Period), so an
    // empty map means the walk found nothing, not that the rule holds.
    expect(calls.size).toBeGreaterThan(0)
    const multiple = [...calls].filter(([, sigs]) => sigs.size > 1).map(([name, sigs]) => `${name}: ${[...sigs].join(' | ')}`)
    expect(multiple, 'two overloads of one function render one anchor twice on the Measure pages').toEqual([])
  }, 120_000)
})
