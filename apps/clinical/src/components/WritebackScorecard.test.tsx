/**
 * @vitest-environment jsdom
 *
 * WritebackScorecard (#350).
 *
 * The scorecard's whole purpose is explaining what did NOT happen — an
 * incomplete writeback is displayed deliberately, as a site-readiness
 * diagnostic. So these tests are weighted toward absences and failures rather
 * than the happy path, and they pin the two cases that cannot be read off
 * `WritebackResult.steps` at all:
 *
 *  1. Tier 3 is omitted from the plan entirely when disabled, so "off by design"
 *     must come from the resolved config.
 *  2. An empty `capabilities` map means either "the server advertises nothing" or
 *     "the probe failed", and presenting the latter as the former would be a
 *     false claim about the site's readiness.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WritebackScorecard } from './WritebackScorecard'
import { executeWritePlan } from '@spier/core/lib/writeback/execute'
import { buildWritePlan, resolveConfig } from '@spier/core/lib/writeback/ladder'
import type {
  WritebackArtifacts,
  WritebackConfig,
  WritebackReport,
  WritebackTarget,
  WriteStepResult,
} from '@spier/core/lib/writeback/types'
import type { FhirResource, ObservationResource, QuestionnaireResponseResource } from '@spier/core/types/fhir'

function report(
  steps: WriteStepResult[],
  overrides: Partial<WritebackReport> = {},
): WritebackReport {
  return {
    at: '2026-08-18T10:00:00.000Z',
    config: {
      enableQuestionnaireResponse: true,
      enableObservation: true,
      enableConditionProposal: false,
      alwaysWriteDocument: false,
    },
    capabilities: { QuestionnaireResponse: { create: true } },
    capabilitiesKnown: true,
    result: { steps },
    ...overrides,
  }
}

/**
 * The scorecard's rendered text, whitespace-normalized.
 *
 * Asserting on this rather than with `getByText` is deliberate: the prose is
 * split across JSX expressions ({count} of {total}...), and getByText matches an
 * element's own text nodes, so it both misses interpolated sentences and reports
 * "multiple elements" when an ancestor also matches.
 */
function textOf(report: WritebackReport | null): string {
  const { container } = render(<WritebackScorecard report={report} />)
  return (container.textContent ?? '').replace(/\s+/g, ' ')
}

/**
 * A FHIR resource type as a word, singular OR plural. ⚠️ `Observation\b` alone
 * does not match "Observations" — that is how "2 Observations written" passed.
 */
const WIRE_WORDS =
  /\b(?:QuestionnaireResponse|DocumentReference|Observation|Condition|CapabilityStatement|OperationOutcome)s?\b/

const ALL_CAPS = {
  QuestionnaireResponse: { create: true },
  Observation: { create: true },
  Condition: { create: true },
  DocumentReference: { create: true },
}

const ladderQr: QuestionnaireResponseResource = {
  resourceType: 'QuestionnaireResponse',
  id: 'client-qr',
  status: 'completed',
}
const ladderObservations = ['o1', 'o2', 'o3'].map(
  id => ({ resourceType: 'Observation', id, status: 'final' }) as ObservationResource,
)
const ladderArtifacts: WritebackArtifacts = {
  qr: ladderQr,
  observations: ladderObservations,
  documentReference: { resourceType: 'DocumentReference' },
  condition: { resourceType: 'Condition' },
}

/** A fake EHR that refuses what `refuse` says, in the SMART data source's words. */
function fakeEhr(refuse: (r: FhirResource, nth: number) => boolean): WritebackTarget {
  let nth = 0
  return {
    async createResource(resource: FhirResource) {
      nth += 1
      if (refuse(resource, nth)) {
        throw new Error(`Failed to create ${resource.resourceType} — HTTP 422: ${resource.resourceType}.status is invalid`)
      }
      return { id: `srv-${nth}` }
    },
  }
}

async function ladderReport(
  caps: Record<string, { create: boolean }>,
  config: WritebackConfig,
  refuse: (r: FhirResource, nth: number) => boolean = () => false,
  capabilitiesKnown = true,
): Promise<WritebackReport> {
  const plan = buildWritePlan(caps, config, ladderArtifacts)
  const result = await executeWritePlan(plan, fakeEhr(refuse), ladderArtifacts, config)
  return { at: '2026-08-18T10:00:00.000Z', config: resolveConfig(config), capabilities: caps, capabilitiesKnown, result }
}

const LADDER_RUNS: Array<[string, () => Promise<WritebackReport>]> = [
  ['everything saved, several scores', () => ladderReport(ALL_CAPS, { enableConditionProposal: true })],
  [
    'some scores refused',
    () => ladderReport(ALL_CAPS, {}, (r, nth) => r.resourceType === 'Observation' && nth !== 2),
  ],
  ['every write refused', () => ladderReport(ALL_CAPS, {}, () => true)],
  [
    'scores not accepted by this EHR',
    () => ladderReport({ ...ALL_CAPS, Observation: { create: false } }, {}),
  ],
  ['scores turned off', () => ladderReport(ALL_CAPS, { enableObservation: false })],
  ['capabilities unreadable', () => ladderReport(ALL_CAPS, {}, () => false, false)],
]

