/**
 * chartRecord — what this server already holds about one patient, in the shape
 * a chart draws it.
 *
 * ── Why this module exists ──────────────────────────────────────────────────
 *
 * The chart page showed a name, an MRN, a birth date and a sex, and nothing
 * else. Everything below that line was about the demo: a launch button, the
 * cards the CDS service returned, and a drawer full of evidence. Reviewed as a
 * chart rather than as a demo (2026-09-22), it is not a sparse chart — it is an
 * empty one, and a viewer who is asked to believe that SPiER runs inside an EHR
 * is looking at a page no EHR would ever serve.
 *
 * Meanwhile this server holds, per patient, exactly the material a chart is made
 * of: encounters with a class and a period, referrals with a performer, booked
 * appointments, safety flags, an open episode, outstanding tasks, and the
 * assessment results themselves. None of it was on screen.
 *
 * ⚠️ **Everything here is DERIVED from a resource this server serves over
 * `/fhir`, and nothing is invented.** That is a demo claim, not tidiness: the
 * page's whole subject is that the panel beside it is reading and writing a real
 * record, and a chart padded with plausible-looking vitals nobody can fetch is
 * the one thing that would make the rest of it unbelievable. A tile that has no
 * resource behind it does not get rendered — which is why patient-002's chart is
 * nearly bare, and why that is the correct output rather than a gap to fill.
 *
 * ⚠️ **Fixtures only, deliberately, for now.** `HELD_RESOURCES` is the bundled
 * scenario set; resources the panel WRITES land in the Durable Object and are
 * not read back here, so a chart can be behind what the panel just recorded.
 * The launch card already says so (`#written-since`, outside the drawer) and
 * that line is the reason this is a known limit rather than a lie. Reading the
 * store would make every chart render await KV.
 */
import { HELD_RESOURCES, type MockResource } from './fixtures'

/**
 * How loud a thing is, in the host's four status colours. Maps to
 * `--critical` / `--warning` / `--notice` / `--action` — see `TOKENS`.
 */
export type ChartTone = 'critical' | 'warning' | 'notice' | 'info'

/**
 * `Type/id` of the resource a displayed thing came from.
 *
 * ⚠️ **Every chip and every tile carries one, and a test resolves it against
 * what this server serves.** The invariant is the demo's central claim — the
 * panel beside this chart is reading a real record, so the chart may not show
 * anything that record does not contain — and it needs to be checkable rather
 * than asserted in a comment. The first version of that test compared the
 * rendered LABEL against the scenario JSON, which held only as long as no label
 * was composed: the moment a chip read "Episode open · since 2 Aug" the check
 * went red for a chart that was entirely honest. A provenance reference is the
 * property that was actually meant.
 */
export type ResourceRef = string

/** A status pill in the patient header: a safety flag, an open episode, a task. */
export interface ChartChip {
  label: string
  tone: ChartTone
  /** The hover title — the sentence behind the pill, where the resource has one. */
  detail?: string
  /** The resource(s) this pill states a fact about. Never empty. */
  from: ResourceRef[]
}

/** One result tile: the label, the short value, and when it was taken. */
export interface ChartResult {
  label: string
  value: string
  /** The Observation this tile displays. */
  from: ResourceRef
  /** Display date, e.g. "2 Aug 2026". */
  when: string
  /** The raw instant, kept for sorting and for the tile's `title`. */
  iso: string
  tone: ChartTone
  /** "was 12 on 28 Jul" — present only when this code was measured before. */
  trend?: string
  /** The clinician's sentence under the number, where the resource carries one. */
  note?: string
}

/**
 * One line in a chart section: what happened, when, and its status.
 *
 * ⚠️ **One shape for encounters, orders, appointments, documents and plan
 * activities, and that is a claim about the PAGE rather than about FHIR.** Each
 * of those resources is different and the chart shows the same four things about
 * every one of them — a title, a qualifier, a date and a state — because that is
 * what a chart line is. Five bespoke row types would be five places to fix the
 * next time a date format changes.
 */
export interface ChartEntry {
  title: string
  /** The second line: a performer, a medium, a reason — whatever the resource has. */
  detail?: string
  /** Display date. */
  when: string
  /** The raw instant, for sorting. */
  iso: string
  /** `finished`, `completed`, `booked` … the resource's own status word. */
  status?: string
  tone: ChartTone
  from: ResourceRef
}

