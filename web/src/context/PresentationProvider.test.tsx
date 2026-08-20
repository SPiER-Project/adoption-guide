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
 *  3. It survives the SMART redirect, which DESTROYS the query string. This is
 *     the property step 5 needed and the one with no visible symptom in a test
 *     that only ever loads the launch URL: the panel comes back up after OAuth
 *     with `?code&state` where `?embed=1` used to be, and without persistence it
 *     renders full EHR chrome inside the host's iframe.
 *
 * ⚠️ Every case below clears `sessionStorage` first. Without that these tests
 * pass or fail on their ORDER — the persistence one writes `panel`, and any
 * later case with no `embed` parameter would read it back. Passing by accident of
 * ordering is worse than failing.
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

const CHROME_KEY = 'spier:chrome-mode'

// RTL's automatic cleanup only registers when vitest runs with `globals: true`,
// and this repo deliberately does not (see vitest.config.ts). Without this,
// renders accumulate across tests and `getByTestId` fails with "found multiple
// elements" — which looks like a component bug and is not one.
afterEach(cleanup)

describe('PresentationProvider — reading the embed flag', () => {
  beforeEach(() => {
    setSearch('')
    window.sessionStorage.clear()
  })
  afterEach(() => {
    setSearch('')
    window.sessionStorage.clear()
  })

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

describe('PresentationProvider — surviving the SMART redirect', () => {
  beforeEach(() => {
    setSearch('')
    window.sessionStorage.clear()
  })
  afterEach(() => {
    setSearch('')
    window.sessionStorage.clear()
  })

  it('stays in panel chrome when the query string is replaced by ?code&state', () => {
    // Leg 1: the host frames the launch URL.
    setSearch('?embed=1')
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('panel')).toBeDefined()
    cleanup()

    // Leg 2: the authorization server redirects back to the app's bare base
    // URL. `embed` is GONE — a redirect URI carries no fragment and the app
    // registers its base, so this is not a shortcut in the test.
    setSearch('?code=abc&state=xyz')
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('panel')).toBeDefined()
  })

  it('does not put an ordinary visit into panel chrome', () => {
    // Nothing recorded, no parameter: the default has to be the standalone demo.
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('ehr')).toBeDefined()
  })

  it('lets ?embed=0 leave panel chrome without a new tab', () => {
    window.sessionStorage.setItem(CHROME_KEY, 'panel')
    setSearch('?embed=0')
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('ehr')).toBeDefined()
    expect(window.sessionStorage.getItem(CHROME_KEY)).toBe('ehr')
  })

  it('ignores a stored value that is not a chrome mode', () => {
    window.sessionStorage.setItem(CHROME_KEY, 'panel-ish')
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('ehr')).toBeDefined()
  })

  it('survives storage being denied, which is the third-party-iframe case', () => {
    // Safari's default blocks storage in a cross-origin frame outright, and the
    // access THROWS rather than returning null. Degrading to EHR chrome is the
    // wrong-looking-but-rendering outcome; throwing would be a blank panel.
    const denied = vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })
    const deniedSet = vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })
    setSearch('?embed=1')
    render(
      <PresentationProvider>
        <Shell />
      </PresentationProvider>,
    )
    // The parameter is still on the URL, so THIS render is a panel; only the
    // memory across the redirect is lost.
    expect(screen.getByTestId('panel')).toBeDefined()
    denied.mockRestore()
    deniedSet.mockRestore()
  })
})

describe('PresentationProvider — the patient-banner axis', () => {
  beforeEach(() => window.sessionStorage.clear())
  afterEach(() => window.sessionStorage.clear())

  it('defaults to drawing our own banner, and is settable from the launch context', () => {
    function Probe() {
      const { hostDrawsPatientBanner, setHostDrawsPatientBanner } = usePresentation()
      return (
        <button onClick={() => setHostDrawsPatientBanner(true)}>
          {String(hostDrawsPatientBanner)}
        </button>
      )
    }
    render(
      <PresentationProvider>
        <Probe />
      </PresentationProvider>,
    )
    // The safe default: name the patient unless told something else is.
    expect(screen.getByRole('button').textContent).toBe('false')
    act(() => screen.getByRole('button').click())
    expect(screen.getByRole('button').textContent).toBe('true')
  })

  it('is independent of chrome mode', () => {
    // The two axes travel together in practice and are not the same claim; a
    // provider that derived one from the other would make `need_patient_banner`
    // impossible to honor for a host that embeds AND wants our banner.
    setSearch('?embed=1')
    function Probe() {
      const { chromeMode, hostDrawsPatientBanner } = usePresentation()
      return <span data-testid="axes">{`${chromeMode}:${hostDrawsPatientBanner}`}</span>
    }
    render(
      <PresentationProvider>
        <Probe />
      </PresentationProvider>,
    )
    expect(screen.getByTestId('axes').textContent).toBe('panel:false')
    setSearch('')
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
