/**
 * @vitest-environment jsdom
 *
 * A collapsible section: the header is the control, and the property that
 * matters is the section's rather than the header's — the BODY is absent when
 * collapsed, not merely hidden behind a class.
 *
 * ⚠️ **Exercised through `PopulationSummary` since 2026-09-21.** It used to be
 * `PatientDocuments`, "the smallest of the three sections that use it"; those
 * three sections became one page with one list (clinical-app audit §4.4) and
 * none of them is collapsible, so the caseload's summary is the last real
 * caller and the one this rule has to hold for.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { PopulationSummary } from './PopulationSummary'

afterEach(cleanup)

function renderSummary() {
  return render(<PopulationSummary tiles={[]} census={[]} total={0} />)
}

describe('a collapsible section', () => {
  it('opens by default, with the body rendered', () => {
    const { container } = renderSummary()
    expect(container.querySelector('#pop-summary-body')).not.toBeNull()
    expect(screen.getByRole('button', { name: /Summary/ }).getAttribute('aria-expanded')).toBe(
      'true',
    )
  })

  it('toggles from the title, and the body is absent when closed', () => {
    const { container } = renderSummary()
    fireEvent.click(screen.getByRole('button', { name: /Summary/ }))
    expect(container.querySelector('#pop-summary-body')).toBeNull()
    expect(screen.getByRole('button', { name: /Summary/ }).getAttribute('aria-expanded')).toBe(
      'false',
    )
    fireEvent.click(screen.getByRole('button', { name: /Summary/ }))
    expect(container.querySelector('#pop-summary-body')).not.toBeNull()
  })
})
