/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PageHeader } from './PageHeader'

afterEach(cleanup)

describe('PageHeader — the trail', () => {
  it('draws no trail at all on a root page, not an empty one', () => {
    // ⚠️ A root used to name the project (`SPiER`) directly under its logo.
    // An empty <p> would keep the eyebrow's margin and move the title anyway.
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Caseload" />
      </MemoryRouter>,
    )
    expect(container.querySelector('.page-header__eyebrow')).toBeNull()
    expect(container.querySelector('.page-header__title')?.textContent).toBe('Caseload')
  })

  it('draws the trail it is given', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader eyebrow={['Adoption Guide', 'Learn']} title="Tools" />
      </MemoryRouter>,
    )
    expect(container.querySelector('.page-header__eyebrow')?.textContent).toContain('Adoption Guide')
  })
})
