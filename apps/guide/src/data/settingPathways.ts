/**
 * The setting pathways the guide has a page for: where each one lives, and the
 * page copy that is NOT the artifact's.
 *
 * ⚠️ **Which settings exist is the artifact's, not this file's.** The core
 * protocol lists them as `relatedArtifact #composed-of`
 * (ig/input/fsh/suicide-safer-care-pathway.fsh), and that list is what
 * /guide/pathway draws. This file only answers "where is the page for that
 * canonical". `settingPathways.test.ts` holds the two in agreement both ways —
 * a setting the artifact names with no page here fails, and so does a page here
 * for a canonical the artifact does not name — so adding a third setting is an
 * FSH change plus a row here, and forgetting either is red.
 *
 * ⚠️ `href` is a LITERAL, in a property whose name ends in `href`, on purpose:
 * that is one of the forms `check:surface-links` reads, so every route here is
 * resolved against the guide's own route table. A computed target is the one
 * form that gate cannot see.
 *
 * `pending` is page copy, labelled as such on the page, for the same reason
 * the core protocol's pending strip is: a published protocol must not encode
 * what is not settled, and a reader must not have to guess which parts came
 * from the artifact.
 */
export interface SettingPathwayPage {
  /** The setting pathway's canonical — must be one the core protocol names. */
  canonical: string
  /** The guide sub-path, as `guideSections` declares it. */
  path: string
  /** The same route, absolute, as a literal (see the header). */
  href: string
  /** The page's title in the guide header. */
  label: string
  /** Who the page is for and what it shows, in one or two sentences. */
  lede: string
  /** Set when the protocol has not had clinical review — rendered as a notice. */
  reviewStatus?: string
  /** What the setting's source left open, and the protocol therefore leaves out. */
  pending: string[]
}

export const SETTING_PATHWAY_PAGES: SettingPathwayPage[] = [
  {
    canonical: 'http://thespierproject.org/fhir/PlanDefinition/SPiEREDSuicideCarePathway',
    path: 'pathway/emergency-department',
    href: '/guide/pathway/emergency-department',
    label: 'In the emergency department',
    lede:
      'If you run or build for an emergency department, this is the same pathway as it applies there: ' +
      'screening at triage, immediate safety for a positive screen, and either discharge with a safety ' +
      'plan or admission. It follows the emergency department scenario of the HL7 Behavioral Health ' +
      'working group.',
    pending: [
      'Steps SPiER has proposed to the working group but the group has not yet agreed, such as a ' +
        'patient leaving before treatment is complete, or a screen that could not be done. They are ' +
        'proposals, so they are not part of this pathway yet.',
    ],
  },
  {
    canonical: 'http://thespierproject.org/fhir/PlanDefinition/SPiERInpatientSuicideCarePathway',
    path: 'pathway/inpatient',
    href: '/guide/pathway/inpatient',
    label: 'In inpatient psychiatric care',
    lede:
      'If you run or build for an inpatient psychiatric unit, this is the same pathway across a stay: ' +
      'screening on admission, reassessment through the stay, safety planning that starts on day one, ' +
      'and a discharge the whole team signs. Patients admitted from an emergency department arrive here ' +
      'from that setting’s admission step.',
    reviewStatus:
      'A draft. It was written from one walkthrough with an inpatient clinical leader and has not yet ' +
      'been reviewed by them. Only what that walkthrough settled is part of the pathway.',
    pending: [
      'How often a patient who is not high risk is reassessed during the stay.',
      'Contact after discharge, such as a next-day call or caring contacts. Described as important, but ' +
        'not yet part of routine practice.',
      'A warning when a discharge prescription exceeds the facility’s limit on quantity.',
      'A structured record of which treatment groups and therapies each patient attended, so a facility ' +
        'can see which interventions follow screening and assessment.',
    ],
  },
]
