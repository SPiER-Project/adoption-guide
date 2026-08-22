import { describe, expect, it } from 'vitest'
import { generateCarePlan } from '@spier/core/lib/carePlanMappers/stanleyBrown'
import p001 from '@spier/demo-population/scenarios/patient-001.json'
import p011 from '@spier/demo-population/scenarios/patient-011.json'
import type { QuestionnaireResponseResource } from '@spier/core/types/fhir'

/**
 * The demo's Stanley-Brown CarePlans are DERIVED from their QuestionnaireResponses.
 *
 * They were not. All three scenario Stanley-Brown QRs were empty (zero `item`),
 * while `p001-stanley-brown` and `p011-stanley-brown` carried hand-authored
 * 7-activity plans that merely *looked* like the transformation's output. So the
 * repo's flagship transformation — declared in `StanleyBrownQRToCarePlan.fml`,
 * executed in `stanleyBrown.ts`, deliberately implemented twice and pinned by a
 * golden file — was exercised by no demo data at all. Both halves were tested
 * against the oracle; neither was ever run against a patient.
 *
 * Back-filling the QRs surfaced why that mattered: `extractPairs` read only
 * `answer[].item[]`, a shape the HL7 validator REJECTS ("Items of type question
 * should not have answers"), while the conformant shape the Questionnaire
 * declares — `type: group, repeats: true`, so repeated `item` entries with
 * nested `item[]` — was silently unreadable. A correctly-filled safety plan
 * derived "No crisis contacts provided.", dropping the contacts, which is the
 * most safety-critical part of the plan. Same family as #327.
 *
 * This test is what keeps the two layers married: change either the QR fixtures
 * or the mapper without the other, and it fails.
 */
describe('the demo safety plans are derived from their QuestionnaireResponses', () => {
  for (const [name, scenario, qrId, planId] of [
    ['patient-001', p001, 'p001-sb', 'p001-stanley-brown'],
    ['patient-011', p011, 'p011-sb', 'p011-stanley-brown'],
  ] as const) {
    it(`${name}: ${planId} is exactly generateCarePlan(${qrId})`, () => {
      const wrapper = (scenario as { responses: { id: string; resource: unknown }[] })
        .responses.find(r => r.id === qrId)
      expect(wrapper, `${qrId} is missing from ${name}`).toBeDefined()

      const qr = wrapper!.resource as QuestionnaireResponseResource
      expect(qr.item?.length, `${qrId} has no items — the capture layer is empty again`).toBe(7)

      const plan = (scenario as { carePlans: { id: string; activity?: unknown[] }[] })
        .carePlans.find(c => c.id === planId)
      expect(plan, `${planId} is missing from ${name}`).toBeDefined()

      expect(plan!.activity).toEqual(generateCarePlan(qr).resource.activity)
    })

    it(`${name}: every section carries real content, not a "not provided" placeholder`, () => {
      // The bug this file exists for produced a full 7-activity plan whose
      // contact sections all read "No … provided." — structurally perfect and
      // clinically empty. Shape assertions alone would have passed it.
      const qr = (scenario as { responses: { id: string; resource: unknown }[] })
        .responses.find(r => r.id === qrId)!.resource as QuestionnaireResponseResource
      // `CarePlanResource` is a loose index-signature type, so `.activity` is
      // untyped here; the shape is asserted by the parity test above.
      const activities = (generateCarePlan(qr).resource.activity ?? []) as Array<{
        detail?: { description?: string }
      }>
      expect(activities).toHaveLength(7)
      for (const a of activities) {
        const description = a.detail?.description ?? ''
        expect(description, `${planId} section is empty`).not.toMatch(/^No .* provided\.$/)
      }
    })
  }
})