/** A titled group of entries in the chart body. Rendered only when non-empty. */
export interface ChartSection {
  /** Anchors the heading and the aria-label; also the test's handle. */
  id: string
  title: string
  entries: ChartEntry[]
}

/** Everything the chart draws about one patient that is not their demographics. */
export interface ChartRecord {
  chips: ChartChip[]
  results: ChartResult[]
  /** The wide column: what happened, and what was ordered. */
  main: ChartSection[]
  /** The narrow column: the plan, what is booked, what was handed over. */
  side: ChartSection[]
}

/*
 * ── Reading FHIR, narrowly ───────────────────────────────────────────────────
 *
 * These helpers read the handful of elements the chart displays and nothing
 * else. They are deliberately not a FHIR library: every one of them answers
 * "what does a human read here", and each returns undefined rather than
 * throwing, because a fixture that grows an unexpected shape should cost one
 * missing line on a demo page and not a 500.
 */

interface Coding { system?: string; code?: string; display?: string }
interface CodeableConcept { coding?: Coding[]; text?: string }

/** A coding's short label — the instrument's own word for the thing. */
function codingDisplayOf(concept: unknown): string | undefined {
  const cc = concept as CodeableConcept | undefined
  if (!cc || typeof cc !== 'object') return undefined
  return cc.coding?.find(c => typeof c?.display === 'string' && c.display)?.display || undefined
}

/** A concept's `text` — in these fixtures, the longer encounter-specific sentence. */
function textOf(concept: unknown): string | undefined {
  const cc = concept as CodeableConcept | undefined
  if (!cc || typeof cc !== 'object') return undefined
  return typeof cc.text === 'string' && cc.text ? cc.text : undefined
}

/**
 * The words a human reads for a CodeableConcept: its text, else its first
 * display.
 *
 * ⚠️ **Text first here, and coding-display first in the tiles**, which looks
 * inconsistent and is the fixtures being read correctly. `text` is where these
 * scenarios put the specific sentence — "Suicide precautions ON — continuous 1:1
 * observation" — which is exactly what a chip wants and exactly what overflows a
 * tile. A tile wants the coding's short label and keeps the sentence as its note.
 */
function displayOf(concept: unknown): string | undefined {
  return textOf(concept) ?? codingDisplayOf(concept)
}

function stringAt(resource: MockResource, key: string): string | undefined {
  const value = resource[key]
  return typeof value === 'string' && value ? value : undefined
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "2 Aug 2026", in UTC.
 *
 * ⚠️ Hand-formatted rather than `toLocaleDateString`, and UTC rather than local.
 * Two reasons, both about this being a demo that gets screenshotted: a locale
 * formatter makes the page read differently for the presenter and the audience,
 * and a local-time render moves a 23:10 shift-change observation onto the wrong
 * DAY depending on where the browser is. The fixtures are authored in UTC
 * (`check:dates` reasons about them that way), so they are read in UTC.
 */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return '—'
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`
}

/** "2 Aug", for the second mention of a date the reader has already seen. */
function formatDayMonth(iso: string | undefined): string {
  if (!iso) return '—'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return '—'
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`
}

/**
 * Age in whole years at today's date, for the header's "34Y" pill.
 *
 * Derived rather than stored for the reason `DEMO_PATIENTS` is derived: an age
 * typed anywhere would be wrong by one from the patient's next birthday onward,
 * and nothing would say so.
 */
export function ageOn(birthDate: string | undefined, today: Date = new Date()): number | null {
  if (!birthDate) return null
  const born = new Date(birthDate)
  if (Number.isNaN(born.getTime())) return null
  let age = today.getUTCFullYear() - born.getUTCFullYear()
  const month = today.getUTCMonth() - born.getUTCMonth()
  if (month < 0 || (month === 0 && today.getUTCDate() < born.getUTCDate())) age -= 1
  return age >= 0 ? age : null
}

/** This patient's resources of one type, in scenario order. */
function heldFor(patientId: string, type: string): MockResource[] {
  return HELD_RESOURCES
    .filter(h => h.patientId === patientId && h.resource.resourceType === type)
    .map(h => h.resource)
}

