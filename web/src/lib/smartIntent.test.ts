/**
 * The SMART `intent` vocabulary.
 *
 * The point of these tests is that the vocabulary is DERIVED, so most of them
 * assert a property of the catalog rather than a fixed list. A test that pinned
 * `['open-asq', 'open-phq-9', …]` would have to be edited by whoever adds a tool
 * — which is the drift it was supposed to prevent.
 */
import { describe, it, expect } from 'vitest'
import { TOOLS } from '../data/catalog'
import {
  INTENT_PREFIX,
  collidingLaunchPaths,
  intentForLaunchPath,
  knownIntents,
  launchPathForIntent,
} from './smartIntent'

describe('intentForLaunchPath', () => {
  it('builds the plan’s own example', () => {
    // §2 of the panel plan writes this exact string as what a host would send.
    expect(intentForLaunchPath('/patient/assessments/cssrs-full')).toBe('open-cssrs-full')
  })

  it('is insensitive to a trailing or leading slash', () => {
    expect(intentForLaunchPath('patient/assessments/asq/')).toBe('open-asq')
    expect(intentForLaunchPath('/patient/assessments/asq')).toBe('open-asq')
  })
})

describe('launchPathForIntent', () => {
  it('round-trips every launch action in the catalog', () => {
    // The load-bearing property: a tool with a launch action is reachable by
    // intent the day it is added, with nothing else edited.
    const actions = TOOLS.flatMap(t => t.launchActions)
    expect(actions.length).toBeGreaterThan(0)
    for (const action of actions) {
      expect(launchPathForIntent(intentForLaunchPath(action.path))).toBe(action.path)
    }
  })

  it('returns null for an intent this build does not implement', () => {
    // Not a throw and not a fallback route: the caller decides where to land,
    // because the host is a different system on a different release cycle.
    expect(launchPathForIntent('open-a-tool-we-never-built')).toBeNull()
  })

  it('returns null for a string that is not an intent at all', () => {
    expect(launchPathForIntent('/patient/assessments/asq')).toBeNull()
    expect(launchPathForIntent('cssrs-full')).toBeNull()
    expect(launchPathForIntent(undefined)).toBeNull()
    expect(launchPathForIntent(null)).toBeNull()
    expect(launchPathForIntent('')).toBeNull()
  })

  it('requires the prefix, so a bare slug is not silently accepted', () => {
    // Being strict here is what keeps the vocabulary a vocabulary. A host that
    // sends `cssrs-full` gets the pathway, not a lucky guess.
    expect(launchPathForIntent('cssrs-full')).toBeNull()
    expect(launchPathForIntent(`${INTENT_PREFIX}cssrs-full`)).toBe('/patient/assessments/cssrs-full')
  })
})

describe('the vocabulary as a whole', () => {
  it('has no colliding intents', () => {
    // A collision makes one of the two tools unreachable by intent, and it is
    // invisible from either tool's own definition — which is why this is a
    // computed value rather than a comment asking for care.
    expect(collidingLaunchPaths()).toEqual([])
  })

  it('covers every tool that has a launch action', () => {
    const withActions = TOOLS.filter(t => t.launchActions.length > 0)
    const intents = new Set(knownIntents())
    for (const tool of withActions) {
      for (const action of tool.launchActions) {
        expect(intents.has(intentForLaunchPath(action.path))).toBe(true)
      }
    }
  })

  it('every intent starts with the prefix', () => {
    for (const intent of knownIntents()) {
      expect(intent.startsWith(INTENT_PREFIX)).toBe(true)
    }
  })
})
