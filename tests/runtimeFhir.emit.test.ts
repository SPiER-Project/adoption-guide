/**
 * Emit the FHIR the app actually produces, so the HL7 validator can check it (#302).
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 *
 * Hand-authored FHIR is well gated: `ig/` by sushi + the validator + the IG
 * Publisher, `ig/input/resources/questionnaires/` and the scenarios by `validate-fhir.mjs`. What the
 * *app* emits at runtime was gated by nothing. Two real defects landed in that
 * blind spot: #220 (seven fabricated LOINC codes on every generated Observation)
 * and #263 phase 3, where a new profile invariant was violated by the manual
 * episode recorder on every default submit while CI stayed green.
 *
 * ── Why it is a test file ────────────────────────────────────────────────────
 *
 * The builders are TypeScript; the validator is a Java jar driven from Node. There
 * is no TS runtime in this package other than vitest (no tsx, no vite-node), and
 * adding one for a code generator is a worse trade than this: the file runs as a
 * normal test — asserting the builders produce what we expect — and *also* writes
 * the resources to a gitignored directory (`.runtime-fhir`) for
 * `node scripts/validate-fhir.mjs --also .runtime-fhir` to validate, and for
 * `check:outputs` (both its parts) to read. The side effect is
 * deliberate and the directory is disposable.
 *
 * ── Inputs ───────────────────────────────────────────────────────────────────
 *
 * QuestionnaireResponses come from the shipped scenarios and from the IG's own
 * example instances, never written here. Hand-authoring one is how #263 phase 4
 * produced a fixture that silently derived zero Observations — a subtly wrong
 * canonical looks fine and exercises nothing. Coded parameters are driven from
 * the exported option lists, every code in each, so a code that is not in its
 * bound ValueSet fails rather than hiding behind a happy-path sample.
 *
 * ⚠️ **The IG examples were added 2026-09-17 and are not a convenience.** The
 * scenarios cover nine of the fourteen mapped canonicals; SBQ-R, PSS-3,
 * PSS-Full, SAFE-T, the C-SSRS Screener and the CAMS Outcome/Disposition had no
 * fixture at all, so those mappers ran nowhere and the profiles they stamp were
 * validated by nothing. The IG examples are hand-authored too — but they are
 * validated by the IG build and by `validate-fhir.mjs`, which is precisely the
 * property #263's bad fixture lacked. `covers every mapper` below is what stops
 * the set going quietly back to nine.
 */
