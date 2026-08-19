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
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { PatientProvider } from './PatientProvider'
import { SmartContext } from './SmartContext'
import { usePatient } from './PatientContext'
import { LocalDataSource, resetLocalDemoData } from '../lib/dataSource/localDataSource'
import { ENCOUNTER_PROFILE } from '../lib/encounters'
import { TRIGGER_EXT } from '../lib/riskEpisode'
import type { FhirResource, QuestionnaireResponseResource } from '../types/fhir'

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
type Save = (resource: FhirResource) => void

/**
 * Both write entry points the provider exposes, plus navigation — the
 * patient-switch test needs the SAME provider instance to change `sliceKey`,
 * which is what the Encounter cache keys off.
 */
type ChartApi = { submit: Submit; save: Save; go: (route: string) => void }

/**
 * A per-test data source. `localDataSource` is a module SINGLETON that reads
 * localStorage in its constructor and then holds the store in memory, so
 * `localStorage.clear()` does not reset it and state leaks between tests. Before
 * this, the "second submission" test below was reading the *first* test's
 * episode and passing because `waitFor` caught `responses.length` in transit
 * through 2 on its way to 3 — green, and asserting almost nothing.
 *
 * `PatientProvider`'s `dataSource` prop exists for exactly this.
 */
let source: LocalDataSource

function freshSource(): void {
  // Auto-cleanup is not enabled in this project's vitest setup, so renders
  // accumulate: without this, every previous test's provider is still mounted,
  // still subscribed to its source, and still rendering into the document.
  cleanup()
  localStorage.clear()
  resetLocalDemoData()
  source = new LocalDataSource()
}

/**
 * Hands the provider's write API back to the test. Published from an effect
 * rather than assigned during render — writing to module scope in a component
 * body is what `react-hooks` rejects, and it would also be unsafe under
 * concurrent rendering.
 *
 * `latest` is re-pointed on every effect run rather than resolved once:
 * `addArtifact`'s identity changes with `sliceKey`, so a closure captured at
 * mount would keep writing to the patient the test has already navigated away
 * from — which is the very thing the patient-switch test is trying to detect.
 * The active id is rendered so tests can wait for a switch to take effect.
 */
function Harness({ onApi }: { onApi: (api: ChartApi) => void }) {
  const { addResponse, addArtifact, activePatientId } = usePatient()
  const navigate = useNavigate()
  useEffect(() => {
    onApi({
      submit: qr => addResponse('ASQ Screening', qr),
      save: addArtifact,
      go: route => navigate(route),
    })
  }, [addResponse, addArtifact, navigate, onApi])
  return <div data-testid="active-patient">{activePatientId ?? 'none'}</div>
}

async function mount(route = '/patient/chart'): Promise<ChartApi> {
  const latest: { current: ChartApi | null } = { current: null }
  // Stored from the test's own closure rather than by mutating a prop, which the
  // React compiler lint rejects outright.
  const onApi = (api: ChartApi) => {
    latest.current = api
  }
  render(
    <MemoryRouter initialEntries={[route]}>
      <SmartContext.Provider value={SMART_STUB}>
        <PatientProvider dataSource={source}>
          <Harness onApi={onApi} />
        </PatientProvider>
      </SmartContext.Provider>
    </MemoryRouter>,
  )
  await waitFor(() => expect(latest.current).not.toBeNull())
  // Delegates to the CURRENT api on every call — see the note on Harness.
  return {
    submit: qr => latest.current!.submit(qr),
    save: resource => latest.current!.save(resource),
    go: r => latest.current!.go(r),
  }
}

