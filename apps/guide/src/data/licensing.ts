import type { Licensing } from '@spier/core/data/catalog'

/**
 * What the guide says about each licensing status — the label on the pill,
 * and the sentence beside it.
 *
 * Lived inside `pages/AdoptionReadiness.tsx` while that table was the only
 * place the guide named a tool's licensing. The tool page
 * (`pages/ToolPage.tsx`, 2026-09-20) shows the same status with the full
 * copyright notice beside it, and a second copy of five labels and five blurbs
 * would be exactly the hand-duplicated drift `check:dupes` fails — so both
 * pages read this one. In its own module rather than beside the pill because
 * a component file exports components only (Fast Refresh).
 *
 * Both maps mirror the codes in ig/input/fsh/instrument-licensing.fsh, which is
 * where a tool's status is actually set. The pill is the summary; the full
 * notice — including where the claim comes from — is `Tool.copyright`, read
 * straight from `ActivityDefinition.copyright`.
 */
export const LICENSING_LABELS: Record<Licensing, string> = {
  'public-domain': 'Public domain',
  registration: 'Registration',
  commercial: 'Commercial',
  'spier-authored': 'SPiER-authored',
  unknown: 'Unknown',
}

export const LICENSING_BLURB: Record<Licensing, string> = {
  'public-domain': 'Free to use and embed without permission or fees (e.g. ASQ, PHQ-9, BSSA). Attribution still good practice.',
  registration: 'Free but gated — requires registering with the rights holder, obtaining written permission, and/or training before deployment (e.g. C-SSRS, Stanley-Brown).',
  commercial: 'Requires a paid license, a purchased instrument, or a negotiated agreement with the rights holder (e.g. CAMS). Confirm terms before deploying.',
  'spier-authored': 'No third-party instrument is reproduced — SPiER workflow content, published with the IG under CC0-1.0. Anything you substitute into the step carries its own terms.',
  unknown: 'Not established by the licensing audit. Confirm terms with the rights holder before deploying — this is an open question, not a green light.',
}
