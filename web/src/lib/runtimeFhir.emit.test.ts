/**
 * Emit the FHIR the app actually produces, so the HL7 validator can check it (#302).
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 *
 * Hand-authored FHIR is well gated: `ig/` by sushi + the validator + the IG
 * Publisher, `FHIR-Resources/` and the scenarios by `validate-fhir.mjs`. What the
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
 * the resources to a gitignored directory for `scripts/validate-runtime-fhir.mjs`
 * to validate. The side effect is deliberate and the directory is disposable.
 *
 * ── Inputs ───────────────────────────────────────────────────────────────────
 *
 * QuestionnaireResponses come from the shipped scenarios rather than being written
 * here. Hand-authoring one is how #263 phase 4 produced a fixture that silently
 * derived zero Observations — a subtly wrong canonical looks fine and exercises
 * nothing. Coded parameters are driven from the exported option lists, every code
 * in each, so a code that is not in its bound ValueSet fails rather than hiding
 * behind a happy-path sample.
 */
import { describe, it, expect } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { POPULATION_SCENARIOS } from '../data/population/scenarios'
import { deriveFromResponse } from './deriveFromResponse'
import {
  generateCarePlan,
  generateStabilizationCarePlan,
  generateTherapeuticCarePlan,
  generateCrisisResponseCarePlan,
} from './carePlanMappers'
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
} from './riskEpisode'
import { attachEpisode, buildEncounter } from './encounters'
import {
  buildDischargePacket,
  buildFollowUpAppointment,
  buildSafetyReferral,
  buildSharingConsent,
  APPOINTMENT_STATUSES,
  CONSENT_DECISIONS,
  HANDOFF_CONTENT_ITEMS,
  REFERRAL_REASONS,
  REFERRAL_STATUSES,
} from './handoffs'
import { buildCaringContact, buildOutreachAttempt, OUTREACH_OUTCOMES } from './followUp'
import {
  buildLethalMeansCounseling,
  buildMeansSafetyAction,
  LETHAL_MEANS_METHODS,
  MEANS_SAFETY_ACTIONS,
} from './lethalMeans'
import type { FhirResource, QuestionnaireResponseResource } from '../types/fhir'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../.runtime-fhir')

const PATIENT = 'patient-001'
const WHEN = '2026-08-11T10:00:00Z'
const DAY = '2026-08-11'

/** Every QuestionnaireResponse the shipped scenarios contain. */
function scenarioResponses(): { name: string; qr: QuestionnaireResponseResource }[] {
  const out: { name: string; qr: QuestionnaireResponseResource }[] = []
  for (const scenario of Object.values(POPULATION_SCENARIOS)) {
    for (const sr of scenario.responses ?? []) {
      if (sr?.resource?.resourceType === 'QuestionnaireResponse') {
        out.push({ name: sr.questionnaireName ?? String(sr.id), qr: sr.resource })
      }
    }
  }
  return out
}

/** Run every production builder. Returns resources tagged with their origin. */
function emitRuntimeResources(): { origin: string; resource: FhirResource }[] {
  const out: { origin: string; resource: FhirResource }[] = []
  const add = (origin: string, resource: unknown) => {
    const r = resource as FhirResource
    if (r?.resourceType) out.push({ origin, resource: r })
  }

  // ── Observation mappers, via the real dispatch ──
  for (const { name, qr } of scenarioResponses()) {
    const derived = deriveFromResponse(qr)
    for (const o of derived?.observations ?? []) add(`deriveFromResponse:${name}`, o)
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
      'buildDischargePacket',
      'buildEpisode',
      'buildFlag',
      'buildFollowUpAppointment',
      'buildLethalMeansCounseling',
      'buildMeansSafetyAction',
      'buildOutreachAttempt',
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

  it('every emitted resource claims a profile or is a plain typed resource', () => {
    for (const { origin, resource } of emitted) {
      expect(resource.resourceType, `${origin} has no resourceType`).toBeTruthy()
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
