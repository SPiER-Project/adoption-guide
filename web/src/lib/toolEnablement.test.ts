import { describe, it, expect } from 'vitest'
import { toolEnablementFor } from './toolEnablement'

describe('toolEnablementFor — the chart in a host offers every tool the service does', () => {
  const sitePreset = (id: string) => id === 'TL-001'

  it('honours the Tool Configuration preset in the standalone shell', () => {
    const enabled = toolEnablementFor('ehr', sitePreset)
    expect(enabled('TL-001')).toBe(true)
    expect(enabled('TL-020')).toBe(false)
  })

  it('offers every catalogued tool in panel chrome, matching the CDS Hooks service', () => {
    // The service (services/cds-hooks/src/service.ts) passes `() => true`; a
    // panel that applied the preset disagreed with it about patient-006.
    const enabled = toolEnablementFor('panel', sitePreset)
    expect(enabled('TL-001')).toBe(true)
    expect(enabled('TL-020')).toBe(true)
  })
})
