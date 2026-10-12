import { describe, it, expect } from 'vitest'
import { tierRoute } from '@spier/core/lib/conceptCrosswalk'
import { BINDINGS, CONCEPTS, codeHref, conceptMapHref, valueSetHref, valueSetLabel } from '@spier/core/data/catalog/dataElements'

/**
 * The data dictionary's links are claims about what the published IG contains,
 * and this file's history (#220, #261, #266) is mostly about unbacked claims on
 * that page. `check:catalog` proves every SPiER-local canonical resolves to a
 * generated `ValueSet-<id>.json`; these tests cover the half it cannot see —
 * that the href built from the canonical points at the file name the IG
 * Publisher actually renders, and that a canonical never silently degrades to
 * unlinked text.
 */
describe('valueSetHref (#281)', () => {
  const base = import.meta.env.BASE_URL

  it('points a SPiER-local canonical at the published IG page', () => {
    expect(valueSetHref('http://thespierproject.org/fhir/ValueSet/spier-suicide-risk-tier-vs')).toBe(
      `${base}ig/ValueSet-spier-suicide-risk-tier-vs.html`,
    )
  })

  it('derives the same page-name shape codeHref does', () => {
    // Both resolve inside the IG we publish, and the Publisher names those pages
    // `<ResourceType>-<id>.html`. If one convention ever changes, the other is
    // where to look — so they are asserted together rather than in isolation.
    const code = codeHref('http://thespierproject.org/fhir/CodeSystem/spier-concept-domain', 'suicide-risk')
    expect(code).toBe(`${base}ig/CodeSystem-spier-concept-domain.html#spier-concept-domain-suicide-risk`)
    expect(valueSetHref('http://thespierproject.org/fhir/ValueSet/spier-concept-domain-vs')).toBe(
      `${base}ig/ValueSet-spier-concept-domain-vs.html`,
    )
  })

  it('returns undefined for a canonical SPiER does not publish', () => {
    // Rather than guessing someone else's URL pattern. The caller renders plain
    // text in that case, which is honest; a fabricated link would not be.
    expect(valueSetHref('http://hl7.org/fhir/ValueSet/observation-category')).toBeUndefined()
  })

  it('labels a canonical by its id, keeping the URL for the title attribute', () => {
    expect(valueSetLabel('http://thespierproject.org/fhir/ValueSet/cams-driver-type-vs')).toBe('cams-driver-type-vs')
    // Nothing to shorten — the full canonical is the only honest label left.
    expect(valueSetLabel('http://example.org/vs/x')).toBe('http://example.org/vs/x')
  })
})

describe('every dictionary ValueSet canonical is linkable', () => {
  const canonicals = [
    ...CONCEPTS.flatMap(c => (c.valueSet ? [{ where: `concept ${c.id}`, vs: c.valueSet }] : [])),
    ...BINDINGS.flatMap(b =>
      b.value?.valueSet ? [{ where: `binding ${b.id}`, vs: b.value.valueSet }] : [],
    ),
  ]

  it('finds the canonicals to check — an empty sweep would pass vacuously', () => {
    expect(canonicals.length).toBeGreaterThan(15)
  })

  it.each(canonicals)('$where → $vs resolves to a link', ({ vs }) => {
    // A canonical that yields no href renders as unlinked text, which looks
    // deliberate and is not — that silent downgrade is what #281 found on the
    // page. If SPiER ever does name an external ValueSet here, this test should
    // fail and force a decision about how to link it.
    expect(valueSetHref(vs)).toBeDefined()
  })
})

/**
 * Every route into a shared concept renders its fidelity on the Data Dictionary
 * (#264), on two axes: precision, derived from the published crosswalk, and who
 * asserts the value, declared on the binding because no ConceptMap can say it.
 * A new route that the page would show as "Not translated", or with no author,
 * fails here rather than shipping as a blank cell.
 */
describe('every route into a shared concept has a fidelity to show', () => {
  const routes = BINDINGS.filter(b => b.conceptId)

  it('finds the routes — an empty sweep would pass vacuously', () => {
    expect(routes.length).toBeGreaterThanOrEqual(6)
  })

  it.each(routes.map(b => [b.id, b] as const))('%s is translated into the tier, or already is one', (_id, b) => {
    expect(tierRoute(b.value?.system), `${b.id}: no published crosswalk lands ${b.value?.system} on the tier`).toBeDefined()
  })

  it.each(routes.map(b => [b.id, b] as const))('%s says who asserts the value', (_id, b) => {
    expect(b.assertedBy).toBeDefined()
  })

  it('links each crosswalk to its page in the published IG, by the map’s own canonical', () => {
    const asq = tierRoute(BINDINGS.find(b => b.id === 'asq-result')?.value?.system)
    expect(asq?.kind === 'crosswalk' && conceptMapHref(asq.url)).toBe(
      `${import.meta.env.BASE_URL}ig/ConceptMap-ASQDispositionToRiskTier.html`,
    )
    expect(conceptMapHref('http://example.org/ConceptMap/x')).toBeUndefined()
  })

  it('keeps the one patient self-rating marked as one', () => {
    // The reason the axis exists: a CAMS `high` is the patient’s own rating of
    // how they feel right now, and must not read as a clinician’s determination.
    expect(BINDINGS.find(b => b.id === 'cams-overall-risk-level')?.assertedBy).toBe('patient')
  })
})
