import { describe, expect, it } from 'vitest'
import { DEVELOPMENT_NOTICE } from '@spier/core/lib/developmentNotice'
import { page } from './hostChrome'

describe('page() carries the under-development notice', () => {
  it('above the app bar, once, in the shared words', () => {
    const html = page({ body: '<p>x</p>' })
    const notice = html.indexOf('class="dev-notice"')
    expect(notice).toBeGreaterThan(-1)
    expect(notice).toBeLessThan(html.indexOf('class="app-bar"'))
    expect(html.split('class="dev-notice"')).toHaveLength(2)
    expect(html).toContain(DEVELOPMENT_NOTICE.title)
    expect(html).toContain(DEVELOPMENT_NOTICE.body)
  })
})
