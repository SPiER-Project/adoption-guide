/**
 * @vitest-environment jsdom
 *
 * *What's on file* — one list, replacing three (clinical-app audit §4.4).
 *
 * What is worth gating is not "does it render a row" but the four properties
 * that make it a different thing from the sections it replaced:
 *
 *  1. **No resource type on a row**, and no emoji standing in for one (§1.9).
 *  2. **The instrument, where there is one** — that is what "by which
 *     instrument" means, and it is resolved by `instrumentName` in core rather
 *     than by a second copy of that judgement here.
 *  3. **Grouped by episode where the references allow**, and honest where they
 *     do not: an artifact the reference walk cannot reach lands in its own
 *     group rather than being guessed into an episode.
 *  4. **Every artifact appears exactly once.** The three sections it replaced
 *     could show the same artifact three times, labelled three ways.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, renderHook } from '@testing-library/react'
import { POPULATION_SCENARIOS } from '@spier/demo-population'
import { useOnFileGroups } from '../lib/onFileGroups'
import { OnFileList } from './OnFileList'

afterEach(cleanup)

const scenario = POPULATION_SCENARIOS['patient-001']

/**
 * The types a row used to name. Spelled out here rather than imported: the
 * canonical list is `scripts/lib/fhir-vocabulary.mjs`, which `check:jargon`
 * reads over this whole tree — so this assertion is the narrow, fast version of
 * a rule the gate already holds, and the gate is what catches a type not listed
 * in either place.
 */
const RESOURCE_TYPE_WORDS = [
  'QuestionnaireResponse', 'DocumentReference', 'ServiceRequest', 'EpisodeOfCare',
  'CarePlan', 'Observation', 'Communication', 'Appointment', 'Procedure', 'Consent',
]

const input = {
  episodes: scenario.episodes ?? [],
  encounters: scenario.encounters ?? [],
  responses: scenario.responses,
  observations: scenario.observations,
  carePlans: scenario.carePlans,
  communications: scenario.communications ?? [],
  serviceRequests: scenario.serviceRequests ?? [],
  procedures: scenario.procedures ?? [],
  documentReferences: scenario.documentReferences ?? [],
  appointments: scenario.appointments ?? [],
  consents: scenario.consents ?? [],
  flags: scenario.flags ?? [],
  tasks: scenario.tasks ?? [],
}

function groupsFor(over: Partial<typeof input> = {}) {
  const { result } = renderHook(() => useOnFileGroups({ ...input, ...over }))
  return result.current
}

function renderList(over: Partial<typeof input> = {}) {
  const groups = groupsFor(over)
  return { groups, ...render(<OnFileList groups={groups} />) }
}

describe('what’s on file', () => {
  it('names no resource type on any row', () => {
    const { container } = renderList()
    const text = container.textContent ?? ''
    for (const type of RESOURCE_TYPE_WORDS) {
      expect(text, `"${type}" is on a row`).not.toContain(type)
    }
  })

  it('names the instrument behind a row that has one', () => {
    const { container } = renderList()
    const instruments = [...container.querySelectorAll('.on-file__instrument')].map(
      e => e.textContent,
    )
    expect(instruments).toContain('PHQ-9')
    expect(instruments).toContain('ASQ')
    // …and never beside a row whose own name IS the instrument.
    for (const row of container.querySelectorAll('.on-file__row')) {
      const name = row.querySelector('.on-file__name')?.textContent
      const instrument = row.querySelector('.on-file__instrument')?.textContent
      if (instrument) expect(instrument).not.toBe(name)
    }
  })

  it('groups by episode, and lists each artifact exactly once', () => {
    const { groups, container } = renderList()
    expect(groups.length).toBeGreaterThan(0)
    expect(groups[0].title).toBe('Suicide-safer care episode')
    expect(groups[0].state).toBe('Open')
    const rows = [...container.querySelectorAll('.on-file__row')]
    const keys = groups.flatMap(g => g.rows.map(r => r.key))
    expect(rows).toHaveLength(keys.length)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('says so when an artifact cannot be reached from an episode, without explaining FHIR', () => {
    // No episodes and no contacts: everything falls to the closing group. The
    // three reasons `groupByEpisode` distinguishes — "no route in FHIR R4",
    // "scheduled, not yet occurred", "not linked to a contact" — are the
    // implementer's argument and are not rendered here (§4.4).
    const { container } = renderList({ episodes: [], encounters: [] })
    expect(container.textContent).toContain('Not part of an episode')
    expect(container.textContent).not.toContain('FHIR R4')
    expect(container.textContent).not.toContain('.encounter')
  })

  it('renders an empty chart as one sentence, not as three empty sections', () => {
    const { container } = render(<OnFileList groups={[]} />)
    expect(container.textContent).toBe('Nothing has been recorded for this patient yet.')
  })
})
