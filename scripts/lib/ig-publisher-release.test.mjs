// The IG Publisher release resolver's failure modes.
//
// Reached from web/'s vitest via an extra `test.include` entry rather than a new
// pipeline, the same way packages/core's mirror tests are (see CLAUDE.md).
//
// Why these assertions and not others: the resolved tag keys the publisher jar
// cache in BOTH ig-publish.yml and deploy.yml, so the one outcome that must be
// impossible is resolving to an empty string — that keys the cache on the bare
// prefix `ig-publisher-` and reuses whatever jar happens to match. Every branch
// below therefore checks that the resolver THREW, not merely that it warned.
import { describe, expect, it, vi, afterEach } from 'vitest'
import { resolveIgPublisherTag } from './ig-publisher-release.mjs'

const quiet = () => {}
const opts = { log: quiet, backoffMs: 0 }
const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

/** Stub `fetch` with a per-call implementation and count the calls. */
function stubFetch(impl) {
  const calls = { n: 0 }
  globalThis.fetch = async () => {
    calls.n++
    return impl(calls.n)
  }
  return calls
}

describe('resolveIgPublisherTag', () => {
  it('returns the tag when the API answers', async () => {
    stubFetch(() => ({ ok: true, json: async () => ({ tag_name: '2.3.4' }) }))
    await expect(resolveIgPublisherTag(opts)).resolves.toBe('2.3.4')
  })

  it('trims surrounding whitespace off the tag', async () => {
    stubFetch(() => ({ ok: true, json: async () => ({ tag_name: ' 2.3.4\n' }) }))
    await expect(resolveIgPublisherTag(opts)).resolves.toBe('2.3.4')
  })

  // The flake the inline shell version could not retry: `jq` exits 5 on an HTML
  // body, and under `bash -e` that killed the step on attempt 1.
  it('retries an HTML error body rather than dying on the first attempt', async () => {
    const calls = stubFetch(() => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    }))
    await expect(resolveIgPublisherTag(opts)).rejects.toThrow(/after 3 attempts/)
    expect(calls.n).toBe(3)
  })

  it('retries an HTTP error status', async () => {
    const calls = stubFetch(() => ({ ok: false, status: 502 }))
    await expect(resolveIgPublisherTag(opts)).rejects.toThrow(/after 3 attempts/)
    expect(calls.n).toBe(3)
  })

  it('treats a well-formed response with no tag_name as retryable, not as success', async () => {
    stubFetch(() => ({ ok: true, json: async () => ({ message: 'Not Found' }) }))
    await expect(resolveIgPublisherTag(opts)).rejects.toThrow(/after 3 attempts/)
  })

  // The one that would poison the jar cache silently.
  it('never resolves a blank tag_name', async () => {
    stubFetch(() => ({ ok: true, json: async () => ({ tag_name: '   ' }) }))
    await expect(resolveIgPublisherTag(opts)).rejects.toThrow(/after 3 attempts/)
  })

  it('retries a network error', async () => {
    const calls = stubFetch(() => {
      throw new Error('ECONNREFUSED')
    })
    await expect(resolveIgPublisherTag(opts)).rejects.toThrow(/after 3 attempts/)
    expect(calls.n).toBe(3)
  })

  it('recovers when a transient failure clears before the attempts run out', async () => {
    const calls = stubFetch((n) => {
      if (n < 3) throw new Error('flake')
      return { ok: true, json: async () => ({ tag_name: '9.9.9' }) }
    })
    await expect(resolveIgPublisherTag(opts)).resolves.toBe('9.9.9')
    expect(calls.n).toBe(3)
  })

  it('sends the token when one is in the environment, and works without it', async () => {
    const seen = []
    globalThis.fetch = async (_url, init) => {
      seen.push(init?.headers?.authorization)
      return { ok: true, json: async () => ({ tag_name: '1.0.0' }) }
    }
    vi.stubEnv('GITHUB_TOKEN', 'tok')
    await resolveIgPublisherTag(opts)
    vi.stubEnv('GITHUB_TOKEN', '')
    await resolveIgPublisherTag(opts)
    vi.unstubAllEnvs()
    expect(seen).toEqual(['Bearer tok', undefined])
  })
})
