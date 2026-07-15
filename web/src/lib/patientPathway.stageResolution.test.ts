import { describe, it, expect } from 'vitest'
import {
  stageForArtifact,
  stageForResponse,
  groupArtifactsByStage,
  unstagedArtifacts,
  PATHWAY_STAGE_SYSTEM,
  type FhirResourceLike,
} from './patientPathway'
import { deriveFromResponse } from './deriveFromResponse'
import { stampLaunchStage } from './launchStage'
import { STAGES, TOOLS, toolForQuestionnaireUrl } from '../data/catalog'
import type { QuestionnaireResponseResource } from '../types/fhir'

// Cross-tool stage-resolution coverage.
//
// `derivePathwayStatus` is tested (patientPathway.test.ts) but only via
// synthetic `meta.tag` mocks — it never proves that a *real* tool's artifacts
// resolve to the tool's stage. This file exercises `stageForArtifact` — the
// one function that classifies every artifact from every tool into a pathway
// stage — across all four resolution tiers, and drives real example
// QuestionnaireResponses through deriveFromResponse to prove the whole
// capture → translate → land-in-the-right-stage chain.
//
// The catalog wires questionnaire URL → tool → stageId (drift-prone
// hand-duplicated stage IDs per CLAUDE.md). Rather than re-hardcode those
// stage IDs (which would just duplicate the drift), these tests assert the
// resolution *wiring* is intact: a QR for a tool resolves to that same tool's
// stageId. Tier-4 (legacy id-regex) is the exception — those stage IDs are
// hardcoded in patientPathway.ts, so we anchor them explicitly.

const STAGE_ID_SET = new Set(STAGES.map((s) => s.id))
const toolsWithQuestionnaire = TOOLS.filter((t) => (t.questionnaireUrls?.length ?? 0) > 0)

// A single Questionnaire canonical can in principle be administered by more
// than one tool at different pathway stages. (The CAMS SSF-5 used to be the
// live example before its session tools were consolidated into one TL-020
// entry.) For any such shared URL a bare QR's canonical is inherently
// ambiguous — disambiguation relies on the meta.tag stamp — so the strict
// URL→stage assertion below only applies to uniquely-owned URLs.
const urlOwnerCount = new Map<string, number>()
for (const t of toolsWithQuestionnaire) {
  for (const url of t.questionnaireUrls ?? []) urlOwnerCount.set(url, (urlOwnerCount.get(url) ?? 0) + 1)
}

describe('stageForArtifact — tier 3: QuestionnaireResponse → tool → stage (every tool)', () => {
  it('has tools with questionnaires to cover', () => {
    // Guards against the loop below silently passing on an empty catalog.
    expect(toolsWithQuestionnaire.length).toBeGreaterThan(0)
  })

  it.each(toolsWithQuestionnaire.map((t) => [t.id, t] as const))(
    'resolves a bare %s QuestionnaireResponse to a valid, consistent stage',
    (_id, tool) => {
      for (const url of tool.questionnaireUrls ?? []) {
        const qr: FhirResourceLike = { resourceType: 'QuestionnaireResponse', questionnaire: url }
        const resolved = stageForArtifact(qr)
        // A known tool's response must never orphan — it must land in a real stage.
        expect(STAGE_ID_SET.has(resolved ?? '')).toBe(true)
        // stageForArtifact must agree with the dedicated QR resolver.
        expect(stageForResponse(qr as QuestionnaireResponseResource)).toBe(resolved)
        // For a uniquely-owned questionnaire the stage is unambiguous and must
        // match the tool's own stageId (catalog wiring intact end to end).
        if (urlOwnerCount.get(url) === 1) {
          expect(resolved).toBe(tool.stageId)
        } else {
          // Shared URL: resolves to whichever tool the catalog designates owner.
          expect(resolved).toBe(toolForQuestionnaireUrl(url)?.stageId)
        }
      }
    },
  )
})

