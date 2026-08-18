import { describe, it, expect } from 'vitest'
import { buildDocumentReference, renderQrNarrative, base64Utf8 } from './documentReference'
import type { QuestionnaireResponseResource } from '../../types/fhir'
import type { RiskAlert } from '../observationMappers'

const decode = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))

const qr: QuestionnaireResponseResource = {
  resourceType: 'QuestionnaireResponse',
  id: 'qr-1',
  questionnaire: 'http://spier.org/Questionnaire/PHQ-9',
  status: 'completed',
  authored: '2026-07-14T10:00:00Z',
  item: [
    { linkId: 'q1', text: 'Little interest or pleasure?', answer: [{ valueCoding: { code: '2', display: 'More than half the days' } }] },
    { linkId: 'q9', text: 'Thoughts of self-harm — señor?', answer: [{ valueInteger: 1 }] },
  ],
}

const riskAlert: RiskAlert = {
  tool: 'PHQ-9',
  level: 'high',
  summary: 'PHQ-9 Item 9 positive (score: 1/3)',
  detail: 'Patient endorsed thoughts of death or self-harm.',
}

describe('base64Utf8', () => {
  it('round-trips non-ASCII content', () => {
    const s = 'señor — café — 🚑'
    expect(decode(base64Utf8(s))).toBe(s)
  })
})

describe('renderQrNarrative', () => {
  it('includes question text, answers, and the risk summary; escapes HTML', () => {
    const html = renderQrNarrative(qr, { title: 'PHQ-9', riskAlert })
    expect(html).toContain('Little interest or pleasure?')
    expect(html).toContain('More than half the days')
    expect(html).toContain('PHQ-9 Item 9 positive (score: 1/3)')
    // the raw "&" in "self-harm — señor?" must be HTML-escaped (no assertion on
    // unicode dash; just confirm no unescaped angle brackets leak from data)
    const withAngle = renderQrNarrative(
      { ...qr, item: [{ linkId: 'x', text: '<script>bad</script>', answer: [{ valueString: 'a & b' }] }] },
      {},
    )
    expect(withAngle).toContain('&lt;script&gt;')
    expect(withAngle).toContain('a &amp; b')
    expect(withAngle).not.toContain('<script>bad</script>')
  })
})

describe('buildDocumentReference', () => {
  it('produces a current DocumentReference scoped to the patient with two attachments', () => {
    const dr = buildDocumentReference({ qr, patientId: 'pat-9', title: 'PHQ-9', riskAlert })
    expect(dr.resourceType).toBe('DocumentReference')
    expect(dr.status).toBe('current')
    expect((dr.subject as { reference: string }).reference).toBe('Patient/pat-9')
    expect(dr.date).toBe('2026-07-14T10:00:00Z') // defaults to QR.authored

    const content = dr.content as Array<{ attachment: { contentType: string; data: string } }>
    expect(content).toHaveLength(2)
    expect(content[0].attachment.contentType).toBe('text/html')
    expect(content[1].attachment.contentType).toBe('application/fhir+json')

    // Attachment 2 is the recoverable raw QR.
    expect(JSON.parse(decode(content[1].attachment.data))).toMatchObject({
      resourceType: 'QuestionnaireResponse',
      id: 'qr-1',
    })
    // Attachment 1 is the readable rendering.
    expect(decode(content[0].attachment.data)).toContain('Little interest or pleasure?')
  })
})
