/**
 * Caring-contact cadence — which contact in the post-transition series is due,
 * and when (#628).
 *
 * ⚠️ **The offsets are NOT written here.** They are read out of
 * `PlanDefinition-SPiERCaringContactSchedule.json`, the generated form of
 * `ig/input/fsh/follow-up.fsh`, exactly as `reassessment.ts` reads its
 * schedule: editing the FSH changes this module's answers with no TypeScript
 * change. So is what counts as a care transition — the schedule's
 * `care-transition` action names the profiles of the records that mark one.
 *
 * ── The rule ────────────────────────────────────────────────
 *
 * The anchor is the most recent care transition. Each contact in the series
 * has a WINDOW that closes at its offset: the first closes 48 hours after the
 * transition, the second at 7 days, the third at 30. A contact sent inside a
 * window satisfies it. A window that closes unsent is **missed** — and the next
 * contact is the one due, rather than the missed one staying overdue, because
 * the series is spaced on purpose: a clinician who missed the 48-hour contact
 * sends the 7-day one at 7 days, not three messages to catch up. Decided
 * 2026-10-12.
 *
 * An opt-out on any caring contact stops the series. That matches the Stage-8
 * measure, which excludes a patient who opted out on any contact.
 *
 * ── Agreement with the measure ──────────────────────────────
 *
 * `SPiERCaringContactAdherence` counts a contact sent within 30 days of the
 * index transition. Every window here closes at or before the last offset, so
 * a contact this module counts is inside the measure's window while the last
 * offset is at most 30 days — `tests/caringContactSchedule.test.ts` fails if
 * it is not, and fails if the transition profiles here and in `measures.ts`
 * differ. A patient this module calls on schedule is therefore never one the
 * measure counts as a miss.
 *
 * **State is computed on read, never stored** — the `reassessment.ts` rule.
 *
 * React-free and DOM-free (`npm run check:core-boundary`).
 */
import type { CommunicationResource, DocumentReferenceResource } from '../types/fhir'
import { caringContactOptedOut, CARING_CONTACT_PROFILE } from './followUp'
import { conformsTo, timeOf } from './recordQueries'

export const CARING_CONTACT_SCHEDULE_URL =
  'http://thespierproject.org/fhir/PlanDefinition/SPiERCaringContactSchedule'

const TRANSITION_ACTION_ID = 'care-transition'

interface QuantityDoc {
  value?: number
  code?: string
}

interface ScheduleActionDoc {
  id?: string
  title?: string
  input?: Array<{ type?: string; profile?: string[] }>
  relatedAction?: Array<{
    actionId?: string
    relationship?: string
    offsetDuration?: QuantityDoc
    offsetRange?: { low?: QuantityDoc; high?: QuantityDoc }
  }>
}

interface ScheduleDoc {
  url?: string
  action?: ScheduleActionDoc[]
}

const planModules = import.meta.glob<{ default: ScheduleDoc }>(
  // ⚠️ Relative, not `@spier/fhir-artifacts/...`: Vite does not resolve aliases
  // inside `import.meta.glob`. The same path `reassessment.ts` uses.
  '../../../fhir-artifacts/generated/PlanDefinition-*.json',
  { eager: true },
)

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** The UCUM duration units this module converts, in hours. */
export const UCUM_HOURS: Record<string, number> = { h: 1, d: 24, wk: 24 * 7 }

function hoursOf(q: QuantityDoc | undefined): number | undefined {
  if (q?.value === undefined) return undefined
  const perUnit = UCUM_HOURS[q.code ?? 'h']
  return perUnit === undefined ? undefined : q.value * perUnit
}

export interface CaringContactSlot {
  /** `action.id` in the schedule. */
  id: string
  /** 1-based position in the series. */
  ordinal: number
  title: string
  /** The earliest the published window names, in hours after the transition. */
  fromHours: number
  /** When the window closes, in hours after the transition. */
  byHours: number
}

export interface CaringContactSchedule {
  slots: CaringContactSlot[]
  /** Profiles of the records that mark a care transition. */
  transitionProfiles: string[]
}

