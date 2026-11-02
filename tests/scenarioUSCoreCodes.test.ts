/**
 * The codes US Core requires of three SPiER profiles, held to ONE source.
 *
 * SPiEREncounter, SPiERDischargeSafetyPacket and SPiERSafetyReferral build on
 * US Core, which requires `Encounter.type`, a LOINC `DocumentReference.type` and
 * a `ServiceRequest.code`. The runtime builders take those codes from core; the
 * scenario fixtures are hand-authored JSON and would otherwise drift from them in
 * silence — the validator accepts any SNOMED type on an encounter, so a fixture
 * typed differently from what the app emits would still pass it.
 */
import { describe, it, expect } from 'vitest'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { encounterTypeFor } from '@spier/core/lib/encounters'
import {
  PACKET_PROFILE,
  PACKET_TYPE,
  REFERRAL_TO_MENTAL_HEALTH_TEAM,
  REFERRAL_TO_PSYCHIATRY_SERVICE,
  packetSummaryText,
  type WithheldItem,
} from '@spier/core/lib/handoffs'
import { base64Utf8 } from '@spier/core/lib/writeback/documentReference'

type Coded = { coding?: { system?: string; code?: string; display?: string }[]; text?: string }
type Ext = { url: string; valueCodeableConcept?: Coded; extension?: Ext[] }
type Res = {
  resourceType?: string
  id?: string
  meta?: { profile?: string[] }
  class?: { code?: string }
  type?: Coded[] | Coded
  code?: Coded
  extension?: Ext[]
  content?: { attachment?: { title?: string; data?: string } }[]
}

const codeOf = (e?: Ext) => e?.valueCodeableConcept?.coding?.[0]?.code ?? ''

const resources = (bucket: string): Res[] =>
  Object.values(POPULATION_SCENARIOS).flatMap((s) =>
    (((s as unknown as Record<string, unknown>)[bucket] as { resource?: Res }[] | undefined) ?? []).map((e) => e.resource ?? (e as Res)),
  )

describe('scenario fixtures carry the US Core codes the builders emit', () => {
  const encounters = resources('encounters')
  const referrals = resources('serviceRequests')
  const packets = resources('documentReferences').filter((r) => r.meta?.profile?.includes(PACKET_PROFILE))

  it('reads every bucket it gates (an empty bucket would pass anything)', () => {
    expect(encounters.length).toBeGreaterThan(10)
    expect(referrals.length).toBeGreaterThan(3)
    expect(packets.length).toBeGreaterThan(1)
  })

  it.each(encounters.map((e) => [e.id, e] as const))('encounter %s is typed by its class', (_id, e) => {
    expect(e.type).toEqual([encounterTypeFor(String(e.class?.code))])
  })

  it.each(referrals.map((r) => [r.id, r] as const))('referral %s carries a known referral code and its text', (_id, r) => {
    const coding = r.code?.coding ?? []
    expect([REFERRAL_TO_MENTAL_HEALTH_TEAM, REFERRAL_TO_PSYCHIATRY_SERVICE]).toContainEqual(coding[0])
    expect(r.code?.text).toBeTruthy()
  })

  it.each(packets.map((p) => [p.id, p] as const))('packet %s is the suicide prevention note', (_id, p) => {
    expect((p.type as Coded).coding).toEqual([PACKET_TYPE])
  })

  // US Core requires the attachment to carry `data` or `url`; the fixtures carry
  // the same plain-text rendering the builder writes, from their own extensions.
  it.each(packets.map((p) => [p.id, p] as const))('packet %s carries the text the builder would write', (_id, p) => {
    const ext = p.extension ?? []
    const included = ext.filter((x) => x.url.endsWith('/handoff-content-item')).map(codeOf)
    const withheld = ext
      .filter((x) => x.url.endsWith('/handoff-withheld-item'))
      .map((x) => ({
        code: codeOf(x.extension?.find((y) => y.url === 'item')),
        basis: codeOf(x.extension?.find((y) => y.url === 'basis')),
      })) as WithheldItem[]
    const attachment = p.content?.[0]?.attachment
    expect(attachment?.data).toBe(base64Utf8(packetSummaryText(String(attachment?.title), included, withheld)))
  })
})
