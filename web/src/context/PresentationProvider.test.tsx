/**
 * @vitest-environment jsdom
 *
 * The chrome-mode seam (panel plan §3).
 *
 * Small surface, but two properties are load-bearing and neither is obvious from
 * reading the component:
 *
 *  1. The embed flag is read from the REAL query string, not the hash route.
 *     Under `HashRouter` that is what makes it survive in-app navigation — the
 *     host frames the app once and it stays a panel. A version that read the
 *     hash would work on first paint and silently revert on the first click.
 *  2. `Shell` must pick chrome WITHOUT forking the route table, so that every
 *     route is reachable in both chromes by construction.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { PresentationProvider } from './PresentationProvider'
import { usePresentation } from './PresentationContext'

// Stubbed so this stays a test of the selection, not of two whole shells (which
// would drag in the patient, SMART and tool-config providers).
vi.mock('../components/EhrShell', () => ({ EhrShell: () => <div data-testid="ehr" /> }))
vi.mock('../components/PanelShell', () => ({ PanelShell: () => <div data-testid="panel" /> }))

const { Shell } = await import('../components/Shell')

const setSearch = (search: string) => {
  window.history.replaceState({}, '', `/${search}#/patient/chart`)
}

// RTL's automatic cleanup only registers when vitest runs with `globals: true`,
// and this repo deliberately does not (see vitest.config.ts). Without this,
// renders accumulate across tests and `getByTestId` fails with "found multiple
// elements" — which looks like a component bug and is not one.
afterEach(cleanup)

describe('PresentationProvider — reading the embed flag', () => {
  beforeEach(() => setSearch(''))
  afterEach(() => setSearch(''))

  it('defaults to the standalone EHR chrome', () => {
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('ehr')).toBeDefined()
  })

  it('reads ?embed=1 from the real query string, not the hash', () => {
    setSearch('?embed=1')
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('panel')).toBeDefined()
  })

  it('ignores an embed value that is not exactly 1', () => {
    setSearch('?embed=true')
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('ehr')).toBeDefined()
  })

  it('is NOT fooled by `embed=1` appearing in the hash route', () => {
    // The trap this guards: `?embed=1` after the `#` is part of the route, not
    // the query. Reading `location.href` instead of `location.search` would
    // match here and put a normal deep link into panel chrome.
    window.history.replaceState({}, '', '/#/patient/chart?embed=1')
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('ehr')).toBeDefined()
  })
})

describe('PresentationProvider — the phase-2 seam', () => {
  it('setChromeMode switches chrome, so /redirect can set it from a SMART intent', () => {
    function Switcher() {
      const { chromeMode, setChromeMode } = usePresentation()
      return (
        <button onClick={() => setChromeMode('panel')}>
          {chromeMode}
        </button>
      )
    }
    render(
      <PresentationProvider>
        <Switcher />
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('ehr')).toBeDefined()
    act(() => screen.getByRole('button').click())
    expect(screen.getByTestId('panel')).toBeDefined()
  })

  it('honors an explicit initialMode over the query string', () => {
    setSearch('?embed=1')
    render(
      <PresentationProvider initialMode="ehr">
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('ehr')).toBeDefined()
  })
})

describe('usePresentation', () => {
  it('throws outside a provider rather than silently defaulting', () => {
    function Bare() {
      usePresentation()
      return null
    }
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Bare />)).toThrow(/must be used within a PresentationProvider/)
    err.mockRestore()
  })
})
