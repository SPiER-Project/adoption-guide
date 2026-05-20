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

// ─── Public types ─────────────────────────────────────────────

export interface CarePlanActivity {
  stepTitle: string
  loincCode?: string
  description: string
}

export interface GeneratedCarePlan {
  resource: any           // Full FHIR CarePlan JSON
  activities: CarePlanActivity[]
  isEmpty: boolean
}

// ─── QuestionnaireResponse extraction helpers ─────────────────

/**
 * Collect every valueString answer for the given linkId, walking nested
 * `item` and `answer.item` arrays. Used for repeating-text fields like
 * Stanley-Brown's warning-sign list.
 */
export function extractAnswers(items: any[], linkId: string): string[] {
  const results: string[] = []
  function walk(itemList: any[]) {
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
export function extractAnswer(items: any[], linkId: string): string {
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
  items: any[],
  groupLinkId: string,
  fieldA: string,
  fieldB: string,
): Array<{ a: string; b: string }> {
  const pairs: Array<{ a: string; b: string }> = []
  function walk(itemList: any[]) {
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
 * loincCode (if present) goes into detail.code.coding, stepTitle into
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
   * Defined in `ig/input/fsh/<tool>.fsh`. When adding a new SPiER CarePlan
   * profile, extend this union (and add a regression test in the mapper).
   */
  profileUrl:
    | 'http://spier.org/StructureDefinition/spier-stanley-brown-safety-plan'
    | 'http://spier.org/StructureDefinition/spier-cams-stabilization-plan'
    | 'http://spier.org/StructureDefinition/spier-cams-therapeutic-worksheet'
  noteText: string
  activities: CarePlanActivity[]
  hasAnyData: boolean
}): GeneratedCarePlan {
  const resource = {
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
            display: 'Treatment plan for suicide prevention',
          },
        ],
      },
    ],
    subject: {
      reference: 'Patient/demo-patient',
      display: 'Demo Patient (no data persisted to server)',
    },
    addresses: [{ display: 'Risk for suicide' }],
    activity: options.activities.map(a => ({
      detail: {
        code: a.loincCode
          ? { coding: [{ system: 'http://loinc.org', code: a.loincCode }], text: a.stepTitle }
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
