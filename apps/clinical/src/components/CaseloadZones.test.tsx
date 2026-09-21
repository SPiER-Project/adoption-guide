/**
 * @vitest-environment jsdom
 *
 * The two pieces §4.8 moved: the summary's phone rule, and the alerts as a
 * line rather than a panel.
 *
 * ⚠️ **The collapse branch is invisible to every other test in this repo.**
 * `useNarrowViewport` reports "not narrow" when `matchMedia` is missing, which
 * is jsdom — a deliberate default, because the other way round makes the phone
 * branch the one every test that never thought about width silently exercises
 * (the trap PR 4 hit when a zero width read as narrow). So the only way to
 * check the phone rule is to give jsdom a `matchMedia` that says yes, which is
 * what this file does.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PopulationSummary } from './PopulationSummary'
import { CaseloadAlertsLine } from './CaseloadAlertsLine'
import type { SummaryTile } from '../lib/populationSummary'
import type { PatientAlertGroup } from '../lib/populationAlerts'

const TILES: SummaryTile[] = [
  { state: 'value', id: 'on-pathway', label: 'Patients on suicide care pathway', value: '6' },
  { state: 'value', id: 'high-risk', label: 'High risk', value: '5 · 36%', goal: '<5%', breached: true },
  { state: 'value', id: 'low-risk', label: 'Low risk', value: '2', goal: 'Monitor' },
  { state: 'value', id: 'overdue', label: 'Reassessments overdue', value: '7', goal: '0', breached: true },
]

function widthIs(narrow: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: narrow,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the summary on a phone', () => {
  beforeEach(() => widthIs(true))

  it('opens collapsed to the tiles that are over their goal, and nothing else', () => {
    render(<PopulationSummary tiles={TILES} census={[]} total={14} />)
    // The two breached ones are still there — a caseload with five high-risk
    // patients against a goal of under 5% is what a phone's first glance is for.
    expect(screen.getByText('High risk')).toBeTruthy()
    expect(screen.getByText('Reassessments overdue')).toBeTruthy()
    // …and the four screens of everything else are behind the toggle.
    expect(screen.queryByText('Low risk')).toBeNull()
    expect(screen.queryByText('Patients on suicide care pathway')).toBeNull()
  })

  it('collapses to NOTHING when no tile is over its goal — not to a default tile', () => {
    const calm = TILES.map(t => ({ ...t, breached: false }))
    const { container } = render(<PopulationSummary tiles={calm} census={[]} total={14} />)
    expect(container.querySelectorAll('.pop-tile')).toHaveLength(0)
  })
})

describe('the summary on a laptop', () => {
  beforeEach(() => widthIs(false))

  it('opens expanded — every tile, not just the breached ones', () => {
    render(<PopulationSummary tiles={TILES} census={[]} total={14} />)
    expect(screen.getByText('Low risk')).toBeTruthy()
    expect(screen.getByText('Patients on suicide care pathway')).toBeTruthy()
  })
})

const GROUPS: PatientAlertGroup[] = [
  {
    patientId: 'patient-007',
    patientName: 'Aisha Patel-Williams',
    severity: 'red',
    alerts: [
      { patientId: 'patient-007', patientName: 'Aisha Patel-Williams', severity: 'red', label: 'a', detail: '', source: null },
      { patientId: 'patient-007', patientName: 'Aisha Patel-Williams', severity: 'yellow', label: 'b', detail: '', source: null },
    ],
  },
  {
    patientId: 'patient-009',
    patientName: 'Mei Lin',
    severity: 'yellow',
    alerts: [
      { patientId: 'patient-009', patientName: 'Mei Lin', severity: 'yellow', label: 'c', detail: '', source: null },
    ],
  },
]

describe('the alerts, as a line', () => {
  const line = (groups: PatientAlertGroup[]) =>
    render(
      <MemoryRouter>
        <CaseloadAlertsLine groups={groups} />
      </MemoryRouter>,
    )

  it('leads with the urgent count and lists no alert', () => {
    const { container } = line(GROUPS)
    expect(screen.getByText('1 urgent')).toBeTruthy()
    expect(screen.getByText(/3 alerts across 2 patients/)).toBeTruthy()
    // The whole point: the labels and the patients are on the page it opens.
    expect(screen.queryByText('Aisha Patel-Williams')).toBeNull()
    expect(container.textContent?.length).toBeLessThan(80)
  })

  it('says so when there is nothing outstanding, rather than vanishing', () => {
    // A line that disappears when the count is zero reads as a panel that
    // failed to load.
    line([])
    expect(screen.getByText(/No alerts outstanding/)).toBeTruthy()
  })

  it('always offers the page', () => {
    line(GROUPS)
    expect(screen.getByRole('link', { name: /Review alerts/ }).getAttribute('href')).toBe(
      '/population/alerts',
    )
  })
})
