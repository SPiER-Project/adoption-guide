import { describe, expect, it } from 'vitest'

import { clientIdForIssuer, DEFAULT_CLIENT_ID } from './smartClients'

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