/** The `Type/id` a displayed thing points back at. See `ResourceRef`. */
function refOf(resource: MockResource): ResourceRef {
  return `${resource.resourceType}/${String(resource.id)}`
}

/*
 * ── The header's chips ───────────────────────────────────────────────────────
 *
 * The row a clinician reads before anything else, and the one place on this page
 * where a resource earns the page's loudest colour. Three kinds, in the order
 * they matter: an active safety Flag, an open EpisodeOfCare, and a Task that is
 * still owed.
 *
 * ⚠️ **Only ACTIVE ones.** A finished episode and a completed task are chart
 * history, not chart status, and a header that keeps showing them is a header
 * nobody reads twice. They are not lost — they belong in the timeline.
 */

/** `Flag.status: active` — the safety alert, and the only critical-toned chip. */
function flagChips(patientId: string): ChartChip[] {
  return heldFor(patientId, 'Flag')
    .filter(flag => stringAt(flag, 'status') === 'active')
    .map((flag) => {
      const period = flag.period as { start?: string } | undefined
      const since = period?.start ? ` · since ${formatDayMonth(period.start)}` : ''
      return {
        label: displayOf(flag.code) ?? 'Safety alert',
        tone: 'critical' as const,
        detail: `Safety alert on this record${since}.`,
        from: [refOf(flag)],
      }
    })
}

/**
 * `EpisodeOfCare.status: active` — the patient is in an open episode of care.
 *
 * ⚠️ **The label depends on whether a Flag already said it, and that is not
 * over-thinking.** patient-011's flag reads "Active suicide-safer care episode"
 * and its episode is of type "Suicide-safer care episode": the first render put
 * both in the header, side by side, and the row read as a stutter — two pills
 * saying one thing, which is how a header teaches people to stop reading it. So
 * when a flag is already naming the episode, this chip carries the part the flag
 * does NOT have, which is when it opened.
 */
function episodeChips(patientId: string, named: boolean): ChartChip[] {
  return heldFor(patientId, 'EpisodeOfCare')
    .filter(episode => stringAt(episode, 'status') === 'active')
    .map((episode) => {
      const period = episode.period as { start?: string } | undefined
      const type = (episode.type as CodeableConcept[] | undefined)?.[0]
      const since = period?.start ? ` · since ${formatDayMonth(period.start)}` : ''
      return {
        label: named ? `Episode open${since}` : `${displayOf(type) ?? 'Episode of care'}${since}`,
        tone: 'warning' as const,
        detail: period?.start ? `Open since ${formatDate(period.start)}.` : 'Open episode of care.',
        from: [refOf(episode)],
      }
    })
}

/**
 * Tasks still owed, as ONE chip rather than one chip each.
 *
 * ⚠️ A chip per task is how a header becomes a list. The count is the thing a
 * clinician acts on ("is anything outstanding"); which tasks they are is a
 * question the chart body answers.
 */
function taskChip(patientId: string): ChartChip[] {
  const open = heldFor(patientId, 'Task').filter((task) => {
    const status = stringAt(task, 'status')
    return status === 'requested' || status === 'in-progress' || status === 'received' || status === 'accepted'
  })
  if (open.length === 0) return []
  const titles = open.map(task => displayOf(task.code) ?? 'Task').join('; ')
  return [{
    label: open.length === 1 ? '1 task open' : `${open.length} tasks open`,
    tone: 'warning',
    detail: titles,
    from: open.map(refOf),
  }]
}

/*
 * ── The result tiles ─────────────────────────────────────────────────────────
 *
 * Where a general chart puts vital signs, this one puts the assessment results —
 * and that is the better tile row for this demo rather than a substitute for a
 * missing one. These are the Observations SPiER writes back; the EHR displaying
 * them as its own chart data is the write-back claim made visible, in the place
 * a clinician's eye already goes.
 */

/**
 * v3-ObservationInterpretation → the host's status colours.
 *
 * ⚠️ **Read from `interpretation`, never inferred from the value's words.** The
 * tempting version of this function matches "High risk" and "Acute" in the
 * display string, which works on today's fourteen fixtures and silently
 * mis-colours the first instrument whose scale words differ. The code is the
 * statement; the display is a label for it.
 */