function readSchedule(): CaringContactSchedule {
  const doc = Object.values(planModules)
    .map(m => m.default)
    .find(d => d.url === CARING_CONTACT_SCHEDULE_URL)
  // An absent schedule yields no slots, so every patient reads as having no
  // series rather than a hardcoded one — a wrong due date is worse than none.
  const actions = doc?.action ?? []
  const transitionProfiles = (actions.find(a => a.id === TRANSITION_ACTION_ID)?.input ?? []).flatMap(
    i => i.profile ?? [],
  )
  const slots: CaringContactSlot[] = []
  for (const action of actions) {
    const offset = action.relatedAction?.find(r => r.actionId === TRANSITION_ACTION_ID)
    if (!action.id || !offset) continue
    const byHours = hoursOf(offset.offsetRange?.high ?? offset.offsetDuration)
    const fromHours = hoursOf(offset.offsetRange?.low ?? offset.offsetDuration)
    if (byHours === undefined || fromHours === undefined) continue
    slots.push({ id: action.id, ordinal: 0, title: action.title ?? action.id, fromHours, byHours })
  }
  slots.sort((a, b) => a.byHours - b.byHours).forEach((s, i) => (s.ordinal = i + 1))
  return { slots, transitionProfiles }
}

/** The published caring-contact schedule. */
export const CARING_CONTACT_SCHEDULE: CaringContactSchedule = readSchedule()

/** "24–48 hours", "7 days" — a slot's offset as a reader says it. */
export function slotOffsetLabel(slot: CaringContactSlot): string {
  // Under three days is said in hours — "24–48 hours" is how the schedule and
  // the literature put the first contact, and "1–2 days" is a looser promise.
  const inDays = (hours: number) => hours >= 72 && hours % 24 === 0
  const say = (hours: number) => (inDays(hours) ? `${hours / 24} days` : `${hours} hours`)
  if (slot.fromHours === slot.byHours) return say(slot.byHours)
  // A range is said in one unit, so never "24 hours–3 days".
  return inDays(slot.fromHours) && inDays(slot.byHours)
    ? `${slot.fromHours / 24}–${slot.byHours / 24} days`
    : `${slot.fromHours}–${slot.byHours} hours`
}

/** The cadence as one phrase: "24–48 hours, 7 days and 30 days after a care transition". */
export function caringContactCadenceLabel(schedule: CaringContactSchedule = CARING_CONTACT_SCHEDULE): string {
  const parts = schedule.slots.map(slotOffsetLabel)
  if (parts.length === 0) return 'No caring-contact schedule is published.'
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
  return `${list} after a care transition`
}

/**
 * How soon "due soon" is, in days — the reassessment column's threshold
 * (`DUE_SOON_DAYS` there), so the caseload's two cadences warn on one clock.
 */
export const CARING_CONTACT_DUE_SOON_DAYS = 2

export type CaringContactState =
  /** No care transition on record, so no series has started. */
  | { kind: 'no-transition' }
  | {
      kind: 'opted-out'
      transitionDate: string
    }
  | {
      kind: 'scheduled'
      transitionDate: string
      /** The contact due next. */
      next: CaringContactSlot
      /** ISO date (YYYY-MM-DD) its window closes. */
      dueDate: string
      /** Whole calendar days until it closes; 0 on the day itself. Never negative. */
      daysUntilDue: number
      status: 'due-today' | 'due-soon' | 'scheduled'
      sent: number
      missed: number
      total: number
    }
  | {
      /** Every window has closed. */
      kind: 'complete'
      transitionDate: string
      sent: number
      missed: number
      total: number
    }

/** The slice of a chart this reads. */
export interface CaringContactRecord {
  communications?: CommunicationResource[]
  documentReferences?: DocumentReferenceResource[]
}

