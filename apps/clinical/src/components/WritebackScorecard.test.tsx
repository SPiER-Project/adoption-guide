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
import type { WritebackReport, WriteStepResult } from '@spier/core/lib/writeback/types'

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
      /Could not read this server/i,
    )
  })

  it('omits the probe warning when capabilities were read', () => {
    expect(textOf(report([qrWritten]))).not.toMatch(/Could not read this server/i)
  })

  it('surfaces a failed tier with its error, not just a count', () => {
    const failed: WriteStepResult = {
      tier: 2,
      resourceType: 'Observation',
      role: 'discrete',
      outcome: 'failed',
      error: 'Failed to create Observation — HTTP 422: rejected',
      reason: '1/3 Observations written',
    }
    const text = textOf(report([qrWritten, failed]))
    expect(text).toMatch(/HTTP 422/)
    expect(text).toMatch(/1 of 2 attempted tiers written back, 1 failed/i)
  })

  it('explains an unsupported tier as the server not accepting it', () => {
    const unsupported: WriteStepResult = {
      tier: 2,
      resourceType: 'Observation',
      role: 'discrete',
      outcome: 'skipped',
      reason: 'Server does not support create for this type',
    }
    expect(textOf(report([qrWritten, unsupported]))).toMatch(/Server does not support create/i)
  })

  it('explains a missing Tier 2 as an instrument property, not a server failure', () => {
    expect(textOf(report([qrWritten]))).toMatch(/produced no Observations/i)
  })

  it('names the browser-direct constraint, since it is a governance claim', () => {
    expect(textOf(report([qrWritten]))).toMatch(/never receives this data/i)
  })
})