const TONE_FOR_INTERPRETATION: Record<string, ChartTone> = {
  HH: 'critical',
  H: 'warning',
  A: 'warning',
  N: 'notice',
}

function toneOf(observation: MockResource): ChartTone {
  const interpretations = observation.interpretation as CodeableConcept[] | undefined
  for (const entry of interpretations ?? []) {
    for (const coding of entry.coding ?? []) {
      const tone = coding.code ? TONE_FOR_INTERPRETATION[coding.code] : undefined
      if (tone) return tone
    }
  }
  return 'info'
}

/**
 * The short value a tile can hold, or null when this Observation is not a tile.
 *
 * ⚠️ **`valueString` is deliberately NOT a tile.** One fixture's value is a
 * 200-character sentence about a shift-change safety sweep; a tile is a number
 * and a label, so a free-text result is a note and belongs in the timeline. The
 * rule is the value's KIND, not its length — a length cut-off would put a short
 * sentence in a tile and the next one out of it, for no reason a reader could
 * see.
 *
 * `dataAbsentReason` IS a tile: "the screen was deferred because the patient was
 * not alert enough to answer" is a clinical finding, and a chart that renders it
 * as nothing loses it.
 */
function shortValueOf(observation: MockResource): string | null {
  const quantity = observation.valueQuantity as { value?: number; unit?: string } | undefined
  if (quantity && typeof quantity.value === 'number') {
    return quantity.unit ? `${quantity.value} ${quantity.unit}` : String(quantity.value)
  }
  if (typeof observation.valueInteger === 'number') return String(observation.valueInteger)
  const coded = codingDisplayOf(observation.valueCodeableConcept) ?? textOf(observation.valueCodeableConcept)
  if (coded) return coded
  const absent = codingDisplayOf(observation.dataAbsentReason) ?? textOf(observation.dataAbsentReason)
  if (absent) return absent
  return null
}

/**
 * The sentence under the number: the clinician's note, else whichever concept
 * text the tile's short value did not already say.
 *
 * ⚠️ Compared against `value` rather than assumed to differ. Several fixtures
 * carry a `text` that is the coding display verbatim, and a tile that printed it
 * twice — once as the value, once as the note — is the kind of thing that looks
 * like a rendering bug rather than a fixture.
 */
function noteOf(observation: MockResource, value: string): string | undefined {
  const notes = observation.note as Array<{ text?: string }> | undefined
  const note = notes?.find(n => typeof n?.text === 'string' && n.text)?.text
  if (note) return note
  const text = textOf(observation.valueCodeableConcept) ?? textOf(observation.dataAbsentReason)
  return text && text !== value ? text : undefined
}

/**
 * The key two Observations share when they are the same measurement repeated —
 * which is the key a tile trends against itself on.
 *
 * **The LOINC code, plus the profile it claims.** The code alone was the first
 * version and it collapsed patient-011's whole admission into one tile: the ASQ
 * screen, the brief safety assessment's determination and the two C-SSRS risk
 * levels are all LOINC 93374-7, so the chart's richest record showed a single
 * result. They are not one measurement taken four times — they are three
 * different instruments answering the same question, and the resources say so
 * themselves in `meta.profile`.
 *
 * ⚠️ **The profile, not the display.** The same LOINC is spelled "Suicide risk
 * level" by two of those four and given its own sentence by the others; keying
 * on the words would split a repeated measurement and merge two distinct ones,
 * in the same pass. A profile is the record's own statement about what kind of
 * thing this is. An unprofiled Observation keys on its code alone, which is
 * what makes the one unprofiled screen still trend against its re-attempt.
 */
function conceptKey(observation: MockResource): string {
  const code = observation.code as CodeableConcept | undefined
  const loinc = code?.coding?.find(c => c?.system === 'http://loinc.org' && c.code)?.code
  const meta = observation.meta as { profile?: string[] } | undefined
  const profile = meta?.profile?.[0] ?? ''
  return `${loinc ?? code?.text ?? 'unknown'}|${profile}`
}