/** When a care transition happened, per record, by the schedule's own definition. */
function transitionTimes(record: CaringContactRecord, profiles: string[]): number[] {
  const communications = (record.communications ?? [])
    .filter(c => profiles.some(p => conformsTo(c, p)))
    .map(c => timeOf(c.sent))
  const documents = (record.documentReferences ?? [])
    .filter(d => profiles.some(p => conformsTo(d, p)))
    .map(d => timeOf((d as { date?: string }).date))
  return [...communications, ...documents].filter(Number.isFinite)
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString()
}

/**
 * Where a patient's caring-contact series stands.
 *
 * Counts from the MOST RECENT transition, as the measure's index does: a
 * second discharge starts a new series, and contacts sent for the first one do
 * not count toward it.
 */
export function caringContactState(
  record: CaringContactRecord,
  now: Date = new Date(),
  schedule: CaringContactSchedule = CARING_CONTACT_SCHEDULE,
): CaringContactState {
  const times = transitionTimes(record, schedule.transitionProfiles)
  if (times.length === 0 || schedule.slots.length === 0) return { kind: 'no-transition' }
  const anchor = Math.max(...times)
  const transitionDate = isoOf(anchor)

  const contacts = (record.communications ?? []).filter(c => conformsTo(c, CARING_CONTACT_PROFILE))
  if (contacts.some(caringContactOptedOut)) return { kind: 'opted-out', transitionDate }

  const sentAt = contacts.map(c => timeOf(c.sent)).filter(n => Number.isFinite(n) && n >= anchor)
  const nowMs = now.getTime()
  const total = schedule.slots.length

  let sent = 0
  let missed = 0
  let opensAt = anchor
  for (const slot of schedule.slots) {
    const closesAt = anchor + slot.byHours * HOUR_MS
    // Closed at the top, as the measure's interval is — a contact exactly on
    // the 30th day counts — and open at the bottom after the first window, so
    // a contact on day 7 fills the second window and not the third as well.
    const first = opensAt === anchor
    const satisfied = sentAt.some(t => (first ? t >= opensAt : t > opensAt) && t <= closesAt)
    if (satisfied) sent++
    else if (closesAt < nowMs) missed++
    else {
      const dueDay = Date.UTC(
        new Date(closesAt).getUTCFullYear(),
        new Date(closesAt).getUTCMonth(),
        new Date(closesAt).getUTCDate(),
      )
      const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      const daysUntilDue = Math.max(0, Math.round((dueDay - today) / DAY_MS))
      return {
        kind: 'scheduled',
        transitionDate,
        next: slot,
        dueDate: isoOf(closesAt).slice(0, 10),
        daysUntilDue,
        status:
          daysUntilDue === 0 ? 'due-today' : daysUntilDue <= CARING_CONTACT_DUE_SOON_DAYS ? 'due-soon' : 'scheduled',
        // Slots after this one cannot have been satisfied or missed yet.
        sent,
        missed,
        total,
      }
    }
    opensAt = closesAt
  }
  return { kind: 'complete', transitionDate, sent, missed, total }
}

/** Whether the state asks a clinician to send a contact now. */
export function caringContactDue(state: CaringContactState): boolean {
  return state.kind === 'scheduled' && state.status !== 'scheduled'
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth']

/** "Second caring contact", for a slot. */
export function slotName(slot: CaringContactSlot): string {
  const word = ORDINAL[slot.ordinal - 1] ?? `${slot.ordinal}th`
  return `${word[0].toUpperCase()}${word.slice(1)} caring contact`
}

/** Human-readable status, for the caseload column and the chart's reason line. */
export function caringContactStatusLabel(state: CaringContactState): string {
  const missedNote = (missed: number) => (missed > 0 ? ` · ${missed} missed` : '')
  switch (state.kind) {
    case 'no-transition':
      return 'No care transition'
    case 'opted-out':
      return 'Opted out'
    case 'complete':
      return `Series complete · ${state.sent} of ${state.total} sent`
    case 'scheduled': {
      const when =
        state.status === 'due-today'
          ? 'due today'
          : `due in ${state.daysUntilDue} day${state.daysUntilDue === 1 ? '' : 's'}`
      return `${slotName(state.next)} ${when}${missedNote(state.missed)}`
    }
  }
}
