import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { clientIdForIssuer, DEFAULT_CLIENT_ID } from './smartClients'
import registrations from '../config/smart-registrations.json'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..')
/** The path the registration script reads. Restated ONCE, and asserted below. */
const CONFIG_PATH = 'web/src/config/smart-registrations.json'

describe('clientIdForIssuer', () => {
  it('uses the mock EHR registration when the issuer is unknown', () => {
    expect(clientIdForIssuer('https://some-other-ehr.example/fhir')).toBe(DEFAULT_CLIENT_ID)
  })

  it('uses the Medplum registration for a Medplum issuer', () => {
    expect(clientIdForIssuer('https://api.medplum.com/fhir/R4')).not.toBe(DEFAULT_CLIENT_ID)
  })

  it('matches on origin, so a different FHIR base on the same server still resolves', () => {
    expect(clientIdForIssuer('https://api.medplum.com/fhir/R4')).toBe(
      clientIdForIssuer('https://api.medplum.com/some/other/base'),
    )
  })

  // The launch is about to fail on this URL anyway; the server's own diagnostic
  // is more useful than a stack trace from the app.
  it.each([null, undefined, '', 'not-a-url'])('falls back rather than throwing on %p', iss => {
    expect(clientIdForIssuer(iss)).toBe(DEFAULT_CLIENT_ID)
  })

  // A registered id that equals the fallback would silently disable the lookup
  // for that server — the launch would "work" against the mock and fail against
  // the real one, which is the confusing direction.
  it('never registers an issuer under the fallback id', () => {
    expect(clientIdForIssuer('https://api.medplum.com/fhir/R4')).not.toBe(DEFAULT_CLIENT_ID)
  })
})

describe('the registrations file', () => {
  it('has something to read, or every lookup below is vacuous', () => {
    expect(Object.keys(registrations.byIssuerOrigin).length).toBeGreaterThan(0)
    expect(registrations.default).toBeTruthy()
  })

  it('is keyed on bare ORIGINS — a path here would never match', () => {
    // `clientIdForIssuer` compares `new URL(iss).origin`, so an entry carrying a
    // FHIR base path ("https://api.medplum.com/fhir/R4") silently never matches
    // and every launch from that server falls back to the mock's client_id.
    for (const key of Object.keys(registrations.byIssuerOrigin)) {
      expect(new URL(key).origin, `${key} is not a bare origin`).toBe(key)
    }
  })

  it('registers no issuer under the fallback id', () => {
    for (const [origin, id] of Object.entries(registrations.byIssuerOrigin)) {
      expect(id, `${origin} is registered as the fallback`).not.toBe(registrations.default)
    }
  })
})

describe('the registration script reads THIS file', () => {
  /**
   * ⚠️ The closed loop, asserted. `scripts/medplum-register-launch.mjs` reads
   * the registrations rather than restating a UUID, so what it writes to a
   * ClientApplication and what the app presents at `/authorize` cannot drift.
   * Moving or renaming this file without teaching the script would break that
   * silently — the script would fail loudly on a missing file, but only when
   * someone next ran it, which may be after a launch has already failed.
   */
  const script = readFileSync(join(REPO, 'scripts/medplum-register-launch.mjs'), 'utf8')

  it('names the path the app imports from', () => {
    expect(script).toContain(CONFIG_PATH)
  })

  it('parses the file rather than regexing a TypeScript source', () => {
    expect(script).toContain('byIssuerOrigin')
    expect(script).not.toContain('smartClients.ts')
  })

  it('and that path is where this test found the config', () => {
    // Guards the restatement above: if CONFIG_PATH drifts from the real
    // location, this fails rather than certifying a string nothing uses.
    const onDisk = JSON.parse(readFileSync(join(REPO, CONFIG_PATH), 'utf8'))
    expect(onDisk.byIssuerOrigin).toEqual(registrations.byIssuerOrigin)
  })
})
