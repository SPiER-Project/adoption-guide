/**
 * The stories are hand-written and keyed by id, so the one thing that can go
 * wrong is the key set drifting from the patients the server actually holds —
 * a new patient with no story renders an empty cell, and a story for a deleted
 * patient is dead text. Both are asserted as an EXACT set match.
 */
import { describe, expect, it } from 'vitest'
import { DEMO_PATIENTS } from './fixtures'
import { DEMO_STORIES, TRY_IT_ORDER, storyOf } from './demoStories'

describe('demo stories', () => {
  it('has exactly one story per demo patient — no more, no fewer', () => {
    const held = DEMO_PATIENTS.map(p => p.id).sort()
    const storied = Object.keys(DEMO_STORIES).sort()
    expect(storied).toEqual(held)
  })

  it('every story is a non-empty single line', () => {
    for (const [id, s] of Object.entries(DEMO_STORIES)) {
      expect(s.story.trim(), id).not.toBe('')
      expect(s.story, id).not.toContain('\n')
    }
  })

  it('the "start here" picks exist, carry a why and a watch, and are the only tryIt entries', () => {
    const marked = Object.entries(DEMO_STORIES).filter(([, s]) => s.tryIt).map(([id]) => id).sort()
    expect(marked).toEqual([...TRY_IT_ORDER].sort())
    for (const id of TRY_IT_ORDER) {
      const { tryIt } = storyOf(id)
      expect(tryIt?.why.trim()).not.toBe('')
      expect(tryIt?.watch.trim()).not.toBe('')
    }
  })

  it('names three picks: one empty chart, one mid-pathway, one complete', () => {
    // The order the front door reads in — smallest commitment first. If the
    // picks change, change this test on purpose: the three are chosen so the
    // "fill one in and watch it write back" story has somewhere to happen.
    expect(TRY_IT_ORDER).toHaveLength(3)
    expect(TRY_IT_ORDER[0]).toBe('patient-002')
  })

  it('throws for an unknown id rather than returning nothing', () => {
    expect(() => storyOf('patient-999')).toThrow(/No demo story/)
  })
})