describe('stageForArtifact — shared questionnaire is disambiguated by meta.tag, not canonical', () => {
  // Find a questionnaire canonical claimed by ≥2 tools at ≥2 distinct stages.
  const sharedUrl = [...urlOwnerCount.entries()].find(([, n]) => n > 1)?.[0]
  const sharers = sharedUrl
    ? TOOLS.filter((t) => t.questionnaireUrls?.includes(sharedUrl))
    : []
  const distinctStages = [...new Set(sharers.map((t) => t.stageId))]

  it('a bare QR on a shared canonical resolves to the first-registered owner (ambiguous)', () => {
    if (!sharedUrl || distinctStages.length < 2) return // no cross-stage sharing in catalog
    const qr: FhirResourceLike = { resourceType: 'QuestionnaireResponse', questionnaire: sharedUrl }
    // Ambiguous by design: canonical alone cannot say which stage/tool.
    expect(stageForArtifact(qr)).toBe(toolForQuestionnaireUrl(sharedUrl)?.stageId)
  })

  it('the same QR carrying a meta.tag resolves to the tagged stage (tag wins)', () => {
    if (!sharedUrl || distinctStages.length < 2) return
    // Pick a sharer stage that is NOT the ambiguous default, to prove the tag overrides.
    const defaultStage = toolForQuestionnaireUrl(sharedUrl)?.stageId
    const otherStage = distinctStages.find((s) => s !== defaultStage)!
    const qr: FhirResourceLike = {
      resourceType: 'QuestionnaireResponse',
      questionnaire: sharedUrl,
      meta: { tag: [{ system: PATHWAY_STAGE_SYSTEM, code: otherStage }] },
    }
    expect(stageForArtifact(qr)).toBe(otherStage)
  })
})

describe('deriveFromResponse — derived Observations carry the source QR stage', () => {
  // Load whatever example QuestionnaireResponses ship in the generated IG data.
  const qrModules = import.meta.glob('../data/fhir/QuestionnaireResponse-*.json', { eager: true }) as Record<
    string,
    { default: QuestionnaireResponseResource }
  >
  const exampleQrs = Object.values(qrModules).map((m) => m.default)

  it('ships at least one example QuestionnaireResponse fixture', () => {
    expect(exampleQrs.length).toBeGreaterThan(0)
  })

  it.each(exampleQrs.map((qr) => [qr.questionnaire ?? qr.id ?? 'unknown', qr] as const))(
    'every Observation derived from %s resolves to the QR stage',
    (_label, qr) => {
      const expectedStage = stageForResponse(qr)
      const derived = deriveFromResponse(qr)
      // CarePlan-producing instruments (Stanley-Brown / CAMS) have no
      // observation mapper — deriveFromResponse returns null and there is
      // nothing to stage-check here.
      if (!derived) return

      expect(expectedStage).toBeDefined()
      expect(derived.observations.length).toBeGreaterThan(0)
      for (const obs of derived.observations) {
        expect(stageForArtifact(obs as FhirResourceLike)).toBe(expectedStage)
      }
    },
  )
})

