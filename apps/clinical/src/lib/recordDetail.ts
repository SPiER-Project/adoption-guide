/**
 * One record, resolved for reading — the answers, the result, the plan's steps
 * and the handful of facts that are not any of those.
 *
 * ── What this is for ──────────────────────────────────────────────────────
 *
 * Every row on the care pathway's stages and on *What's on file* said what was
 * recorded, how it stood and when, and then stopped: a clinician could not see
 * the answers that were given, the score behind a result, or what a completed
 * form left on the chart. This is what an opened row shows.
 *
 * ⚠️ **Pure, and deliberately not a component.** The page renders what is
 * returned here and decides nothing about it; the judgement — which text is the
 * question, which value is the answer, which of a resource's fifteen elements a
 * clinician came for — is testable on its own, which is the only reason it can
 * be trusted to stay short.
 *
 * ⚠️ **The question text comes from the Questionnaire, not from the response.**
 * The captured responses in the demo population carry `linkId` and an answer and
 * no `text` at all, so a renderer reading the response alone shows nine answers
 * to nine unnamed questions. `QUESTIONNAIRE_BY_URL` is the join, and it is the
 * same registry the fillers render from — a second table of question text would
 * be a second answer to "what did the form ask", which is `check:dupes`'s
 * subject. A response that names an instrument SPiER does not hold falls back to
 * whatever `text` it carries, and to nothing when it carries none.
 *
 * ⚠️ **This module pulls the 18 Questionnaires in, which is 166.8 KB, so
 * nothing eager may import it.** That is the whole of `check:eager-forms`
 * (`docs/plans/tool-bundling-audit-2026-09-19.md` §5.1): the forms belong in a
 * lazy chunk, and the one page that uses this is `lazy()` in the route table
 * exactly like the fillers are.
 */
import { QUESTIONNAIRE_BY_URL } from '@spier/core/data/questionnaires'
import { stripCanonicalVersion } from '@spier/core/data/catalog'
import { displayFor } from '@spier/core/lib/codedOption'
import { outreachOutcome, OUTREACH_OUTCOMES } from '@spier/core/lib/followUp'
import type { FhirResourceLike } from '@spier/core/lib/patientPathway'
import type {
  CommunicationResource,
  QuestionnaireItem,
  QuestionnaireResource,
  QuestionnaireResponseItem,
  QuestionnaireResponseResource,
} from '@spier/core/types/fhir'
import { formatDate, formatDateTime, formatTime } from '@spier/tool-views/lib/dates'

/* ---------- The answers ---------- */

/** One question and everything answered to it. */
export interface AnswerLine {
  linkId: string
  /** The question as the instrument asks it, or null when nothing names it. */
  question: string | null
  answers: string[]
}

/** A section of the form — its heading, and the questions under it. */
export interface AnswerSection {
  /** The group's own text, or null for a form with no groups (the PHQ-9). */
  heading: string | null
  lines: AnswerLine[]
}

/** linkId → the text the Questionnaire asks, for every item at any depth. */
function questionText(questionnaire: QuestionnaireResource | undefined): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (items: QuestionnaireItem[] | undefined) => {
    for (const item of items ?? []) {
      if (item.linkId && item.text && !out.has(item.linkId)) out.set(item.linkId, item.text)
      walk(item.item)
    }
  }
  walk(questionnaire?.item)
  return out
}

/**
 * One captured answer as words.
 *
 * ⚠️ A boolean reads as Yes/No rather than as `true`. Every instrument here
 * asks its yes/no items as `choice` with coded options, so this branch is for
 * a response captured elsewhere — which is precisely where the wire's spelling
 * would otherwise reach a clinician.
 */
function answerText(answer: Record<string, unknown>): string | null {
  const coding = answer.valueCoding as { display?: string; code?: string } | undefined
  if (coding) return coding.display ?? coding.code ?? null
  if (typeof answer.valueString === 'string') return answer.valueString.trim() || null
  if (typeof answer.valueInteger === 'number') return String(answer.valueInteger)
  if (typeof answer.valueDecimal === 'number') return String(answer.valueDecimal)
  if (typeof answer.valueBoolean === 'boolean') return answer.valueBoolean ? 'Yes' : 'No'
  if (typeof answer.valueDate === 'string') return formatDate(answer.valueDate)
  if (typeof answer.valueDateTime === 'string') return formatDateTime(answer.valueDateTime)
  const quantity = answer.valueQuantity as { value?: number; unit?: string } | undefined
  if (quantity && typeof quantity.value === 'number') {
    return quantity.unit ? `${quantity.value} ${quantity.unit}` : String(quantity.value)
  }
  return null
}

/**
 * The form as it was filled in: its groups, and the answers under each.
 *
 * ⚠️ **Repeats merge into one line, and that is the safety plan's shape rather
 * than a shortcut.** Stanley-Brown asks for four warning signs as four answers
 * to the same `linkId`, and the CarePlan SPiER generates from it joins them into
 * one sentence per step (`carePlanMappers/stanleyBrown.ts`). Splitting them here
 * would make the record and the plan built from it disagree about how many
 * things the patient said.
 */
