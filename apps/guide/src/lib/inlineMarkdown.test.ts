import { describe, it, expect } from 'vitest'
import { TOOLS } from '@spier/core/data/catalog'
import { splitCodeSpans, unsupportedMarkdown } from './inlineMarkdown'

describe('splitCodeSpans', () => {
  it('separates code spans from text and drops the backticks', () => {
    expect(splitCodeSpans('Run `$export` nightly, then `escalation`.')).toEqual([
      { kind: 'text', text: 'Run ' },
      { kind: 'code', text: '$export' },
      { kind: 'text', text: ' nightly, then ' },
      { kind: 'code', text: 'escalation' },
      { kind: 'text', text: '.' },
    ])
  })

  it('leaves text with no code span as one run', () => {
    expect(splitCodeSpans('No markdown here.')).toEqual([{ kind: 'text', text: 'No markdown here.' }])
  })
})

describe('unsupportedMarkdown', () => {
  it('names each construct the guide would show as raw syntax', () => {
    expect(unsupportedMarkdown('a **bold** claim')).toEqual(['bold'])
    expect(unsupportedMarkdown('see [the IG](http://example.org)')).toEqual(['a link'])
    expect(unsupportedMarkdown('steps:\n- one\n- two')).toEqual(['a list'])
    expect(unsupportedMarkdown('one.\n\ntwo.')).toEqual(['a paragraph break'])
    expect(unsupportedMarkdown('an `unclosed span')).toEqual(['an unclosed code span'])
  })

  it('passes code spans, which the guide renders', () => {
    expect(unsupportedMarkdown('Query `EpisodeOfCare?status=active` and `Task`.')).toEqual([])
  })
})

/**
 * ⚠️ The class, not the five tools that use markdown today. Every catalogued
 * tool's description is published as FHIR markdown and rendered by
 * `InlineMarkdown`, which handles code spans and nothing else; a description
 * that starts using anything more fails here, by tool, before a reader meets
 * the asterisks.
 */
describe('every tool description uses only the markdown the guide renders', () => {
  it('has descriptions to check', () => {
    expect(TOOLS.filter(t => t.description).length).toBeGreaterThan(19)
  })

  it.each(TOOLS.filter(t => t.description).map(t => [t.id, t.description!] as const))(
    '%s',
    (_id, description) => {
      expect(unsupportedMarkdown(description)).toEqual([])
    },
  )
})
