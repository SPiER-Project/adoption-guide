/**
 * @vitest-environment jsdom
 *
 * The record sections start collapsed in the embedded panel and open in the
 * full shell, and the header is the control either way. Exercised through
 * PatientDocuments — the smallest of the three sections that use it — because
 * the property that matters is the section's, not the header's: the BODY is
 * absent when collapsed, not merely hidden behind a class.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { PatientDocuments } from './PatientDocuments'

afterEach(cleanup)

function renderDocs(defaultCollapsed: boolean) {
  return render(
    <PatientDocuments
      responses={[]}
      carePlans={[]}
      observations={[]}
      defaultCollapsed={defaultCollapsed}
    />,
  )
}

describe('a collapsible chart section', () => {
  it('opens by default in the full shell, with the body rendered', () => {
    const { container } = renderDocs(false)
    expect(container.querySelector('#documents-body')).not.toBeNull()
    expect(screen.getByRole('button', { name: /Patient Documents/ }).getAttribute('aria-expanded')).toBe('true')
  })

  it('starts collapsed when asked, and the count still says what is inside', () => {
    const { container } = renderDocs(true)
    expect(container.querySelector('#documents-body')).toBeNull()
    expect(container.querySelector('.chart-section-count')?.textContent).toBe('0 total')
    expect(screen.getByRole('button', { name: /Patient Documents/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('toggles from the title', () => {
    const { container } = renderDocs(true)
    fireEvent.click(screen.getByRole('button', { name: /Patient Documents/ }))
    expect(container.querySelector('#documents-body')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Patient Documents/ }))
    expect(container.querySelector('#documents-body')).toBeNull()
  })
})
