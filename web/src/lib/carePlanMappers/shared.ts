/**
 * Shared helpers and types for per-tool CarePlan mappers.
 *
 * Each per-tool mapper (./stanleyBrown.ts, ./camsStabilization.ts,
 * ./camsTherapeutic.ts) extracts the user's safety-plan content from a
 * QuestionnaireResponse, then calls `makeSuicidePreventionCarePlan` to
 * stamp out a uniform FHIR CarePlan shell with the right activities.
 *
 * ⚠️ DEMO ONLY — No data is persisted. Storing patient data without
 * proper safeguards would be a HIPAA violation.
 */

import type { CarePlanProfileUrl } from '@spier/fhir-artifacts/generated/care-plan-profiles.generated'
import type { CarePlanResource, QuestionnaireResponseItem } from '../../types/fhir'
import { suicideRiskCategory } from '../conceptDomain'

// Re-export the QuestionnaireResponse shapes the per-tool mappers need.
export type { QuestionnaireResponseItem, QuestionnaireResponseResource } from '../../types/fhir'

// ─── Public types ─────────────────────────────────────────────

/** Terminology systems a CarePlan section code can come from. */
export const LOINC_SYSTEM = 'http://loinc.org'
export const CAMS_SECTION_SYSTEM = 'http://spier.org/CodeSystem/cams-careplan-section'
/**
 * Section codes shared by the Stanley-Brown Safety Plan and the Crisis Response
 * Plan. SPiER-local: LOINC publishes nothing at safety-plan-section granularity.
 * Replaced seven LOINC codes that were asserted here for months — six of which
 * do not exist in LOINC, while 81344-4 resolves to healthcare-agent disclosure
 * authority rather than "reason for living" (issue #220). See
 * ig/input/fsh/safety-plan-section.fsh for the search behind that.
 */
export const SAFETY_PLAN_SECTION_SYSTEM = 'http://spier.org/CodeSystem/safety-plan-section'

export interface CarePlanActivity {
  stepTitle: string
  /**
   * The section code that lands in `detail.code.coding`. Was `loincCode?: string`
   * until the CAMS CarePlan profiles started slicing `activity` on `detail.code`
   * (#95) — the CAMS sections with no published LOINC equivalent need a
   * SPiER-local code, so the system can no longer be assumed.
   */
  sectionCode?: { system: string; code: string }
  description: string
}

export interface GeneratedCarePlan {
  resource: CarePlanResource  // Full FHIR CarePlan JSON
  activities: CarePlanActivity[]
  isEmpty: boolean
}

// ─── QuestionnaireResponse extraction helpers ─────────────────

/**
 * Collect every valueString answer for the given linkId, walking nested
 * `item` and `answer.item` arrays. Used for repeating-text fields like
 * Stanley-Brown's warning-sign list.
 */
export function extractAnswers(items: QuestionnaireResponseItem[], linkId: string): string[] {
  const results: string[] = []
  function walk(itemList: QuestionnaireResponseItem[]) {
    for (const item of itemList) {
      if (item.linkId === linkId && item.answer) {
        for (const ans of item.answer) {
          if (ans.valueString) results.push(ans.valueString)
          if (ans.item) walk(ans.item)
        }
      }
      if (item.item) walk(item.item)
    }
  }
  walk(items)
  return results.filter(Boolean)
}

/**
 * Read the single valueString/valueText answer for the given linkId.
 * Used for one-shot free-text fields like CAMS Therapeutic Worksheet's
 * personal narrative.
 */
export function extractAnswer(items: QuestionnaireResponseItem[], linkId: string): string {
  for (const item of items) {
    if (item.linkId === linkId && item.answer?.[0]) {
      return item.answer[0].valueString || item.answer[0].valueText || ''
    }
    if (item.item) {
      const found = extractAnswer(item.item, linkId)
      if (found) return found
    }
  }
  return ''
}

