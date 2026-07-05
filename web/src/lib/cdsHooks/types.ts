/**
 * Faithful CDS Hooks 2.0 Card types.
 *
 * SPiER's Patient Chart renders "Recommendations" that are, on the wire, real
 * CDS Hooks Cards — this module is the single source of truth for their shape so
 * a future hosted `/cds-services` endpoint (see plan-cds-hooks-service) can emit
 * the exact same objects. Kept dependency-light (no React, no react-router, no
 * `window`) so it is importable from a plain Node service.
 *
 * Spec: https://cds-hooks.org/specification/current/#card-attributes
 */

/** Minimal FHIR Coding used by `Card.source.topic`. */
export interface Coding {
  system: string
  code: string
  display?: string
}

/** CDS Hooks card urgency. Maps to SPiER's clinician-facing pill labels. */
export type CdsIndicator = 'info' | 'warning' | 'critical'

/** Grouping of the card — where the guidance came from. */
export interface CdsSource {
  /** Short, human-readable source of the information displayed on the card. */
  label: string
  /** Optional link to the primary source of the guidance. */
  url?: string
  /** Optional absolute URL to an icon for the source (100x100). */
  icon?: string
  /** Topic of the card content — here, the pathway stage the card targets. */
  topic?: Coding
}

/**
 * A link a user can follow from the card. SPiER's links are deep links into the
 * deployed app, so `type` is always `'absolute'` (not a SMART app launch).
 */
export interface CdsLink {
  label: string
  url: string
  type: 'absolute' | 'smart'
  /** Only valid when `type: 'smart'`; unused by SPiER today. */
  appContext?: string
}

/**
 * SPiER-specific data carried on the spec-sanctioned `extension` object. The
 * chart UI reads these to keep client-side routing and demo affordances working
 * without polluting the standard card fields. Every key is namespaced so a real
 * CDS client can safely ignore the whole object.
 */
export interface SpierCardExtension {
  /** Deterministic id (`cds-stage-…` / `cds-alert-…`) for React keys & tests. */
  'spier-card-id': string
  /** Pathway stage this card is about (mirrors `source.topic.code`). */
  'spier-stage-id'?: string
  /**
   * True when the card's summary/detail already convey a curated next step, so
   * the UI should suppress the "no tools enabled" fallback. Omitted when false.
   */
  'spier-narrative-only'?: boolean
  /**
   * Maps each link's absolute `url` back to its in-app router path, so the SPA
   * can render a client-side `<Link>` instead of a full page navigation.
   */
  'spier-router-paths'?: Record<string, string>
}

/** A CDS Hooks 2.0 Card. https://cds-hooks.org/specification/current/#card-attributes */
export interface Card {
  /** Unique identifier for this card (per response). */
  uuid?: string
  /** One-sentence, ≤140-char summary. */
  summary: string
  /** Optional detail, in GitHub-Flavored Markdown. */
  detail?: string
  indicator: CdsIndicator
  source: CdsSource
  /** Suggestions the user can accept. Unused in v1 (SPiER actions are links). */
  suggestions?: unknown[]
  /** Required iff `suggestions` is present. */
  selectionBehavior?: 'at-most-one' | 'any'
  overrideReasons?: unknown[]
  links?: CdsLink[]
  extension?: SpierCardExtension
}

/** The response body a CDS Hooks service returns for a hook invocation. */
export interface CdsServiceResponse {
  cards: Card[]
}
