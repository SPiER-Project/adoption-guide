import { describe, it, expect } from 'vitest'
import {
  GUIDE_GROUPS,
  GUIDE_SECTIONS,
  guideHref,
  resolveGuidePath,
} from './guideSections'

/**
 * The guide's section list carries two rules its own doc comment states and
 * nothing enforced: the list must stay grouped-contiguous, and a subsection's
 * `path` must be the full sub-path. Both are the kind of rule a later edit
 * breaks silently — a misfiled section makes the pager bounce between groups,
 * and a bare subsection segment makes two gates assert against a route that
 * does not exist.
 *
 * `resolveGuidePath` is tested for the trap named on it: `tools` and
 * `tools/readiness` both prefix-match `/guide/tools/readiness`, so a
 * section-first lookup resolves the subsection to its parent and the subsection
 * is never seen.
 */
describe('GUIDE_SECTIONS', () => {
  it('is grouped-contiguous, in GUIDE_GROUPS order', () => {
    // The order each group is FIRST seen in must equal GUIDE_GROUPS' order, and
    // a group may not reappear after another has started.
    const firstSeen: string[] = []
    for (const section of GUIDE_SECTIONS) {
      if (!firstSeen.includes(section.group)) firstSeen.push(section.group)
    }
    expect(firstSeen).toEqual(GUIDE_GROUPS.map(g => g.id))

    const runs = GUIDE_SECTIONS.map(s => s.group).filter(
      (g, i, all) => i === 0 || all[i - 1] !== g,
    )
    expect(runs).toEqual(firstSeen)
  })

  it('gives every group at least one section', () => {
    // A heading with nothing under it renders as a label for empty space. The
    // 'Configure' group was deleted rather than emptied for this reason.
    for (const group of GUIDE_GROUPS) {
      expect(GUIDE_SECTIONS.some(s => s.group === group.id)).toBe(true)
    }
  })

  it('declares every subsection as a full sub-path under its section', () => {
    // ⚠️ check:guide-boundary and check:catalog both build `/guide/${path}` from
    // these literals. A bare `readiness` would assert against /guide/readiness.
    for (const section of GUIDE_SECTIONS) {
      for (const sub of section.subsections ?? []) {
        expect(sub.path.startsWith(`${section.path}/`)).toBe(true)
        expect(guideHref(sub.path)).toBe(`/guide/${section.path}/${sub.path.slice(section.path.length + 1)}`)
      }
    }
  })

  it('declares the tool page as a parameterised subsection of Tools, for the gates', () => {
    // check:guide-boundary and check:catalog both derive the guide's page set
    // from this file, and the tool page is a sibling route they would otherwise
    // never see. The label is a placeholder: nothing renders it.
    const tools = GUIDE_SECTIONS.find(s => s.path === 'tools')
    expect(tools?.subsections?.map(x => x.path)).toContain('tools/:toolRef')
  })

  it('has no duplicate paths across sections and subsections', () => {
    const all = GUIDE_SECTIONS.flatMap(s => [s.path, ...(s.subsections ?? []).map(x => x.path)])
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('resolveGuidePath', () => {
  it('resolves a section', () => {
    const r = resolveGuidePath('/guide/tools')
    expect(r?.section.path).toBe('tools')
    expect(r?.subsection).toBeUndefined()
  })

  it('prefers the subsection over its parent section', () => {
    // The trap this function is written against: `tools` matches the first
    // segment of `tools/readiness`, so a section-first lookup wins and the
    // subsection is unreachable.
    const r = resolveGuidePath('/guide/tools/readiness')
    expect(r?.section.path).toBe('tools')
    expect(r?.subsection?.path).toBe('tools/readiness')
    expect(r?.subsection?.label).toBe('Adoption Readiness')
  })

  it('falls back to the owning section for an unknown deep link', () => {
    // A tool anchor or a stage deep link still renders its section's chrome
    // rather than the first section in the list.
    const r = resolveGuidePath('/guide/tools/TL-003')
    expect(r?.section.path).toBe('tools')
    expect(r?.subsection).toBeUndefined()
  })

  it('tolerates a trailing slash', () => {
    expect(resolveGuidePath('/guide/tools/readiness/')?.subsection?.path).toBe('tools/readiness')
  })

  it('returns undefined for a bare /guide and for an unknown section', () => {
    expect(resolveGuidePath('/guide')).toBeUndefined()
    expect(resolveGuidePath('/guide/')).toBeUndefined()
    expect(resolveGuidePath('/guide/nope')).toBeUndefined()
  })
})
