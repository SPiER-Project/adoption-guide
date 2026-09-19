/**
 * @vitest-environment jsdom
 *
 * Which chrome gets chosen — the only thing `Shell.tsx` does.
 *
 * ⚠️ **This file exists because a planted defect passed without it.**
 * `LaunchShell.test.tsx` renders `LaunchShell` directly, so deleting the branch
 * that chose it — shipping a chrome nothing ever reached — left every test
 * green. A component tested in isolation proves nothing about whether anything
 * renders it.
 *
 * ⚠️ **It used to assert a choice across TWO axes and THREE shells.** The third
 * was `AppShell`, picked when the build surface was `demo`; the adoption guide
 * is `apps/guide` now and owns that component outright, so the surface axis is
 * gone from this file rather than merely unused. What is left is the one
 * question this app actually has: is someone else drawing the frame?
 *
 * The shells are stubbed so this asserts the CHOICE and nothing else; what each
 * one contains is its own file's job.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

afterEach(() => {
  cleanup()
  vi.resetModules()
})

async function shellFor(chromeMode: 'ehr' | 'panel') {
  vi.resetModules()
  vi.doMock('@spier/tool-views/context/PresentationContext', () => ({
    usePresentation: () => ({ chromeMode, hostDrawsPatientBanner: false }),
  }))
  vi.doMock('./LaunchShell', () => ({ LaunchShell: () => <div data-testid="launch-shell" /> }))
  vi.doMock('./PanelShell', () => ({ PanelShell: () => <div data-testid="panel-shell" /> }))
  const { Shell } = await import('./Shell')
  return () => render(<MemoryRouter><Shell /></MemoryRouter>)
}

describe('Shell picks the chrome from the one axis this app has', () => {
  it('standalone → LaunchShell', async () => {
    (await shellFor('ehr'))()
    expect(screen.getByTestId('launch-shell')).toBeTruthy()
    expect(screen.queryByTestId('panel-shell')).toBeNull()
  })

  it('panel → PanelShell', async () => {
    (await shellFor('panel'))()
    expect(screen.getByTestId('panel-shell')).toBeTruthy()
    expect(screen.queryByTestId('launch-shell')).toBeNull()
  })

  it('renders exactly one chrome, never both', async () => {
    // The failure this guards is a refactor that returns a fragment holding
    // both, which each assertion above would still pass individually.
    (await shellFor('panel'))()
    expect(screen.queryAllByTestId(/shell$/)).toHaveLength(1)
  })
})