/**
 * The tile's label.
 *
 * ⚠️ **`code.text` first, which is the opposite of the rule for the VALUE.** The
 * preference was inverted here at first, on the theory that a coding display is
 * always the short one, and the first render disproved it: LOINC's display for
 * 44261-6 is "Patient Health Questionnaire 9 item (PHQ-9) total score
 * [Reported]" and for 44260-8 it is a 96-character sentence about the last two
 * weeks. Both are correct LOINC and neither fits a tile. `code.text` is what the
 * fixture's author wrote for a human — "PHQ-9 total score" — so it wins, and the
 * coding display is the fallback for the codes that have no text.
 */
function labelOf(observation: MockResource): string {
  return displayOf(observation.code) ?? 'Result'
}

function effectiveOf(observation: MockResource): string {
  return stringAt(observation, 'effectiveDateTime') ?? stringAt(observation, 'issued') ?? ''
}

/**
 * The tiles: the latest value of each distinct measurement, newest first.
 *
 * ⚠️ **Capped, and the cap is about the row rather than the data.** A patient
 * with eight distinct results would wrap the tile row onto three lines and push
 * everything a clinician opened the chart for below the fold. Six is what fits
 * two lines at the narrowest width the chart keeps its two columns at; the rest
 * are still on the record, and the timeline is where they are read.
 */
const MAX_RESULT_TILES = 6

export function resultsFor(patientId: string): ChartResult[] {
  const scored = heldFor(patientId, 'Observation')
    .map(observation => ({ observation, value: shortValueOf(observation), iso: effectiveOf(observation) }))
    .filter((entry): entry is { observation: MockResource; value: string; iso: string } => entry.value !== null)
    .sort((a, b) => b.iso.localeCompare(a.iso))

  const seen = new Set<string>()
  const tiles: ChartResult[] = []
  for (const entry of scored) {
    const key = conceptKey(entry.observation)
    if (seen.has(key)) continue
    seen.add(key)
    // The most recent EARLIER reading of the same concept — the one this tile
    // trends against. `scored` is already newest-first, so the first match after
    // this entry is it.
    //
    // ⚠️ **An unchanged value is not a trend.** patient-011's boarding
    // reassessment repeats the same risk level hours later, and the first render
    // put "was High risk on 2 Aug" under "High risk · 2 Aug" — a line that costs
    // a reader a second to parse and tells them nothing. A trend is a CHANGE;
    // that the level held is what the note beside it says.
    const previous = scored.find(other => other !== entry
      && conceptKey(other.observation) === key
      && other.iso < entry.iso
      && other.value !== entry.value)
    const note = noteOf(entry.observation, entry.value)
    tiles.push({
      label: labelOf(entry.observation),
      value: entry.value,
      from: refOf(entry.observation),
      when: formatDate(entry.iso),
      iso: entry.iso,
      tone: toneOf(entry.observation),
      ...(previous ? { trend: `was ${previous.value} on ${formatDayMonth(previous.iso)}` } : {}),
      ...(note ? { note } : {}),
    })
  }
  return tiles.slice(0, MAX_RESULT_TILES)
}

/*
 * ── The chart body ───────────────────────────────────────────────────────────
 *
 * Five sections over six resource types, in the two columns a chart uses: what
 * happened and what was ordered on the wide side, the plan and the handover on
 * the narrow one.
 *
 * ⚠️ **A section with no entries is not rendered, and that is the rule that
 * keeps this honest.** Nine of the fourteen patients have no orders and eleven
 * have no documents; a chart with five headings and three empty states is a
 * chart pretending to be fuller than the record is. `sectionsOf` drops them.
 */

/**
 * A status word's tone.
 *
 * ⚠️ Deliberately narrow: only the states that mean "still open" get a colour,
 * and everything settled is neutral. A timeline where every line is tinted has
 * the same information as one where none is.
 */
const OPEN_STATUSES = new Set(['in-progress', 'active', 'requested', 'booked', 'pending', 'on-hold', 'ready'])

function statusTone(status: string | undefined): ChartTone {
  if (!status) return 'info'
  if (status === 'entered-in-error' || status === 'revoked' || status === 'cancelled') return 'critical'
  return OPEN_STATUSES.has(status) ? 'warning' : 'info'
}

