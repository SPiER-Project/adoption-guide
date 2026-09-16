/**
 * @vitest-environment jsdom
 *
 * Three elements behind one component: the shape a page reaches for decides
 * only the look, and the destination decides what is rendered. What matters
 * is that a router link, an external anchor and a native button all come out
 * with the same class recipe — that is the point of owning the surface.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Button } from './Button'

afterEach(cleanup)

describe('Button', () => {
  it('renders a router link for `to`, with the primary recipe and an arrow', () => {
    render(
      <MemoryRouter>
        <Button to="/patient/record" arrow>Open the chart</Button>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Open the chart' })
    expect(link.getAttribute('href')).toBe('/patient/record')
    expect(link.className).toBe('button button--primary')
    expect(link.querySelector('.button__arrow')).not.toBeNull()
  })

  it('renders an anchor for `href`, carrying target and rel through', () => {
    render(
      <Button href="https://example.org" target="_blank" rel="noopener noreferrer" variant="secondary">
        Elsewhere
      </Button>,
    )
    const a = screen.getByRole('link', { name: 'Elsewhere' })
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
    expect(a.className).toBe('button button--secondary')
  })

  it('renders a native button otherwise, defaulting type to "button" so it cannot submit a form by accident', () => {
    let clicks = 0
    render(<Button onClick={() => { clicks += 1 }} size="sm" accent>Record</Button>)
    const button = screen.getByRole('button', { name: 'Record' })
    expect(button.getAttribute('type')).toBe('button')
    expect(button.className).toBe('button button--primary button--sm button--accent')
    fireEvent.click(button)
    expect(clicks).toBe(1)
  })

  it('passes `type="submit"` and `disabled` through to the native button', () => {
    render(<Button type="submit" disabled>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.getAttribute('type')).toBe('submit')
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })
})