/**
 * Extract pairs from a repeating group — e.g. a contact's name + phone
 * captured as two child items under a parent group's answer.item array.
 */
export function extractPairs(
  items: QuestionnaireResponseItem[],
  groupLinkId: string,
  fieldA: string,
  fieldB: string,
): Array<{ a: string; b: string }> {
  const pairs: Array<{ a: string; b: string }> = []
  function walk(itemList: QuestionnaireResponseItem[]) {
    for (const item of itemList) {
      if (item.linkId === groupLinkId && item.answer) {
        for (const ans of item.answer) {
          if (ans.item) {
            let a = ''
            let b = ''
            for (const nested of ans.item) {
              if (nested.linkId === fieldA && nested.answer?.[0]?.valueString) {
                a = nested.answer[0].valueString
              }
              if (nested.linkId === fieldB && nested.answer?.[0]?.valueString) {
                b = nested.answer[0].valueString
              }
            }
            if (a || b) pairs.push({ a, b })
          }
        }
      }
      if (item.item) walk(item.item)
    }
  }
  walk(items)
  return pairs
}

// ─── CarePlan shell factory ───────────────────────────────────

/**
 * Stamp out a uniform suicide-prevention CarePlan with the supplied
 * activities. Each activity becomes a CarePlan.activity entry; its
 * sectionCode (if present) goes into detail.code.coding, stepTitle into
 * detail.code.text, description into detail.description.
 *
 * `hasAnyData` is supplied by the caller because the empty-state check
 * needs to see the raw extracted strings — the activity descriptions
 * here may already have "No xxx provided." defaults applied.
 */
export function makeSuicidePreventionCarePlan(options: {
  id: string
  /**
   * Canonical URL of the SPiER CarePlan profile this resource conforms to.
   * The union is generated at prebuild time from every StructureDefinition
   * in packages/fhir-artifacts/generated/ whose `type === "CarePlan"` — see
   * web/scripts/copy-fhir.mjs. FSH (ig/input/fsh/<tool>.fsh) is the single
   * source of truth; adding a new CarePlan profile in FSH automatically
   * expands this union on the next `npm run copy-fhir`.
   */
  profileUrl: CarePlanProfileUrl
  noteText: string
  activities: CarePlanActivity[]
  hasAnyData: boolean
  /**
   * Extra `category` codings appended after the SNOMED treatment-escalation-plan
   * code. The narrative safety plans (Stanley-Brown, CRP) pass LOINC 87626-8
   * "Suicide prevention note" here — the one real, verified standard code that
   * applies to these artifacts, at document rather than section level.
   *
   * Opt-in rather than unconditional: the CAMS CarePlans share this factory, and
   * their IG examples (#219) do not carry 87626-8, so emitting it for everyone
   * would put the runtime output out of step with the published examples.
   */
  extraCategories?: Array<{ system: string; code: string; display: string }>
}): GeneratedCarePlan {
  const resource: CarePlanResource = {
    resourceType: 'CarePlan',
    id: options.id,
    meta: {
      profile: [options.profileUrl],
    },
    status: 'active',
    intent: 'plan',
    category: [
      {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '735324008',
            display: 'Treatment escalation plan (record artifact)',
          },
        ],
      },
      ...(options.extraCategories ?? []).map(c => ({ coding: [c] })),
      suicideRiskCategory(),
    ],
    subject: {
      reference: 'Patient/demo-patient',
      display: 'Demo Patient (no data persisted to server)',
    },
    addresses: [{ display: 'Risk for suicide' }],
    activity: options.activities.map(a => ({
      detail: {
        code: a.sectionCode
          ? { coding: [{ system: a.sectionCode.system, code: a.sectionCode.code }], text: a.stepTitle }
          : { text: a.stepTitle },
        status: 'in-progress',
        description: a.description,
      },
    })),
    note: [{ text: options.noteText }],
  }

  return {
    resource,
    activities: options.activities,
    isEmpty: !options.hasAnyData,
  }
}