describe('write path: stampLaunchStage stamps the launching tool’s stage', () => {
  // The CAMS SSF-5 is one consolidated tool (TL-020 @ clarify-risk): its
  // first-session and interim launches share the Section A questionnaire and
  // now stamp the same stage. The stamp mechanism stays load-bearing for any
  // future questionnaire shared by tools at different stages, so the write
  // path (`?tool=` → stampLaunchStage → meta.tag → stageForArtifact tier 1 →
  // deriveFromResponse) is still driven end to end here with the real helper.
  const CAMS_A_URL = 'http://spier.org/Questionnaire/CAMS-SSF5-SectionA'
  const owner = toolForQuestionnaireUrl(CAMS_A_URL)
  const ownerStage = owner?.stageId

  // A raw Section A submission before stamping: minimal valid response (six 1–5
  // ratings under a core-ratings group), no stage tag — as formbox emits it.
  const rawSubmission = (): QuestionnaireResponseResource =>
    ({
      resourceType: 'QuestionnaireResponse',
      status: 'completed',
      id: 'cams-a-1',
      questionnaire: CAMS_A_URL,
      item: [
        {
          linkId: 'core-ratings',
          item: [1, 2, 3, 4, 5, 6].map((n) => ({ linkId: `${n}-score`, answer: [{ valueInteger: 2 }] })),
        },
      ],
    }) as QuestionnaireResponseResource

  const stampedSubmission = (): QuestionnaireResponseResource =>
    stampLaunchStage(rawSubmission(), owner!.id)

  it('the CAMS SSF-5 questionnaire is owned by exactly one consolidated tool', () => {
    const sharers = TOOLS.filter((t) => t.questionnaireUrls?.includes(CAMS_A_URL))
    expect(sharers.map((t) => t.id)).toEqual([owner!.id])
    expect(ownerStage).toBeDefined()
  })

  it('stampLaunchStage tags the raw submission with the launching tool’s stage', () => {
    const stamped = stampedSubmission()
    const tags = (stamped.meta as { tag?: { system?: string; code?: string }[] } | undefined)?.tag
    expect(tags).toContainEqual({ system: PATHWAY_STAGE_SYSTEM, code: ownerStage })
    expect(stageForArtifact(stamped as FhirResourceLike)).toBe(ownerStage)
  })

  it('derived Observations of a stamped submission resolve to the stamped stage', () => {
    const derived = deriveFromResponse(stampedSubmission())
    expect(derived).not.toBeNull()
    expect(derived!.observations.length).toBeGreaterThan(0)
    for (const obs of derived!.observations) {
      expect(stageForArtifact(obs as FhirResourceLike)).toBe(ownerStage)
    }
  })

  it('groups a stamped submission’s Observations under the owning stage only', () => {
    const derived = deriveFromResponse(stampedSubmission())
    const grouped = groupArtifactsByStage({ responses: [], observations: derived!.observations })
    const ownerBucket = grouped.find((g) => g.stageId === ownerStage)
    expect(ownerBucket!.observations.length).toBe(derived!.observations.length)
    for (const bucket of grouped) {
      if (bucket.stageId !== ownerStage) expect(bucket.observations.length).toBe(0)
    }
  })

  it('an unstamped submission (no launching tool) falls back to the canonical owner stage', () => {
    const derived = deriveFromResponse(rawSubmission())
    expect(derived).not.toBeNull()
    for (const obs of derived!.observations) {
      expect(stageForArtifact(obs as FhirResourceLike)).toBe(ownerStage)
    }
  })

  it('stampLaunchStage ignores a ?tool= that does not own the questionnaire', () => {
    const raw = rawSubmission()
    // A tool whose questionnaire is NOT CAMS Section A must not stamp a stage.
    const foreignTool = TOOLS.find(
      (t) => (t.questionnaireUrls?.length ?? 0) > 0 && !t.questionnaireUrls!.includes(CAMS_A_URL),
    )!
    const out = stampLaunchStage(raw, foreignTool.id)
    expect(out).toBe(raw) // returned untouched
    // Falls back to the canonical owner, not the foreign tool's stage.
    expect(stageForArtifact(out as FhirResourceLike)).toBe(ownerStage)
  })
})

describe('stageForArtifact — tier 1: meta.tag', () => {
  const stageId = STAGES[1]!.id

  it('resolves a stage tag on any resourceType (e.g. Communication)', () => {
    const comm: FhirResourceLike = {
      resourceType: 'Communication',
      meta: { tag: [{ system: PATHWAY_STAGE_SYSTEM, code: stageId }] },
    }
    expect(stageForArtifact(comm)).toBe(stageId)
  })

  it('ignores a tag whose system is not the pathway CodeSystem', () => {
    const obs: FhirResourceLike = {
      resourceType: 'Observation',
      meta: { tag: [{ system: 'http://example.org/other', code: stageId }] },
    }
    expect(stageForArtifact(obs)).toBeUndefined()
  })

  it('ignores a tag whose code is not a known stage id', () => {
    const obs: FhirResourceLike = {
      resourceType: 'Observation',
      meta: { tag: [{ system: PATHWAY_STAGE_SYSTEM, code: 'not-a-real-stage' }] },
    }
    expect(stageForArtifact(obs)).toBeUndefined()
  })
})