/** The blank-patient slice — sliceKey is null with no active patient. */
const slice = () => source.getSliceSync!(null)

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
  beforeEach(freshSource)

  it('creates an Encounter, stamps the artifacts, and opens an episode naming its trigger', async () => {
    const { submit } = await mount()
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
    const { submit } = await mount()
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
  return source.getSliceSync!(null)
}


/**
 * The rest of the correlation funnel — the branches the two tests above do not
 * reach. Each of these is a property of the *wiring* in exactly the sense the
 * module note describes: `lib/encounters.test.ts` proves `attachAppointment`
 * and `attachEpisode` transform a resource correctly, and would stay green if
 * the provider never called them.
 *
 * Written before the provider was decomposed (#126), so the refactor has
 * something that was green beforehand. All four were verified to FAIL against a
 * deliberately broken provider — see the note on each.
 */
describe('the rest of the correlation funnel', () => {
  beforeEach(freshSource)

  /** Minimal generic artifact; `Communication` is appended rather than upserted. */
  function note(id: string): FhirResource {
    return {
      resourceType: 'Communication',
      id,
      status: 'completed',
      subject: { reference: 'Patient/demo-patient' },
    } as unknown as FhirResource
  }

  it('links an Appointment in reverse, because R4 gives it no .encounter', async () => {
    // Fails if saveAgainstEncounter drops the attachAppointment branch: the
    // Appointment would be saved with no `.encounter` (correctly, it is in
    // ENCOUNTER_STAMP_SKIP) and nothing else would reference it — the chain
    // would simply be broken with no error anywhere.
    const { save } = await mount()
    save({
      resourceType: 'Appointment',
      id: 'appt-reverse',
      status: 'booked',
      participant: [{ actor: { reference: 'Patient/demo-patient' } }],
    } as unknown as FhirResource)

    await waitFor(() => expect(slice().appointments?.length).toBe(1))
    await waitFor(() =>
      expect(
        (slice().encounters![0] as EncounterShape & { appointment?: { reference?: string }[] })
          .appointment,
      ).toEqual([{ reference: 'Appointment/appt-reverse' }]),
    )

    // And the Appointment itself carries no `.encounter` — the element does not
    // exist in R4, so stamping one would be invented data.
    expect((slice().appointments![0] as WithEncounter).encounter).toBeUndefined()
  })

  it('attaches a manually recorded EpisodeOfCare and only then claims the profile', async () => {
    // The RiskEpisodeView path: an episode opened by hand rather than by a
    // positive screen. Fails if the attachEpisode branch is dropped — the
    // Encounter would keep no episode reference, and (the sharper half) would
    // never claim SPiEREncounter, whose episodeOfCare is 1..*.
    const { save } = await mount()

    // A first artifact opens the Encounter with no episode yet, which is the
    // state the profile claim must NOT be made in.
    save(note('note-before-episode'))
    await waitFor(() => expect(slice().encounters?.length).toBe(1))
    expect((slice().encounters![0] as EncounterShape).meta?.profile ?? []).not.toContain(
      ENCOUNTER_PROFILE,
    )

    save({
      resourceType: 'EpisodeOfCare',
      id: 'episode-manual',
      status: 'active',
      patient: { reference: 'Patient/demo-patient' },
    } as unknown as FhirResource)

    await waitFor(() =>
      expect((slice().encounters![0] as EncounterShape).episodeOfCare).toEqual([
        { reference: 'EpisodeOfCare/episode-manual' },
      ]),
    )
    // The reference and the claim arrive together — that is the whole point of
    // deferring it.
    expect((slice().encounters![0] as EncounterShape).meta?.profile).toContain(ENCOUNTER_PROFILE)
    // An EpisodeOfCare is what the Encounter points at, so it is not stamped back.
    expect((slice().episodes![0] as WithEncounter).encounter).toBeUndefined()
  })

  it('files two artifacts saved in the SAME tick against one Encounter', async () => {
    // This is the sole reason openEncounterRef exists. `slice` is React state,
    // so both calls read the same encounter-less slice; without the ref each
    // would mint its own Encounter. The existing "same contact" test awaits
    // between submissions and so is carried by the slice, not the ref.
    const { save } = await mount()
    save(note('note-a'))
    save(note('note-b'))

    await waitFor(() => expect(slice().communications?.length).toBe(2))
    expect(slice().encounters!.length).toBe(1)

    const ref = `Encounter/${(slice().encounters![0] as EncounterShape).id}`
    for (const c of slice().communications!) {
      expect((c as WithEncounter).encounter).toEqual({ reference: ref })
    }
  })

  it('does not file an artifact against the previous patient’s Encounter', async () => {
    // The clinically dangerous one, and the effect that guards it is three lines
    // long: openEncounterRef is cleared on sliceKey change. Drop that effect and
    // the cached Encounter is still open and still same-day, so findOpenEncounter
    // accepts it and patient-011's artifact is filed against the blank patient's
    // contact — with no error and nothing else to notice it.
    const { save, go } = await mount()
    save(note('note-blank'))
    await waitFor(() => expect(slice().encounters?.length).toBe(1))

    // Wait for the switch to actually take effect, rather than for anything in
    // patient-011's seeded scenario — the artifact write must happen under the
    // NEW sliceKey or the test proves nothing.
    go('/patient/chart/patient-011')
    await waitFor(() => expect(screen.getByTestId('active-patient').textContent).toBe('patient-011'))
    await act(async () => {})
    const before = patient011().communications?.length ?? 0

    save(note('note-after-switch'))

    await waitFor(() =>
      expect(
        patient011().communications!.some(c => (c as WithEncounter).id === 'note-after-switch'),
      ).toBe(true),
    )

    // Whichever Encounter it landed on, that Encounter must be patient-011's.
    const saved = patient011().communications!.find(
      c => (c as WithEncounter).id === 'note-after-switch',
    ) as WithEncounter
    const encounterId = String(saved.encounter?.reference).split('/')[1]
    const filedAgainst = patient011().encounters!.find(
      e => (e as EncounterShape).id === encounterId,
    ) as { subject?: { reference?: string } }
    expect(filedAgainst).toBeDefined()
    expect(filedAgainst.subject?.reference).toBe('Patient/patient-011')

    // And nothing new landed on the blank patient's contact, nor did the switch
    // disturb what patient-011 already had.
    expect(slice().communications!.length).toBe(1)
    expect(patient011().communications!.length).toBe(before + 1)
  })
})

/** patient-011's slice, for the patient-switch test. */
function patient011() {
  return source.getSliceSync!('patient-011')
}
