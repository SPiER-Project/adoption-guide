/**
 * The inputs a page hands its client module, as JSON in a
 * `<script type="application/json" id="spier-page-config">` block.
 *
 * Shared by BOTH TypeScript projects: the Worker (which writes the block from
 * chartPage.ts / controlPage.ts) imports these type-only, and the browser
 * modules beside this file read them. Types only — this file must compile
 * under either `lib`, so nothing from the DOM and nothing from workerd.
 */

export interface ChartClientConfig {
  patient: {
    id: string
    mrn: string
    /** First token of the display name — see the note in chartPage.ts. */
    given: string
    family: string
  }
  /** The MRN identifier system, imported by the page from @spier/core (four sites must agree). */
  mrnSystem: string
  /** Displayed, not fetched — the browser asks this host's /_admin/cds instead. */
  cdsEndpoint: string
  panelOrigin: string
  panelWidths: readonly number[]
  defaultPanelWidth: number
  panelWidthKey: string
}

export interface SettingsClientConfig {
  panelWidths: readonly number[]
  defaultPanelWidth: number
  panelWidthKey: string
}