/** The first `display` on a list of references — a performer, a participant. */
function actorsOf(list: unknown, key: 'actor' | null = null): string[] {
  if (!Array.isArray(list)) return []
  return list
    .map((entry) => {
      const ref = (key ? (entry as Record<string, unknown>)[key] : entry) as { display?: string; reference?: string } | undefined
      return typeof ref?.display === 'string' ? ref.display : undefined
    })
    .filter((display): display is string => Boolean(display))
}

/** The first note's text on any resource that has a `note` array. */
function firstNote(resource: MockResource): string | undefined {
  const notes = resource.note as Array<{ text?: string }> | undefined
  return notes?.find(n => typeof n?.text === 'string' && n.text)?.text || undefined
}

/** Newest first, then rendered. Every section is in the same order for the same reason. */
function newestFirst(entries: ChartEntry[]): ChartEntry[] {
  return [...entries].sort((a, b) => b.iso.localeCompare(a.iso))
}

/**
 * Encounters and the contacts made between them, as one timeline.
 *
 * ⚠️ **Communications belong here, not in a section of their own.** A caring
 * contact and a post-discharge phone call ARE the follow-up, and the whole point
 * of the pathway's later stages is that they happened — splitting them into
 * "Encounters" and "Messages" buries the part the demo is about under the part
 * every EHR already shows.
 */
function timelineOf(patientId: string): ChartEntry[] {
  const encounters = heldFor(patientId, 'Encounter').map((encounter) => {
    const period = encounter.period as { start?: string; end?: string } | undefined
    const klass = encounter.class as Coding | undefined
    const start = period?.start ?? ''
    const type = klass?.display ? `${klass.display[0]!.toUpperCase()}${klass.display.slice(1)}` : 'Encounter'
    return {
      title: `${type} encounter`,
      ...(period?.end ? { detail: `Ended ${formatDate(period.end)}` } : { detail: 'Still open' }),
      when: formatDate(start),
      iso: start,
      status: stringAt(encounter, 'status'),
      tone: statusTone(stringAt(encounter, 'status')),
      from: refOf(encounter),
    }
  })

  const communications = heldFor(patientId, 'Communication').map((communication) => {
    const categories = communication.category as CodeableConcept[] | undefined
    const sent = stringAt(communication, 'sent') ?? ''
    const medium = codingDisplayOf((communication.medium as CodeableConcept[] | undefined)?.[0])
    const note = firstNote(communication)
    return {
      // The FIRST category is the specific one ("Caring contact"); the second is
      // the concept domain every SPiER resource carries and would read the same
      // on every line.
      title: displayOf(categories?.[0]) ?? 'Contact',
      ...(medium || note ? { detail: [medium, note].filter(Boolean).join(' · ') } : {}),
      when: formatDate(sent),
      iso: sent,
      status: stringAt(communication, 'status'),
      tone: statusTone(stringAt(communication, 'status')),
      from: refOf(communication),
    }
  })

  const procedures = heldFor(patientId, 'Procedure').map((procedure) => {
    const performed = stringAt(procedure, 'performedDateTime') ?? ''
    const note = firstNote(procedure)
    return {
      title: displayOf(procedure.code) ?? 'Procedure',
      ...(note ? { detail: note } : {}),
      when: formatDate(performed),
      iso: performed,
      status: stringAt(procedure, 'status'),
      tone: statusTone(stringAt(procedure, 'status')),
      from: refOf(procedure),
    }
  })

  return newestFirst([...encounters, ...communications, ...procedures])
}

/** ServiceRequests and Tasks — the things somebody asked for. */
function ordersOf(patientId: string): ChartEntry[] {
  const requests = heldFor(patientId, 'ServiceRequest').map((request) => {
    const authored = stringAt(request, 'authoredOn') ?? ''
    const performer = actorsOf(request.performer)[0]
    const note = firstNote(request)
    return {
      title: displayOf(request.code) ?? 'Order',
      ...(performer || note ? { detail: [performer, note].filter(Boolean).join(' · ') } : {}),
      when: formatDate(authored),
      iso: authored,
      status: stringAt(request, 'status'),
      tone: statusTone(stringAt(request, 'status')),
      from: refOf(request),
    }
  })

  const tasks = heldFor(patientId, 'Task').map((task) => {
    const authored = stringAt(task, 'authoredOn') ?? ''
    return {
      title: displayOf(task.code) ?? 'Task',
      ...(stringAt(task, 'description') ? { detail: stringAt(task, 'description')! } : {}),
      when: formatDate(authored),
      iso: authored,
      status: stringAt(task, 'status'),
      tone: statusTone(stringAt(task, 'status')),
      from: refOf(task),
    }
  })

  return newestFirst([...requests, ...tasks])
}