describe('stageForArtifact — tier 2: category.coding', () => {
  const stageId = STAGES[2]!.id

  it('resolves a stage coding under category (the CarePlan placeholder mechanism)', () => {
    const plan: FhirResourceLike = {
      resourceType: 'CarePlan',
      category: [{ coding: [{ system: PATHWAY_STAGE_SYSTEM, code: stageId }] }],
    }
    expect(stageForArtifact(plan)).toBe(stageId)
  })
})

describe('stageForArtifact — tier 4: legacy CarePlan id-regex', () => {
  // These stage IDs are hardcoded in patientPathway.ts (CAREPLAN_ID_PATTERNS),
  // so we anchor them explicitly — and assert they still name real stages.
  const cases: Array<[string, string]> = [
    ['stanley-brown-careplan-123', 'document-safety-actions'],
    ['cams-stabilization-careplan-123', 'document-safety-actions'],
    ['cams-therapeutic-careplan-123', 'define-risk-picture'],
  ]

  it.each(cases)('resolves id %s to stage %s', (id, expectedStage) => {
    expect(STAGE_ID_SET.has(expectedStage)).toBe(true)
    const plan: FhirResourceLike = { resourceType: 'CarePlan', id }
    expect(stageForArtifact(plan)).toBe(expectedStage)
  })

  it('leaves an id that matches no pattern unresolved', () => {
    expect(stageForArtifact({ resourceType: 'CarePlan', id: 'some-other-plan-999' })).toBeUndefined()
  })
})

describe('stageForArtifact — resolution precedence', () => {
  it('prefers meta.tag over category.coding over the id-regex fallback', () => {
    const tagStage = STAGES[3]!.id
    const categoryStage = STAGES[2]!.id
    const artifact: FhirResourceLike = {
      resourceType: 'CarePlan',
      id: 'stanley-brown-careplan-1', // id-regex would say document-safety-actions
      category: [{ coding: [{ system: PATHWAY_STAGE_SYSTEM, code: categoryStage }] }],
      meta: { tag: [{ system: PATHWAY_STAGE_SYSTEM, code: tagStage }] },
    }
    // meta.tag wins.
    expect(stageForArtifact(artifact)).toBe(tagStage)

    // Drop the tag: category wins over the id-regex.
    delete artifact.meta
    expect(stageForArtifact(artifact)).toBe(categoryStage)
  })

  it('returns undefined for an unrecognized artifact', () => {
    expect(stageForArtifact({ resourceType: 'Observation', id: 'plain' })).toBeUndefined()
    expect(stageForArtifact(undefined)).toBeUndefined()
  })
})

describe('groupArtifactsByStage / unstagedArtifacts', () => {
  const stageId = STAGES[1]!.id
  const mapped: FhirResourceLike = {
    resourceType: 'Observation',
    id: 'mapped',
    meta: { tag: [{ system: PATHWAY_STAGE_SYSTEM, code: stageId }] },
  }
  const unmapped: FhirResourceLike = { resourceType: 'Observation', id: 'unmapped' }

  it('buckets a mapped artifact under its stage and returns one entry per stage', () => {
    const grouped = groupArtifactsByStage({ responses: [], observations: [mapped, unmapped] })
    expect(grouped).toHaveLength(STAGES.length)
    const bucket = grouped.find((g) => g.stageId === stageId)
    expect(bucket?.observations.map((o) => o.id)).toEqual(['mapped'])
    // The unmapped artifact appears in no stage bucket.
    expect(grouped.every((g) => !g.observations.some((o) => o.id === 'unmapped'))).toBe(true)
  })

  it('surfaces unstaged artifacts in the "Other activity" bucket (never silently dropped)', () => {
    const other = unstagedArtifacts({ responses: [], observations: [mapped, unmapped] })
    expect(other.observations.map((o) => o.id)).toEqual(['unmapped'])
  })
})
