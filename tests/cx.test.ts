import { describe, it, expect } from 'vitest'
import { cx } from '@spier/ui/cx'

describe('cx', () => {
  it('joins strings with single spaces', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c')
  })
  it('drops false, null and undefined without leaving a gap', () => {
    const on = false as boolean
    expect(cx('pill', on && 'pill--sm', null, undefined, 'pill--acute')).toBe('pill pill--acute')
  })
  it('returns an empty string when nothing is truthy', () => {
    expect(cx(false, undefined)).toBe('')
  })
  it('keeps a template-built modifier intact for check:css-dead to read', () => {
    const level = 'high'
    expect(cx('risk-pill', `risk-pill--${level}`)).toBe('risk-pill risk-pill--high')
  })
})