const qrWritten: WriteStepResult = {
  tier: 1,
  resourceType: 'QuestionnaireResponse',
  role: 'discrete',
  outcome: 'written',
  id: 'srv-1',
}

describe('WritebackScorecard', () => {
  it('renders nothing without a report (the local, non-SMART source)', () => {
    // jest-dom matchers are not registered in this repo (no vitest setupFiles),
    // so this asserts on the DOM directly rather than via toBeEmptyDOMElement.
    const { container } = render(<WritebackScorecard report={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('states Tier 3 is off by design when the config disabled it', () => {
    const text = textOf(report([qrWritten]))
    expect(text).toMatch(/Off by design/i)
    expect(text).toMatch(/explicit clinician confirmation/i)
  })

  it('distinguishes "enabled but not warranted" from "off by design" on Tier 3', () => {
    const enabled = report([qrWritten], {
      config: {
        enableQuestionnaireResponse: true,
        enableObservation: true,
        enableConditionProposal: true,
        alwaysWriteDocument: false,
      },
    })
    const text = textOf(enabled)
    expect(text).toMatch(/no proposal was warranted/i)
    expect(text).not.toMatch(/Off by design/i)
  })

  it('says the probe failed rather than implying the server refused', () => {
    expect(textOf(report([qrWritten], { capabilitiesKnown: false }))).toMatch(
      /Could not ask this EHR what it accepts/i,
    )
  })

  it('omits the probe warning when capabilities were read', () => {
    expect(textOf(report([qrWritten]))).not.toMatch(/Could not ask this EHR/i)
  })

  it('surfaces a partial failure as a count, and keeps the raw error off the page', () => {
    const failed: WriteStepResult = {
      tier: 2,
      resourceType: 'Observation',
      role: 'discrete',
      outcome: 'failed',
      count: { written: 1, of: 3 },
      error: 'Failed to create Observation — HTTP 422: rejected',
      reason: '1/3 Observations written',
    }
    const text = textOf(report([qrWritten, failed]))
    expect(text).toMatch(/1 of 3 saved — the EHR did not accept the rest/)
    expect(text).toMatch(/1 of 2 parts saved, 1 failed/i)
    // The raw detail lives in the report, shown only under inspection.
    expect(text).not.toMatch(/HTTP 422|rejected|1\/3/)
  })

  it('explains an unsupported tier as the EHR not accepting it', () => {
    const unsupported: WriteStepResult = {
      tier: 2,
      resourceType: 'Observation',
      role: 'discrete',
      outcome: 'skipped',
      skip: 'unsupported',
      reason: 'Server does not support create for this type',
    }
    const text = textOf(report([qrWritten, unsupported]))
    expect(text).toMatch(/This EHR does not accept it yet/i)
    expect(text).not.toMatch(/Server does not support create/i)
  })

  it('explains a missing Tier 2 as an instrument property, not a server failure', () => {
    expect(textOf(report([qrWritten]))).toMatch(/no score of its own to save/i)
  })

  it('names no tier and no resource type without inspection', () => {
    // ⚠️ The clinical surface never inspects (`context/InspectContext.ts`), so
    // this is what a clinician reads after submitting a form. The row used to
    // carry `Tier 1 · QuestionnaireResponse` under its label and "Created as
    // QuestionnaireResponse / srv-1" under that (clinical-app audit §1.9).
    const text = textOf(report([qrWritten]))
    expect(text).not.toMatch(/Tier \d/)
    expect(text).not.toMatch(WIRE_WORDS)
    expect(text).toMatch(/Saved to this patient/i)
  })

  /**
   * ⚠️ The case above renders ONE hand-typed step with no `reason` and no
   * `error`, so it could not see the strings core computes: "2 Observations
   * written", "1/3 Observations written", "Failed to create Observation —
   * HTTP 422: …", "Tier not enabled", "floor not needed". Those reached the
   * clinician for months because this test's regex was `Observation\b`, which
   * a plural walks straight past, and because `check:jargon` reads string
   * LITERALS in this app — these are built in core.
   *
   * So this one renders what core actually emits: every outcome the ladder can
   * produce, run through `executeWritePlan` against a fake EHR that refuses
   * what each scenario says it refuses, with the refusal worded the way the
   * SMART data source words it.
   */
  it.each(LADDER_RUNS)('names no wire vocabulary for what core emits: %s', async (_name, run) => {
    const text = textOf(await run())
    expect(text).not.toMatch(/\bTiers?\b/i)
    expect(text).not.toMatch(/\bfloor\b/i)
    expect(text).not.toMatch(/\bHTTP\b/)
    expect(text).not.toMatch(WIRE_WORDS)
  })

  it('names the browser-direct constraint, since it is a governance claim', () => {
    expect(textOf(report([qrWritten]))).toMatch(/never receive this patient.s data/i)
  })
})