import { describe, it, expect } from 'vitest'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { deriveFromResponse } from '@spier/core/lib/deriveFromResponse'
import { MAPPED_QUESTIONNAIRE_URLS } from '@spier/core/lib/observationMappers'
import { stripCanonicalVersion } from '@spier/core/data/catalog'
import {
  generateCarePlan,
  generateStabilizationCarePlan,
  generateTherapeuticCarePlan,
  generateCrisisResponseCarePlan,
} from '@spier/core/lib/carePlanMappers'
import {
  buildEpisode,
  buildFlag,
  buildSafetyTask,
  clearFlag,
  closeEpisode,
  CLOSURE_REASONS,
  ENTRY_REASONS,
  ESCALATION_TRIGGERS,
  RISK_TIERS,
  SAFETY_TASK_TYPES,
} from '@spier/core/lib/riskEpisode'
import { attachEpisode, buildEncounter } from '@spier/core/lib/encounters'
import {
  buildDischargePacket,
  buildFollowUpAppointment,
  buildSafetyHandoff,
  buildSafetyReferral,
  buildSharingConsent,
  APPOINTMENT_STATUSES,
  CONSENT_DECISIONS,
  HANDOFF_CHANNELS,
  HANDOFF_CONTENT_ITEMS,
  REFERRAL_REASONS,
  REFERRAL_STATUSES,
} from '@spier/core/lib/handoffs'
import { buildCrisisResourcesShared, CRISIS_RESOURCES } from '@spier/core/lib/crisisResources'
import { buildCaringContact, buildOutreachAttempt, OUTREACH_OUTCOMES } from '@spier/core/lib/followUp'
import {
  buildLethalMeansCounseling,
  buildMeansSafetyAction,
  LETHAL_MEANS_METHODS,
  MEANS_SAFETY_ACTIONS,
} from '@spier/core/lib/lethalMeans'
import type { FhirResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../.runtime-fhir')

const PATIENT = 'patient-001'
const WHEN = '2026-08-11T10:00:00Z'
const DAY = '2026-08-11'

/**
 * The IG's own example QuestionnaireResponses, read out of the generated tree.
 * Read from disk rather than imported so a new example instance is picked up by
 * existing it, with no list here to keep in step.
 */
const GENERATED_DIR = join(dirname(fileURLToPath(import.meta.url)), '../packages/fhir-artifacts/generated')

function igExampleResponses(): { name: string; qr: QuestionnaireResponseResource }[] {
  const out: { name: string; qr: QuestionnaireResponseResource }[] = []
  for (const entry of readdirSync(GENERATED_DIR)) {
    if (!entry.startsWith('QuestionnaireResponse-') || !entry.endsWith('.json')) continue
    const qr = JSON.parse(readFileSync(join(GENERATED_DIR, entry), 'utf8')) as QuestionnaireResponseResource
    out.push({ name: entry.replace(/^QuestionnaireResponse-|\.json$/g, ''), qr })
  }
  return out
}

/**
 * Scenario `responses` entries this emitter could not use — anything whose
 * `resource` is not a QuestionnaireResponse. Collected rather than dropped:
 * filtering them out silently is how a `resourceType` typo removed a patient's
 * PHQ-9 from the emitted corpus with every gate green. A test below fails on
 * any entry here.
 */
const unusableScenarioResponses: string[] = []

/** Every QuestionnaireResponse the shipped scenarios contain. */
function scenarioResponses(): { name: string; qr: QuestionnaireResponseResource }[] {
  const out: { name: string; qr: QuestionnaireResponseResource }[] = []
  unusableScenarioResponses.length = 0
  for (const [patientId, scenario] of Object.entries(POPULATION_SCENARIOS)) {
    for (const sr of scenario.responses ?? []) {
      if (sr?.resource?.resourceType === 'QuestionnaireResponse') {
        out.push({ name: sr.questionnaireName ?? String(sr.id), qr: sr.resource })
      } else {
        unusableScenarioResponses.push(
          `${patientId} responses entry ${String(sr?.id)}: resourceType ${JSON.stringify(
            (sr?.resource as { resourceType?: unknown } | undefined)?.resourceType,
          )}`,
        )
      }
    }
  }
  return out
}

/** Every profile the IG publishes, canonical → constrained type. */
function publishedProfiles(): Map<string, string> {
  const out = new Map<string, string>()
  for (const entry of readdirSync(GENERATED_DIR)) {
    if (!entry.startsWith('StructureDefinition-') || !entry.endsWith('.json')) continue
    const sd = JSON.parse(readFileSync(join(GENERATED_DIR, entry), 'utf8')) as {
      url?: string
      type?: string
      kind?: string
      derivation?: string
    }
    if (sd.url && sd.kind === 'resource' && sd.derivation === 'constraint') out.set(sd.url, sd.type ?? '')
  }
  return out
}

/**
 * Questionnaire canonical → the output profiles DECLARED for the types an
 * instrument mapper writes, by the PlanDefinition action that administers it.
 * Read off the published wiring — `PlanDefinition.action.definitionCanonical`
 * → that ActivityDefinition's `depends-on` Questionnaire — so there is no hand
 * list here to drift.
 *
 * ⚠️ Joined per ACTIVITYDEFINITION, not per tool. TL-020 is one tool over five
 * CAMS forms, and each form's action declares its own outputs (Section B a
 * Condition, Outcome/Disposition a disposition Observation); pooling them by
 * tool demands that Section A produce a disposition it has no items for.
 */
const MAPPER_OUTPUT_TYPES = new Set(['Observation', 'Condition'])
function declaredMapperProfiles(): Map<string, Set<string>> {
  const questionnairesByAd = new Map<string, string[]>()
  for (const entry of readdirSync(GENERATED_DIR)) {
    if (!entry.startsWith('ActivityDefinition-') || !entry.endsWith('.json')) continue
    const ad = JSON.parse(readFileSync(join(GENERATED_DIR, entry), 'utf8')) as {
      url?: string
      relatedArtifact?: { type?: string; resource?: string }[]
    }
    if (!ad.url) continue
    questionnairesByAd.set(
      stripCanonicalVersion(ad.url),
      (ad.relatedArtifact ?? [])
        .filter(r => r.type === 'depends-on' && r.resource?.includes('/Questionnaire/'))
        .map(r => stripCanonicalVersion(String(r.resource))),
    )
  }
  const byQuestionnaire = new Map<string, Set<string>>()
  for (const entry of readdirSync(GENERATED_DIR)) {
    if (!entry.startsWith('PlanDefinition-') || !entry.endsWith('.json')) continue
    const pd = JSON.parse(readFileSync(join(GENERATED_DIR, entry), 'utf8')) as {
      action?: { definitionCanonical?: string; output?: { type?: string; profile?: string[] }[] }[]
    }
    for (const action of pd.action ?? []) {
      if (!action.definitionCanonical) continue
      for (const q of questionnairesByAd.get(stripCanonicalVersion(action.definitionCanonical)) ?? []) {
        const set = byQuestionnaire.get(q) ?? new Set<string>()
        for (const out of action.output ?? []) {
          if (!MAPPER_OUTPUT_TYPES.has(out.type ?? '')) continue
          for (const p of out.profile ?? []) set.add(p)
        }
        byQuestionnaire.set(q, set)
      }
    }
  }
  return byQuestionnaire
}

/**
 * Everything an instrument mapper produced for one response: its Observations
 * AND its recorded Conditions. CAMS Section B returns no Observation at all, so
 * reading `observations` alone would drop it from coverage silently.
 */
function resultsOf(qr: QuestionnaireResponseResource): FhirResource[] {
  const derived = deriveFromResponse(qr)
  return [...(derived?.observations ?? []), ...(derived?.conditions ?? [])]
}

/** Run every production builder. Returns resources tagged with their origin. */
function emitRuntimeResources(): { origin: string; resource: FhirResource }[] {
  const out: { origin: string; resource: FhirResource }[] = []
  const add = (origin: string, resource: unknown) => {
    const r = resource as FhirResource
    if (r?.resourceType) out.push({ origin, resource: r })
  }

  // ── Observation mappers, via the real dispatch ──
  // Both sources, so every mapper in the registry runs. The origin prefix stays
  // `deriveFromResponse` either way: the family list below is about which
  // BUILDERS are exercised, not where their input came from.
  for (const { name, qr } of [...scenarioResponses(), ...igExampleResponses()]) {
    const derived = deriveFromResponse(qr)
    for (const o of [...(derived?.observations ?? []), ...(derived?.conditions ?? [])]) {
      add(`deriveFromResponse:${name}`, o)
    }
  }

  // ── CarePlan mappers. Each is fed the scenario QR for its own instrument, so
  //    the extraction logic runs against real answers rather than an empty shell.
  const byCanonical = (fragment: string) =>
    scenarioResponses().find(r => String(r.qr.questionnaire ?? '').includes(fragment))?.qr
  const carePlanCases: [string, (qr: QuestionnaireResponseResource) => unknown][] = [
    ['stanleyBrown', qr => generateCarePlan(qr)],
    ['camsStabilization', qr => generateStabilizationCarePlan(qr)],
    ['camsTherapeutic', qr => generateTherapeuticCarePlan(qr)],
    ['crp', qr => generateCrisisResponseCarePlan(qr)],
  ]
  const anyQr = scenarioResponses()[0]?.qr
  for (const [label, run] of carePlanCases) {
    const qr =
      byCanonical(
        label === 'stanleyBrown'
          ? 'Stanley-Brown'
          : label === 'camsStabilization'
            ? 'CAMS-Stabilization'
            : label === 'camsTherapeutic'
              ? 'CAMS-Therapeutic'
              : 'Crisis-Response',
      ) ?? anyQr
    if (!qr) continue
    const generated = run(qr) as { resource?: unknown } | undefined
    add(`carePlan:${label}`, generated?.resource)
  }

  // ── Stage 7: episode lifecycle, every entry reason and closure reason ──
  for (const reason of ENTRY_REASONS) {
    // positive-screen carries a profile invariant requiring a trigger; supplying
    // one for every reason is harmless and keeps the sample conformant.
    const ep = buildEpisode({
      id: `emit-episode-${reason.code}`,
      patientId: PATIENT,
      entryReason: reason.code,
      currentTier: RISK_TIERS[0]?.code,
      startDate: DAY,
      triggerRef: 'Observation/emit-trigger',
    })
    add(`buildEpisode:${reason.code}`, ep)
    // An Encounter only claims the SPiER profile once it names an episode.
    add(
      `attachEpisode:${reason.code}`,
      attachEpisode(buildEncounter({ patientId: PATIENT, startIso: WHEN }), ep),
    )
  }
  for (const closure of CLOSURE_REASONS) {
    const open = buildEpisode({
      id: `emit-episode-closed-${closure.code}`,
      patientId: PATIENT,
      entryReason: 'manual-add',
      startDate: DAY,
    })
    add(`closeEpisode:${closure.code}`, closeEpisode(open, { closureReason: closure.code, endDate: DAY }))
  }

  const flag = buildFlag({ id: 'emit-flag', patientId: PATIENT, startDate: DAY })
  add('buildFlag', flag)
  add('clearFlag', clearFlag(flag, DAY))

  for (const taskType of SAFETY_TASK_TYPES) {
    add(
      `buildSafetyTask:${taskType.code}`,
      buildSafetyTask({
        id: `emit-task-${taskType.code}`,
        patientId: PATIENT,
        episodeId: 'emit-episode-manual-add',
        taskType: taskType.code,
        dueDate: DAY,
        owner: 'Care manager',
        escalationTriggers: ESCALATION_TRIGGERS.map(t => t.code),
        authoredOn: WHEN,
      }),
    )
  }

  // ── Stage 5: handoffs, every coded option ──
  // Every channel, because the medium coding's `display` is checked against the
  // published v3-ParticipationMode CodeSystem and a wrong one fails here rather
  // than on a chart.
  for (const channel of HANDOFF_CHANNELS) {
    add(
      `buildSafetyHandoff:${channel.code}`,
      buildSafetyHandoff({
        id: `emit-handoff-${channel.code}`,
        patientId: PATIENT,
        sent: WHEN,
        channel: channel.code,
        contentCodes: HANDOFF_CONTENT_ITEMS.map(i => i.code),
        recipient: 'Riverside BH',
        summary: 'Warm handoff to the receiving team.',
      }),
    )
  }
  add(
    'buildDischargePacket',
    buildDischargePacket({
      id: 'emit-packet',
      patientId: PATIENT,
      date: WHEN,
      title: 'Emitted discharge packet',
      contentCodes: HANDOFF_CONTENT_ITEMS.map(i => i.code),
    }),
  )
  for (const reason of REFERRAL_REASONS) {
    for (const status of REFERRAL_STATUSES) {
      add(
        `buildSafetyReferral:${reason.code}/${status.code}`,
        buildSafetyReferral({
          id: `emit-referral-${reason.code}-${status.code}`,
          patientId: PATIENT,
          status: status.code,
          reason: reason.code,
          performer: 'Outpatient BH',
          authoredOn: WHEN,
        }),
      )
    }
  }
  for (const status of APPOINTMENT_STATUSES) {
    add(
      `buildFollowUpAppointment:${status.code}`,
      buildFollowUpAppointment({
        id: `emit-appt-${status.code}`,
        patientId: PATIENT,
        status: status.code,
        start: WHEN,
      }),
    )
  }
  for (const decision of CONSENT_DECISIONS) {
    add(
      `buildSharingConsent:${decision.code}`,
      buildSharingConsent({
        id: `emit-consent-${decision.code}`,
        patientId: PATIENT,
        dateTime: WHEN,
        decision: decision.code,
        recipient: 'Outpatient BH clinic',
      }),
    )
  }

  // ── Stage 6: follow-up ──
  for (const outcome of OUTREACH_OUTCOMES) {
    add(
      `buildOutreachAttempt:${outcome.code}`,
      buildOutreachAttempt({
        id: `emit-outreach-${outcome.code}`,
        patientId: PATIENT,
        sent: WHEN,
        channel: '',
        outcome: outcome.code,
      }),
    )
  }
  add(
    'buildCaringContact',
    buildCaringContact({ id: 'emit-caring', patientId: PATIENT, sent: WHEN, channel: '' }),
  )

  // ── Stage 4: crisis resources ──
  // All codes at once (the profile is `payload 1..*`, so the interesting bound
  // is the lower one, which the recorder enforces rather than the builder), then
  // each code alone so every payload coding's display is validated.
  add(
    'buildCrisisResourcesShared',
    buildCrisisResourcesShared({
      id: 'emit-crisis-resources',
      patientId: PATIENT,
      sent: WHEN,
      resourceCodes: CRISIS_RESOURCES.map(r => r.code),
      localLine: 'County Crisis Line, (555) 123-4567',
    }),
  )
  for (const resource of CRISIS_RESOURCES) {
    add(
      `buildCrisisResourcesShared:${resource.code}`,
      buildCrisisResourcesShared({
        id: `emit-crisis-${resource.code}`,
        patientId: PATIENT,
        sent: WHEN,
        resourceCodes: [resource.code],
      }),
    )
  }

  // ── Stage 4: lethal means ──
  add(
    'buildLethalMeansCounseling',
    buildLethalMeansCounseling({ id: 'emit-calm', patientId: PATIENT, performed: WHEN }),
  )
  for (const method of LETHAL_MEANS_METHODS) {
    for (const action of MEANS_SAFETY_ACTIONS) {
      add(
        `buildMeansSafetyAction:${method.code}/${action.code}`,
        buildMeansSafetyAction({
          id: `emit-means-${method.code}-${action.code}`,
          patientId: PATIENT,
          effective: WHEN,
          method: method.code,
          action: action.code,
          completed: true,
        }),
      )
    }
  }

  return out
}

describe('runtime FHIR emission', () => {
  const emitted = emitRuntimeResources()

  it('produces resources from every production builder family', () => {
    const families = new Set(emitted.map(e => e.origin.split(':')[0]))
    // If a family disappears from this list, either a builder was removed or this
    // emitter stopped calling it — and the validator would stop seeing its output.
    expect([...families].sort()).toEqual([
      'attachEpisode',
      'buildCaringContact',
      'buildCrisisResourcesShared',
      'buildDischargePacket',
      'buildEpisode',
      'buildFlag',
      'buildFollowUpAppointment',
      'buildLethalMeansCounseling',
      'buildMeansSafetyAction',
      'buildOutreachAttempt',
      'buildSafetyHandoff',
      'buildSafetyReferral',
      'buildSafetyTask',
      'buildSharingConsent',
      'carePlan',
      'clearFlag',
      'closeEpisode',
      'deriveFromResponse',
    ])
  })

  it('derives Observations from the shipped QuestionnaireResponses', () => {
    // Guards the trap from #263 phase 4: a QR that maps to nothing looks fine.
    const derived = emitted.filter(e => e.origin.startsWith('deriveFromResponse'))
    expect(derived.length).toBeGreaterThan(10)
  })

  /**
   * ⚠️ **Covers every mapper, not merely "some".**
   *
   * `check:outputs` reads this emitted tree, so its reach IS this file's reach:
   * a mapper nothing runs produces no resource, its declared output profile
   * looks unclaimed, and the pressure is to allowlist the profile rather than
   * fix the coverage. Six of the fourteen mapped canonicals were in exactly that
   * position until 2026-09-17 — the demo scenarios cover nine.
   *
   * A count would not have caught it (there were 116 Observations either way);
   * only naming the canonicals does.
   */
  // ⚠️ EMPTY, and it held one entry for ten minutes. CAMS SSF-5 Section B was the
  // one mapper with neither a scenario QR nor an IG example, so it ran nowhere —
  // and it is also the only instrument mapper returning a Condition rather than
  // an Observation, so nothing covered that shape at all. Writing the exemption
  // down made it obvious that authoring `ExampleCAMSSectionBResponse` was the
  // smaller job, and the expiry check below is what then refused to let the
  // stale entry sit there. Exercising it immediately found two defects the
  // validator had never had the chance to see: a `#` in the Condition's id and a
  // `Condition.derivedFrom` R4 does not define.
  const UNEXERCISED: Record<string, string> = {}

  it('covers every mapper in the registry', () => {
    const responses = [...scenarioResponses(), ...igExampleResponses()]
    const exercised = new Set(
      responses
        .filter(r => resultsOf(r.qr).length > 0)
        .map(r => String(r.qr.questionnaire ?? '').split('|')[0]),
    )
    const missing = MAPPED_QUESTIONNAIRE_URLS.filter(
      url => !exercised.has(url) && !(url in UNEXERCISED),
    )
    expect(missing, 'mapped canonicals no fixture exercises — add a scenario QR or an IG example').toEqual([])

    // And the exemption list expires: an entry for a canonical that IS exercised
    // now, or one the registry no longer maps, is a stale exemption.
    for (const url of Object.keys(UNEXERCISED)) {
      expect(MAPPED_QUESTIONNAIRE_URLS, `UNEXERCISED names ${url}, which no mapper handles`).toContain(url)
      expect(exercised, `UNEXERCISED still names ${url}, which is now exercised — delete the entry`).not.toContain(url)
    }
  })

  it('uses every scenario response — none is dropped for not being a QuestionnaireResponse', () => {
    scenarioResponses()
    expect(unusableScenarioResponses, 'scenario responses entries the emitter cannot use').toEqual([])
  })

  /**
   * ⚠️ **Per response, not per corpus.** Both parts of `check:outputs` ask
   * whether a profile is claimed ANYWHERE in the emitted tree, so when three
   * C-SSRS mappers share one declared profile and one of them stops stamping it,
   * the other two keep both parts green — and the
   * validator never checks a profile nothing claims. Asked of each response, the
   * question has no such cover: every result derived from a response claims every
   * Observation/Condition profile its tool's PlanDefinition action declares.
   */
  it('every instrument result claims each output profile its tool declares', () => {
    const declared = declaredMapperProfiles()
    const gaps: string[] = []
    let checked = 0
    for (const { name, qr } of [...scenarioResponses(), ...igExampleResponses()]) {
      const canonical = stripCanonicalVersion(String(qr.questionnaire ?? ''))
      const wanted = declared.get(canonical)
      const derived = resultsOf(qr)
      if (!wanted?.size || derived.length === 0) continue
      checked++
      const claimed = new Set(
        derived.flatMap(r => ((r as { meta?: { profile?: string[] } }).meta?.profile ?? [])),
      )
      for (const p of wanted) {
        if (!claimed.has(p)) gaps.push(`${name} (${canonical.split('/').pop()}): no derived result claims ${p}`)
      }
    }
    expect(gaps).toEqual([])
    // Liveness: the join above reads the PlanDefinitions and the catalog, and an
    // empty join would make this test pass having asked nothing.
    expect(checked).toBeGreaterThan(15)
  })

  it('every emitted resource is typed, and every profile it claims is one the IG publishes for that type', () => {
    const published = publishedProfiles()
    expect(published.size).toBeGreaterThan(15)
    for (const { origin, resource } of emitted) {
      expect(resource.resourceType, `${origin} has no resourceType`).toBeTruthy()
      for (const p of (resource as { meta?: { profile?: string[] } }).meta?.profile ?? []) {
        expect(published.has(p), `${origin} claims ${p}, which the IG does not publish`).toBe(true)
        expect(published.get(p), `${origin} claims ${p} on a ${resource.resourceType}`).toBe(resource.resourceType)
      }
    }
  })

  it('writes the emitted resources for the validator gate', () => {
    rmSync(OUT_DIR, { recursive: true, force: true })
    mkdirSync(OUT_DIR, { recursive: true })
    const seen = new Map<string, number>()
    for (const { origin, resource } of emitted) {
      // Filenames carry the origin so a validator error names the builder that
      // produced it, not just a resource id.
      const base = `${resource.resourceType}-${origin.replace(/[^A-Za-z0-9]+/g, '_')}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      writeFileSync(join(OUT_DIR, `${base}-${n}.json`), JSON.stringify(resource, null, 2))
    }
    expect(seen.size).toBeGreaterThan(20)
  })
})
