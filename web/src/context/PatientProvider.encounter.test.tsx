/**
 * @vitest-environment jsdom
 *
 * Integration test for the #263 phase-4 runtime: submitting a positive screen
 * must produce a correlated record, not just the artifacts.
 *
 * Deliberately at provider level against the REAL localDataSource rather than as
 * unit tests over the helpers. The helpers are already unit-tested
 * (lib/encounters.test.ts); what this covers is the wiring — that the funnel
 * stamps what it saves, that the Encounter is created once for a contact rather
 * than per artifact, and that the episode opens with a trigger that resolves to a
 * resource actually in the slice. Every one of those is a property of how the
 * pieces are connected, and none of them would fail if a helper were correct but
 * never called.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useEffect } from 'react'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PatientProvider } from './PatientProvider'
import { SmartContext } from './SmartContext'
import { usePatient } from './PatientContext'
import { localDataSource } from '../lib/dataSource/localDataSource'
import { ENCOUNTER_PROFILE } from '../lib/encounters'
import { TRIGGER_EXT } from '../lib/riskEpisode'
import type { QuestionnaireResponseResource } from '../types/fhir'

const SMART_STUB = {
  client: null,
  patient: null,
  error: null,
  setSmartData: () => {},
  setError: () => {},
}

/**
 * A positive ASQ, in the exact shape the real Questionnaire produces — SNOMED
 * yes/no codings under the two sections, and the canonical the mapper dispatches
 * on. Copied from the patient-011 fixture rather than hand-guessed, so this test
 * exercises the same path a real submission does.
 */
const YES = { system: 'http://snomed.info/sct', code: '373066001', display: 'Yes' }
const NO = { system: 'http://snomed.info/sct', code: '373067005', display: 'No' }

function positiveAsq(): QuestionnaireResponseResource {
  const ans = (coding: typeof YES) => [{ valueCoding: coding }]
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: 'http://spier.org/Questionnaire/ASQ-Screening-Tool',
    item: [
      {
        linkId: 'screening-questions',
        item: [
          { linkId: 'q1', answer: ans(YES) },
          { linkId: 'q2', answer: ans(NO) },
          { linkId: 'q3', answer: ans(NO) },
          { linkId: 'q4', answer: ans(NO) },
        ],
      },
      { linkId: 'acuity-section', item: [{ linkId: 'q5', answer: ans(NO) }] },
    ],
  } as QuestionnaireResponseResource
}

type Submit = (qr: QuestionnaireResponseResource) => void

/**
 * Hands the provider's `addResponse` back to the test. Published from an effect
 * rather than assigned during render — writing to module scope in a component
 * body is what `react-hooks` rejects, and it would also be unsafe under
 * concurrent rendering.
 */
function Harness({ onReady }: { onReady: (submit: Submit) => void }) {
  const { addResponse } = usePatient()
  useEffect(() => {
    onReady(qr => addResponse('ASQ Screening', qr))
  }, [addResponse, onReady])
  return null
}

function mount(): Promise<Submit> {
  return new Promise<Submit>(resolve => {
    render(
      <MemoryRouter initialEntries={['/patient/chart']}>
        <SmartContext.Provider value={SMART_STUB}>
          <PatientProvider>
            <Harness onReady={resolve} />
          </PatientProvider>
        </SmartContext.Provider>
      </MemoryRouter>,
    )
  })
}

/** The blank-patient slice — sliceKey is null with no active patient. */
const slice = () => localDataSource.getSliceSync!(null)

// The resource types here are deliberately loose (`FhirResource` has an index
// signature), so reads go through narrow local shapes — the same convention as
// isEpisodeOpen in lib/riskEpisode.ts.
type WithEncounter = { id?: string; encounter?: { reference?: string } }
type EncounterShape = {
  id?: string
  episodeOfCare?: { reference?: string }[]
  meta?: { profile?: string[] }
}
type EpisodeShape = {
  id?: string
  extension?: { url: string; valueReference?: { reference?: string } }[]
}

describe('positive screen → correlated record', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('creates an Encounter, stamps the artifacts, and opens an episode naming its trigger', async () => {
    const submit = await mount()
    submit(positiveAsq())

    await waitFor(() => expect(slice().encounters?.length).toBe(1))
    const s = slice()

    // One Encounter for the contact.
    const encounter = s.encounters![0] as EncounterShape
    const encounterRef = `Encounter/${encounter.id}`

    // The QR carries it — QuestionnaireResponse.encounter is native R4, and the
    // QR is usually the artifact that triggers the episode.
    const qr = s.responses[0].resource as WithEncounter
    expect(qr.encounter).toEqual({ reference: encounterRef })

    // So do the derived Observations.
    expect(s.observations.length).toBeGreaterThan(0)
    for (const o of s.observations) {
      expect((o as WithEncounter).encounter).toEqual({ reference: encounterRef })
    }

    // The episode opened, and only claims a positive screen because it can name
    // the artifact that evidenced it.
    await waitFor(() => expect(s2().episodes?.length).toBe(1))
    const episode = slice().episodes![0] as EpisodeShape
    const trigger = episode.extension?.find(e => e.url === TRIGGER_EXT)
    expect(trigger?.valueReference?.reference).toBeTruthy()

    // The trigger must resolve to something actually in the slice — the same
    // property check-scenario-resources.mjs enforces for the fixtures.
    const ids = new Set([
      ...slice().observations.map(o => `Observation/${(o as WithEncounter).id}`),
      ...slice().responses.map(r => `QuestionnaireResponse/${r.resource.id}`),
    ])
    expect(ids.has(String(trigger?.valueReference?.reference))).toBe(true)

    // And the Encounter now names the episode, gaining the profile claim with it.
    const linked = slice().encounters![0] as EncounterShape
    expect(linked.episodeOfCare).toEqual([{ reference: `EpisodeOfCare/${episode.id}` }])
    expect(linked.meta?.profile).toContain(ENCOUNTER_PROFILE)
  })

  it('files a second submission in the SAME contact and does not open a second episode', async () => {
    const submit = await mount()
    submit(positiveAsq())
    await waitFor(() => expect(slice().episodes?.length).toBe(1))
    const firstEncounterId = (slice().encounters![0] as EncounterShape).id
    const firstEpisodeId = (slice().episodes![0] as EpisodeShape).id

    submit(positiveAsq())
    await waitFor(() => expect(slice().responses.length).toBe(2))

    // One contact, one episode — a second positive screen belongs to the episode
    // already running.
    expect(slice().encounters!.length).toBe(1)
    expect((slice().encounters![0] as EncounterShape).id).toBe(firstEncounterId)
    expect(slice().episodes!.length).toBe(1)
    expect((slice().episodes![0] as EpisodeShape).id).toBe(firstEpisodeId)
  })
})

/** Re-read helper used inside waitFor, kept separate for readability. */
function s2() {
  return localDataSource.getSliceSync!(null)
}
