/**
 * The operator's bench. Two things here are copies of something defined
 * elsewhere, and each is pinned against its source at test time rather than
 * imported at runtime — the same arrangement `app.test.ts` uses for the CDS
 * service path, and for the same reason: importing the catalog would pull every
 * ActivityDefinition into this Worker's bundle for a `<datalist>`.
 */
import { describe, expect, it } from 'vitest'
import app from './app'
import { DEMO_PATIENTS } from './fixtures'
import { KNOWN_INTENTS } from './controlPage'
import { knownIntents } from '@spier/core/lib/smartIntent'

const BASE = 'https://mock-ehr.test'

async function html(path: string) {
  const res = await app.request(`${BASE}${path}`)
  return { res, body: await res.text() }
}

describe('/settings', () => {
  it('offers the launch picker by NAME, not by resource id', async () => {
    // `patient-011` tells an operator nothing; the chart pages and the front
    // door use names, and the bench should not be the one place that does not.
    const { body } = await html('/settings')
    for (const p of DEMO_PATIENTS) {
      expect(body).toContain(`<option value="${p.id}">${p.name}`)
    }
  })

  it('lists exactly the intents the app recognises', async () => {
    // KNOWN_INTENTS is hand-written in controlPage.ts; this is what makes that
    // safe. A tool added to the catalog fails here until the list is updated,
    // and a stale intent fails here rather than minting a launch the app
    // answers by landing on the chart with no error.
    expect([...KNOWN_INTENTS].sort()).toEqual(knownIntents())
    const { body } = await html('/settings')
    for (const intent of KNOWN_INTENTS) {
      expect(body).toContain(`<option value="${intent}">`)
    }
  })
})