export function answerSections(response: QuestionnaireResponseResource): AnswerSection[] {
  const canonical = response.questionnaire ? stripCanonicalVersion(response.questionnaire) : ''
  const text = questionText(QUESTIONNAIRE_BY_URL[canonical] as QuestionnaireResource | undefined)

  const sections: AnswerSection[] = []
  const sectionFor = (heading: string | null): AnswerSection => {
    const last = sections.at(-1)
    if (last && last.heading === heading) return last
    const made: AnswerSection = { heading, lines: [] }
    sections.push(made)
    return made
  }

  const walk = (items: QuestionnaireResponseItem[] | undefined, heading: string | null) => {
    for (const item of items ?? []) {
      const linkId = item.linkId ?? ''
      const label = text.get(linkId) ?? item.text ?? null
      const answers = (item.answer ?? [])
        .map(a => answerText(a as Record<string, unknown>))
        .filter((a): a is string => a !== null)
      const nested = [
        ...(item.item ?? []),
        ...(item.answer ?? []).flatMap(a => (a as QuestionnaireResponseItem).item ?? []),
      ]

      if (answers.length > 0) {
        const section = sectionFor(heading)
        const line = section.lines.find(l => l.linkId === linkId)
        if (line) line.answers.push(...answers)
        else section.lines.push({ linkId, question: label, answers })
      }
      // A group with no answers of its own is a heading for what is under it —
      // the OUTERMOST such group, so the safety plan's sections are the seven
      // steps it publishes rather than the repeating sub-group inside one of
      // them. A group that answered as well keeps the heading it was already
      // under, so a question never becomes the title of its own answer.
      if (nested.length > 0) walk(nested, answers.length === 0 ? (heading ?? label) : heading)
    }
  }

  walk(response.item, null)
  return sections.filter(s => s.lines.length > 0)
}

/* ---------- The result ---------- */

/** What a recorded result says: the value, and what it was read as. */
export interface ResultReading {
  value: string | null
  /** The interpretation in the instrument's own words, where it carries one. */
  interpretation: string | null
}

export function resultReading(resource: FhirResourceLike): ResultReading {
  const o = resource as {
    valueInteger?: number
    valueDecimal?: number
    valueString?: string
    valueBoolean?: boolean
    valueQuantity?: { value?: number; unit?: string }
    valueCodeableConcept?: { text?: string; coding?: { display?: string }[] }
    interpretation?: { text?: string; coding?: { display?: string }[] }[]
  }
  const quantity = o.valueQuantity
  const coded = o.valueCodeableConcept
  const value =
    typeof o.valueInteger === 'number'
      ? String(o.valueInteger)
      : typeof o.valueDecimal === 'number'
        ? String(o.valueDecimal)
        : typeof o.valueString === 'string'
          ? o.valueString
          : typeof o.valueBoolean === 'boolean'
            ? o.valueBoolean
              ? 'Yes'
              : 'No'
            : quantity && typeof quantity.value === 'number'
              ? quantity.unit
                ? `${quantity.value} ${quantity.unit}`
                : String(quantity.value)
              : (coded?.text ?? coded?.coding?.[0]?.display ?? null)
  const interpretation = o.interpretation?.[0]
  return {
    value,
    interpretation: interpretation?.text ?? interpretation?.coding?.[0]?.display ?? null,
  }
}

/* ---------- The plan ---------- */

/** One step of a care plan: its title, and what was written under it. */
export interface PlanStep {
  title: string
  detail: string | null
}

export function planSteps(resource: FhirResourceLike): PlanStep[] {
  const activities =
    (resource as { activity?: { detail?: { code?: { text?: string }; description?: string } }[] })
      .activity ?? []
  return activities
    .map((a, i) => ({
      title: a.detail?.code?.text ?? `Step ${i + 1}`,
      detail: a.detail?.description ?? null,
    }))
    .filter(step => step.detail !== null)
}

/* ---------- Everything else ---------- */

/** One labelled fact about a record. */
export interface RecordFact {
  label: string
  value: string
}

const first = (values: (string | undefined | null)[]): string | null =>
  values.find(v => typeof v === 'string' && v.trim() !== '')?.trim() ?? null

/**
 * The few elements a clinician opened this record for, beyond its name, its
 * state and its date — which the page's own header already carries.
 *
 * ⚠️ **Readers, not a branch per resource type.** `workflowArtifactDisplay` is
 * already the per-type switch for name/state/date and this would have been a
 * second one; what is actually type-specific is which element holds the fact, so
 * each reader below names the fact and tries the one or two places it lives. A
 * resource that carries none of them shows none, which is the honest outcome for
 * a record whose whole content is its name and its date.
 */
export function recordFacts(resource: FhirResourceLike): RecordFact[] {
  const r = resource as {
    start?: string
    end?: string
    medium?: { coding?: { display?: string }[] }[]
    payload?: { contentString?: string }[]
    performer?: { display?: string }[]
    participant?: { actor?: { display?: string } }[]
    reasonCode?: { text?: string; coding?: { display?: string }[] }[]
    note?: { text?: string }[]
  }
  const facts: RecordFact[] = []
  const add = (label: string, value: string | null) => {
    if (value) facts.push({ label, value })
  }

  add('Reason', first([r.reasonCode?.[0]?.text, r.reasonCode?.[0]?.coding?.[0]?.display]))
  add('Sent to', first((r.performer ?? []).map(p => p?.display)))
  add('With', first((r.participant ?? []).map(p => p?.actor?.display)))
  add('How', first((r.medium ?? []).flatMap(m => (m?.coding ?? []).map(c => c?.display))))
  if (resource.resourceType === 'Communication') {
    const outcome = outreachOutcome(resource as CommunicationResource)
    add('Outcome', outcome ? displayFor(OUTREACH_OUTCOMES, outcome) : null)
    add('What was sent', first((r.payload ?? []).map(p => p?.contentString)))
  }
  if (r.start) {
    // The end is a clock time, not a second date: the start already said the day
    // and the header above it said the day before that.
    add('Time', r.end ? `${formatDateTime(r.start)} to ${formatTime(r.end)}` : formatDateTime(r.start))
  }
  add('Note', first((r.note ?? []).map(n => n?.text)))
  return facts
}
