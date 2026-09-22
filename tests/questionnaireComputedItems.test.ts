/**
 * A computed item is hidden until after submission — in the PUBLISHED
 * Questionnaire, not in the React filler.
 *
 * ── The defect this exists for ──────────────────────────────────────────────
 *
 * The C-SSRS Screener's *Suicide Risk Level* is derived from q1–q6 by
 * `observationMappers/cssrsScreener.ts`; the clinician is never asked for it,
 * and the artifact says so with `readOnly: true`. It nonetheless rendered as an
 * empty radio group at the bottom of the form, in the same typeface as the six
 * items they do answer — which reads as a seventh question (Brad, 2026-09-22).
 * The PHQ-9 and SBQ-R totals are the same class one step along: derived, and
 * standing in the middle of the questions that derive them.
 *
 * ⚠️ **The fix belongs in the artifact, and this is why.** A filter in
 * `QuestionnaireView` would hide these items in SPiER's own filler and nowhere
 * else, and the Questionnaire is the thing SPiER publishes — an EHR rendering
 * it with its own renderer would still put the empty radio group in front of
 * its clinicians. `http://hl7.org/fhir/StructureDefinition/questionnaire-hidden`
 * is the standard R4 way to say it, `@formbox/renderer` honours it, and it
 * travels with the resource.
 *
 * ⚠️ **Hidden does not mean absent from the response.** formbox gates the
 * response snapshot on `enableWhen` alone (`buildItemSnapshot`), never on
 * hidden, so the two `calculatedExpression` totals still compute and still land
 * in the QuestionnaireResponse — which is what keeps their declared
 * `observationExtract` contract true (`npm run check:extract`).
 *
 * ── Why a rule over the CLASS and not a list of the five ────────────────────
 *
 * A list of instances is a sample. The rules below are derived from the
 * registry both ways: every item a clinician is not asked to answer is hidden,
 * and nothing hidden is an item they ARE asked for. A nineteenth instrument
 * with a computed total is covered without anyone remembering this file.
 */
import { describe, it, expect } from 'vitest'
import { QUESTIONNAIRE_BY_URL } from '@spier/core/data/questionnaires'
import type { QuestionnaireResource } from '@spier/core/types/fhir'

const HIDDEN_URL = 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden'
const TIER_DERIVATION_URL = 'http://thespierproject.org/fhir/StructureDefinition/tier-derivation'

interface Item {
  linkId?: string
  readOnly?: boolean
  item?: Item[]
  extension?: { url?: string; valueBoolean?: boolean; valueCode?: string }[]
}

interface Found {
  /** `<Questionnaire.id>/<linkId>`, so a failure names the file to open. */
  where: string
  readOnly: boolean
  hidden: boolean
  /** `computed`, `clinician-assigned`, or absent. */
  derivation: string | undefined
}

function extensionOf(item: Item, url: string) {
  return (item.extension ?? []).find((e) => e.url === url)
}

/** Every item in every hand-authored Questionnaire, flattened, with its id. */
function allItems(): Found[] {
  const out: Found[] = []
  for (const q of Object.values(QUESTIONNAIRE_BY_URL) as QuestionnaireResource[]) {
    const walk = (items: Item[] | undefined, id: string) => {
      for (const item of items ?? []) {
        out.push({
          where: `${id}/${item.linkId ?? '?'}`,
          readOnly: item.readOnly === true,
          hidden: extensionOf(item, HIDDEN_URL)?.valueBoolean === true,
          derivation: extensionOf(item, TIER_DERIVATION_URL)?.valueCode,
        })
        walk(item.item, id)
      }
    }
    walk((q as unknown as { item?: Item[] }).item, String(q.id ?? q.url))
  }
  return out
}

const ITEMS = allItems()
const QUESTIONNAIRES = Object.keys(QUESTIONNAIRE_BY_URL).length

describe('a computed item is hidden in the published Questionnaire', () => {
  /**
   * ⚠️ **The floors first.** Every rule below is a filter, and a filter over an
   * empty list passes having read nothing — which is how this repo's gates have
   * gone quietly green before (`scripts/lib/floors.mjs`). These are the real
   * counts on the day the rule was written, so a rename that empties the scan
   * fails here rather than in six months.
   */
  it('reads every hand-authored Questionnaire, and finds the items it is about', () => {
    expect(QUESTIONNAIRES).toBeGreaterThanOrEqual(18)
    expect(ITEMS.length).toBeGreaterThanOrEqual(200)
    expect(ITEMS.filter((i) => i.readOnly).length).toBeGreaterThanOrEqual(5)
    expect(ITEMS.filter((i) => i.derivation === 'computed').length).toBeGreaterThanOrEqual(3)
    expect(ITEMS.filter((i) => i.derivation === 'clinician-assigned').length).toBeGreaterThanOrEqual(2)
  })

  it('hides every item the clinician is not asked to answer', () => {
    const shown = ITEMS.filter((i) => i.readOnly && !i.hidden).map((i) => i.where)
    expect(
      shown,
      `${shown.join(', ')} is read-only — the app derives it — but renders in the form beside the ` +
        'questions it is derived from. Add the questionnaire-hidden extension in ' +
        'ig/input/resources/questionnaires/; the results screen is where a derived value belongs.',
    ).toEqual([])
  })

  it('hides nothing the clinician IS asked to answer', () => {
    const asked = ITEMS.filter((i) => i.hidden && !i.readOnly).map((i) => i.where)
    expect(
      asked,
      `${asked.join(', ')} is hidden but not read-only, so a question a clinician has to answer ` +
        'renders nowhere. Hidden is for a value the app computes.',
    ).toEqual([])
  })

  /**
   * The distinction the whole rule turns on. SAFE-T and the full PSS both end
   * on a risk level too — but theirs is the clinician's formulation, which is
   * the point of those instruments, so it is `clinician-assigned` rather than
   * `computed` and it stays on the form.
   */
  it('leaves a tier the clinician assigns on the form', () => {
    const judgement = ITEMS.filter((i) => i.derivation === 'clinician-assigned')
    for (const item of judgement) {
      expect(item.hidden, `${item.where} is the clinician's own judgement and must be asked for`).toBe(false)
      expect(item.readOnly, `${item.where} is the clinician's own judgement and must be answerable`).toBe(false)
    }
  })
})
