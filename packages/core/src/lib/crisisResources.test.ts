import { describe, it, expect } from 'vitest'
import {
  buildCrisisResourcesShared,
  crisisResourceCodes,
  crisisResourceShares,
  crisisResourceText,
  CRISIS_RESOURCES,
  CRISIS_RESOURCE_CODE_EXT,
  CRISIS_RESOURCE_SYSTEM,
  CRISIS_RESOURCES_PROFILE,
  DEFAULT_CRISIS_RESOURCES,
} from '@spier/core/lib/crisisResources'
import { CONCEPT_DOMAIN_SYSTEM } from '@spier/core/lib/conceptDomain'
import { PATHWAY_STAGE_SYSTEM, stageForArtifact } from '@spier/core/lib/patientPathway'
import type { CommunicationResource } from '@spier/core/types/fhir'

describe('crisis resources shared (TL-013)', () => {
  const base = {
    id: 'crisis-1',
    patientId: 'patient-001',
    sent: '2026-08-11T10:00:00Z',
    resourceCodes: ['lifeline-988', 'safety-plan-copy'],
  }

  /**
   * The regression. Before 2026-09-17 this route rendered the generic
   * Communication recorder, which stamped no profile — while the TL-013
   * ActivityDefinition's own description said the output was "a
   * SPiERCrisisResourcesShared Communication".
   */
  it('claims the profile its ActivityDefinition describes', () => {
    const meta = buildCrisisResourcesShared(base).meta as { profile?: string[] }
    expect(meta.profile).toEqual([CRISIS_RESOURCES_PROFILE])
  })

  /** #262's required 1..1 `category:suicideRisk` slice — the half a profile check misses. */
  it('carries the concept-domain category alongside its own text', () => {
    const category = buildCrisisResourcesShared(base).category as {
      text?: string
      coding?: { system?: string }[]
    }[]
    expect(category[0]).toEqual({ text: 'Crisis resources shared' })
    expect(category[1].coding?.[0]?.system).toBe(CONCEPT_DOMAIN_SYSTEM)
  })

  it('stages under Document Safety Actions', () => {
    expect(stageForArtifact(buildCrisisResourcesShared(base))).toBe('document-safety-actions')
    const tag = (buildCrisisResourcesShared(base).meta as { tag?: { system?: string }[] }).tag
    expect(tag?.[0]?.system).toBe(PATHWAY_STAGE_SYSTEM)
  })

  /**
   * The point of the resource: `Communication.payload.content[x]` has no coded
   * choice, so the code rides as an extension beside the human-readable line.
   * Without it the record is prose and "did this patient leave with crisis
   * contacts" is not a query.
   */
  it('codes every payload with the crisis-resource extension', () => {
    const shared = buildCrisisResourcesShared(base)
    expect(shared.payload).toHaveLength(2)
    const first = (shared.payload as { contentString?: string; extension?: { url?: string; valueCoding?: { system?: string; code?: string; display?: string } }[] }[])[0]
    expect(first.contentString).toBe('988 Suicide & Crisis Lifeline (call/text/chat 988)')
    expect(first.extension?.[0]?.url).toBe(CRISIS_RESOURCE_CODE_EXT)
    expect(first.extension?.[0]?.valueCoding).toEqual({
      system: CRISIS_RESOURCE_SYSTEM,
      code: 'lifeline-988',
      display: '988 Suicide & Crisis Lifeline',
    })
    expect(crisisResourceCodes(shared)).toEqual(['lifeline-988', 'safety-plan-copy'])
  })

  /**
   * The profile is `payload 1..*`, and the builder deliberately does NOT paper
   * over an empty selection: inventing a payload would assert that something was
   * handed to the patient. The recorder disables its submit instead, and this
   * test pins that the builder stays honest rather than growing a fallback.
   */
  it('produces an empty payload for an empty selection rather than inventing one', () => {
    expect(buildCrisisResourcesShared({ ...base, resourceCodes: [] }).payload).toEqual([])
  })

  /**
   * A shared code list cannot carry a site's actual phone number, so the local
   * line is appended — but only to the two entries that name a local service.
   * Appending it to the 988 line would state a number nobody gave.
   */
  it('appends site-specific text to the local entries only', () => {
    const shared = buildCrisisResourcesShared({
      ...base,
      resourceCodes: ['lifeline-988', 'local-crisis-line', 'warmline'],
      localLine: '(555) 123-4567',
    })
    const text = (shared.payload as { contentString?: string }[]).map(p => p.contentString)
    expect(text[0]).toBe('988 Suicide & Crisis Lifeline (call/text/chat 988)')
    expect(text[1]).toBe('Local crisis line — (555) 123-4567')
    expect(text[2]).toBe('Peer warmline — (555) 123-4567')
  })

  it('keeps the internal note off the payload', () => {
    const shared = buildCrisisResourcesShared({ ...base, note: 'Walked through with the patient' })
    expect(shared.note).toEqual([{ text: 'Walked through with the patient' }])
    expect((shared.payload as { contentString?: string }[]).map(p => p.contentString)).not.toContain(
      'Walked through with the patient',
    )
  })

  it('finds shares by profile, most recent first, and ignores other Communications', () => {
    const early = buildCrisisResourcesShared({ ...base, id: 'a', sent: '2026-08-01T10:00:00Z' })
    const late = buildCrisisResourcesShared({ ...base, id: 'b', sent: '2026-08-20T10:00:00Z' })
    const unprofiled: CommunicationResource = {
      resourceType: 'Communication',
      id: 'c',
      status: 'completed',
      sent: '2026-08-30T10:00:00Z',
    }
    expect(crisisResourceShares([early, late, unprofiled]).map(s => s.id)).toEqual(['b', 'a'])
  })

  /**
   * `validate-fhir.mjs` checks every `Coding.display` on a SPiER-local system
   * against the CodeSystem, so these displays are not a free choice. This pins
   * the code list against `crisis-resources.fsh`; the emitter then runs every
   * one of them past the real validator.
   */
  it('matches the published CodeSystem codes', () => {
    expect(CRISIS_RESOURCES.map(r => r.code)).toEqual([
      'lifeline-988',
      'crisis-text-line',
      'now-matters-now',
      'safety-plan-copy',
      'local-crisis-line',
      'warmline',
    ])
    expect(DEFAULT_CRISIS_RESOURCES.every(c => CRISIS_RESOURCES.some(r => r.code === c))).toBe(true)
    // Patient-facing text is a SEPARATE string from the code display: a display
    // names the service, the payload has to say how to reach it.
    expect(crisisResourceText('crisis-text-line')).toBe('Crisis Text Line — text HOME to 741741')
    expect(crisisResourceText('crisis-text-line')).not.toBe(
      CRISIS_RESOURCES.find(r => r.code === 'crisis-text-line')?.display,
    )
  })
})
