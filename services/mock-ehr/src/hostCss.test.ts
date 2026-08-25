/**
 * The CSS gate's own tests.
 *
 * The gate itself was proved by planting four defects and watching each one fail
 * (raw hex, an undefined token, an undefined token *with* a fallback, and the
 * TOKENS export renamed out from under it). What a test adds is the pair of
 * properties that are easy to break while the gate keeps passing: its precision
 * against this repo's constant issue references, and the hole that precision
 * costs — both of which are stated in the script and neither of which any
 * running of the gate would reveal.
 */
import { describe, expect, it } from 'vitest'
import { HEX, checkHostCss, decomment, looksLikeColour } from '../scripts/check-host-css.mjs'

function hexes(text: string): string[] {
  return [...decomment(text).matchAll(HEX)].map(m => m[0]).filter(looksLikeColour)
}

describe('check-host-css', () => {
  it('passes against the service as it stands', () => {
    expect(checkHostCss()).toBe(0)
  })

  it('finds a colour written as a literal', () => {
    expect(hexes('color: #cc3366;')).toEqual(['#cc3366'])
    expect(hexes('background:#FFF')).toEqual(['#FFF'])
    // The four literals controlPage.ts actually carried, which is the regression
    // this gate exists for.
    expect(hexes('a: #5c4a54; b: #f3eef1; c: #d8cdd4; d: #fdf5f8;')).toHaveLength(4)
  })

  it('does not mistake an issue reference for a colour', () => {
    // ⚠️ 25 of these on the gate's first run, and zero real findings. Both
    // filters are load-bearing: the comment strip removes the prose, and the
    // "must look like a colour" rule removes what survives in code.
    expect(hexes('// see #404, #232 and #261 for the history')).toEqual([])
    expect(hexes('/* the #232 / #261 family of silent passes */')).toEqual([])
    expect(hexes("const route = '#/population/summary'")).toEqual([])
    expect(hexes('throw new Error("unknown patient (#404)")')).toEqual([])
  })

  it('reports the line the colour is really on, after stripping comments', () => {
    // Comments are blanked rather than deleted so offsets survive. Delete them
    // instead and every line number after the first comment is wrong, which is
    // how a correct finding gets dismissed as a bad tool.
    const text = '/* a\nb\nc */\ncolor: #abc;'
    const stripped = decomment(text)
    const at = stripped.indexOf('#abc')
    expect(stripped.slice(0, at).split('\n').length).toBe(4)
  })

  it('catches a six-digit grey, and states the shorthand it cannot', () => {
    // The documented hole. `#000` is indistinguishable from issue #000 by shape
    // alone, so the gate lets it through; the six-digit spelling — the one a
    // palette would actually use — is caught.
    expect(hexes('color: #000000')).toEqual(['#000000'])
    expect(hexes('color: #000')).toEqual([])
  })
})
