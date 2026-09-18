/**
 * @vitest-environment jsdom
 *
 * Which chrome gets chosen — the only thing `Shell.tsx` does.
 *
 * ⚠️ **This file exists because a planted defect passed without it.**
 * `LaunchShell.test.tsx` renders `LaunchShell` directly, so deleting the
 * `IS_DEMO ? <AppShell /> : <LaunchShell />` branch entirely — shipping a
 * clinical chrome that is never reached — left every test green. A component
 * tested in isolation proves nothing about whether anything renders it.
 *
 * The three shells are stubbed so this asserts the CHOICE and nothing else; what
 * each one contains is its own file's job.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

afterEach(() => {
  cleanup()
  vi.resetModules()
})

async function shellFor(isDemo: boolean, chromeMode: 'ehr' | 'panel') {
  vi.resetModules()
  vi.doMock('../lib/surface', () => ({ SURFACE: isDemo ? 'demo' : 'clinical', IS_DEMO: isDemo }))
  vi.doMock('../context/PresentationContext', () => ({
    usePresentation: () => ({ chromeMode, hostDrawsPatientBanner: false }),
  }))
  vi.doMock('./AppShell', () => ({ AppShell: () => <div data-testid="app-shell" /> }))
  vi.doMock('./LaunchShell', () => ({ LaunchShell: () => <div data-testid="launch-shell" /> }))
  vi.doMock('./PanelShell', () => ({ PanelShell: () => <div data-testid="panel-shell" /> }))
  const { Shell } = await import('./Shell')
  return () => render(<MemoryRouter><Shell /></MemoryRouter>)
}

describe('Shell picks the chrome from BOTH axes', () => {
  it('clinical + standalone → LaunchShell', async () => {
    (await shellFor(false, 'ehr'))()
    expect(screen.getByTestId('launch-shell')).toBeTruthy()
    expect(screen.queryByTestId('app-shell')).toBeNull()
  })

  it('demo + standalone → AppShell', async () => {
    (await shellFor(true, 'ehr'))()
    expect(screen.getByTestId('app-shell')).toBeTruthy()
    expect(screen.queryByTestId('launch-shell')).toBeNull()
  })

  it('panel wins over the surface — demo', async () => {
    // A panel launch of the demo build is still someone else's chart; drawing
    // the guide's header and footer inside it would be wrong on either surface.
    (await shellFor(true, 'panel'))()
    expect(screen.getByTestId('panel-shell')).toBeTruthy()
    expect(screen.queryByTestId('app-shell')).toBeNull()
  })

  it('panel wins over the surface — clinical', async () => {
    (await shellFor(false, 'panel'))()
    expect(screen.getByTestId('panel-shell')).toBeTruthy()
    expect(screen.queryByTestId('launch-shell')).toBeNull()
  })
})