/** CarePlans, with their step count where they have steps. */
function plansOf(patientId: string): ChartEntry[] {
  return newestFirst(heldFor(patientId, 'CarePlan').map((plan) => {
    const created = stringAt(plan, 'created') ?? ''
    const steps = Array.isArray(plan.activity) ? plan.activity.length : 0
    const categories = plan.category as CodeableConcept[] | undefined
    return {
      title: stringAt(plan, 'title') ?? displayOf(categories?.[0]) ?? 'Care plan',
      ...(steps > 0 ? { detail: `${steps} step${steps === 1 ? '' : 's'}` } : {}),
      when: formatDate(created),
      iso: created,
      status: stringAt(plan, 'status'),
      tone: statusTone(stringAt(plan, 'status')),
      from: refOf(plan),
    }
  }))
}

/** Appointments — booked, kept or missed. */
function appointmentsOf(patientId: string): ChartEntry[] {
  return newestFirst(heldFor(patientId, 'Appointment').map((appointment) => {
    const start = stringAt(appointment, 'start') ?? ''
    // The patient is a participant too; the OTHER participants are who this is
    // with, which is the part a chart line needs.
    const withWhom = actorsOf(appointment.participant, 'actor')[0]
    return {
      title: stringAt(appointment, 'description') ?? 'Appointment',
      ...(withWhom ? { detail: withWhom } : {}),
      when: formatDate(start),
      iso: start,
      status: stringAt(appointment, 'status'),
      tone: statusTone(stringAt(appointment, 'status')),
      from: refOf(appointment),
    }
  }))
}

/** DocumentReferences and Consents — what was handed over, and what was agreed. */
function documentsOf(patientId: string): ChartEntry[] {
  const documents = heldFor(patientId, 'DocumentReference').map((document) => {
    const date = stringAt(document, 'date') ?? ''
    return {
      title: displayOf(document.type) ?? 'Document',
      ...(stringAt(document, 'description') ? { detail: stringAt(document, 'description')! } : {}),
      when: formatDate(date),
      iso: date,
      status: stringAt(document, 'status'),
      tone: statusTone(stringAt(document, 'status')),
      from: refOf(document),
    }
  })

  const consents = heldFor(patientId, 'Consent').map((consent) => {
    const date = stringAt(consent, 'dateTime') ?? ''
    const categories = consent.category as CodeableConcept[] | undefined
    return {
      title: displayOf(categories?.[0]) ?? 'Consent',
      detail: 'Consent on file',
      when: formatDate(date),
      iso: date,
      status: stringAt(consent, 'status'),
      tone: statusTone(stringAt(consent, 'status')),
      from: refOf(consent),
    }
  })

  return newestFirst([...documents, ...consents])
}

/** Drop the empty ones. See the note above `OPEN_STATUSES`. */
function sectionsOf(candidates: ChartSection[]): ChartSection[] {
  return candidates.filter(section => section.entries.length > 0)
}

/** Everything the chart draws about one patient, from this server's own resources. */
export function chartRecordFor(patientId: string): ChartRecord {
  const flags = flagChips(patientId)
  return {
    chips: [...flags, ...episodeChips(patientId, flags.length > 0), ...taskChip(patientId)],
    results: resultsFor(patientId),
    main: sectionsOf([
      { id: 'timeline', title: 'Encounters and contacts', entries: timelineOf(patientId) },
      { id: 'orders', title: 'Orders and tasks', entries: ordersOf(patientId) },
    ]),
    side: sectionsOf([
      { id: 'plans', title: 'Care plans', entries: plansOf(patientId) },
      { id: 'appointments', title: 'Appointments', entries: appointmentsOf(patientId) },
      { id: 'documents', title: 'Documents and consent', entries: documentsOf(patientId) },
    ]),
  }
}
