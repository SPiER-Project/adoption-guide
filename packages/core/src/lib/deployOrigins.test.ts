import { describe, expect, it } from 'vitest'
import { DEPLOY_ORIGINS } from './deployOrigins'

describe('deploy-origins.json — the one place a hosted origin is typed', () => {
  it('names the five hosts, each an https origin with no trailing slash', () => {
    expect(Object.keys(DEPLOY_ORIGINS).sort()).toEqual(['cds', 'clinical', 'guide', 'mockEhr', 'pages'])
    for (const [key, value] of Object.entries(DEPLOY_ORIGINS)) {
      const url = new URL(value)
      expect(url.protocol, key).toBe('https:')
      expect(value.endsWith('/'), `${key} must not end in a slash — consumers append their own path`).toBe(false)
      expect(url.search + url.hash, key).toBe('')
    }
  })

  it('keeps the four Workers as bare origins and lets only Pages carry a path', () => {
    for (const key of ['guide', 'clinical', 'cds', 'mockEhr'] as const) {
      expect(new URL(DEPLOY_ORIGINS[key]).pathname, key).toBe('/')
    }
    // GitHub Pages serves a project site under the repository name, so this is
    // the one value that legitimately includes a path segment.
    expect(new URL(DEPLOY_ORIGINS.pages).pathname).toBe('/adoption-guide')
  })

  it('gives every host a distinct origin', () => {
    const origins = Object.values(DEPLOY_ORIGINS).map(v => new URL(v).origin)
    expect(new Set(origins).size).toBe(origins.length)
  })
})
