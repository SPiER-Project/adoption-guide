/**
 * @vitest-environment jsdom
 *
 * InstrumentHeader — what it keeps, and what it merely hides.
 *
 * ⚠️ **The distinction is the whole test.** This component exists to reclaim
 * 262px of a 900px panel (see the measurement in `InstrumentHeader.tsx`), and
 * the cheap way to reclaim it would have been to stop rendering
 * `Questionnaire.description` at all. That is not what it does, and nothing
 * about the rendered page makes the difference obvious — a closed `<details>`
 * and a deleted paragraph look identical until someone clicks. So the presence
 * of the text inside the disclosure is asserted directly.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { InstrumentHeader } from './InstrumentHeader'

afterEach(cleanup)

const NAME = 'Columbia-Suicide Severity Rating Scale — Screener (Recent)'
const ABOUT = 'FHIR Questionnaire representation of the C-SSRS Screen Version (Recent).'

describe('InstrumentHeader', () => {
  it('names the instrument formally, alongside the page header’s short title', () => {
    render(<InstrumentHeader name={NAME} description={ABOUT} />)
    expect(screen.getByText(NAME)).toBeTruthy()
  })

  it('keeps the description — closed, not dropped', () => {
    const { container } = render(<InstrumentHeader name={NAME} description={ABOUT} />)
    const details = container.querySelector('details')
    expect(details).toBeTruthy()
    // Closed by default: on every instrument in this repo the description is
    // addressed to an integrator, not to the clinician holding the form.
    expect(details!.open).toBe(false)
    // ⚠️ And still in the document. Some instruments carry administration
    // guidance here, and silently truncating clinical instructions would be a
    // worse defect than the vertical waste this component was written to fix.
    expect(screen.getByText(ABOUT)).toBeTruthy()
  })

  it('renders nothing at all when the Questionnaire carries neither', () => {
    // Not an empty box with a stray disclosure arrow: `Questionnaire.title` and
    // `.description` are both optional in R4.
    const { container } = render(<InstrumentHeader />)
    expect(container.firstChild).toBeNull()
  })

  it('ignores values that are not really strings', () => {
    // These arrive off `FhirResource`'s `[k: string]: unknown` index signature,
    // so the component is the boundary where "it typechecked" stops meaning
    // "it is a string". A whitespace-only title would otherwise render an empty
    // line the layout still pays for.
    const { container } = render(<InstrumentHeader name={{ nope: true }} description={'   '} />)
    expect(container.firstChild).toBeNull()
  })
})
