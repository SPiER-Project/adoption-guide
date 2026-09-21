import { describe, it, expect } from 'vitest'
import { TOOLS } from '@spier/core/data/catalog'
import { toolPurposeLine } from './toolCopy'

/**
 * ⚠️ **Over the WHOLE catalogue, not a sample.** `toolPurposeLine`'s claim is
 * that the first sentence of `ActivityDefinition.purpose` is the act — which is
 * true of the 43 published today because that is how the FSH is written, and is
 * a property of the artifacts rather than of this function. A sample would pass
 * on the day a purpose was authored the other way round, which is exactly the
 * case the rule cannot survive.
 *
 * `check:jargon`'s clinical scan cannot see this at all: the string comes from
 * the generated FHIR tree at runtime, and a gate that reads source finds
 * nothing to read.
 */
describe('toolPurposeLine — the act, not its placement in SPiER', () => {
  const launchable = TOOLS.filter(t => t.purpose)

  it('covers the catalogue', () => {
    expect(launchable.length).toBeGreaterThan(30)
  })

  it('names no pathway machinery in any tool’s first sentence', () => {
    for (const tool of launchable) {
      const line = toolPurposeLine(tool)
      expect(line, tool.id).not.toMatch(/SPiER pathway|concept layer|crosswalk/i)
      // "Belongs to the … stage" is the sentence this exists to drop.
      expect(line, tool.id).not.toMatch(/^Belongs to /)
      expect(line.length, tool.id).toBeGreaterThan(10)
    }
  })

  it('keeps the clinical claim, and drops what follows it', () => {
    expect(toolPurposeLine({ purpose: 'Flag suicide-related signs. Belongs to the Identify Possible Risk stage of the SPiER pathway.' }))
      .toBe('Flag suicide-related signs.')
  })

  it('does not cut at an abbreviation or a number', () => {
    // A naive split on "." makes "the 6-item C-SSRS Screener" two sentences.
    expect(toolPurposeLine({ purpose: 'Use the 6-item screener from Dr. Posner. Belongs to a stage.' }))
      .toBe('Use the 6-item screener from Dr. Posner.')
  })

  it('is empty rather than wrong when a tool has no purpose', () => {
    expect(toolPurposeLine({ purpose: '' })).toBe('')
  })
})
