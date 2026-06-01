// Tools that don't yet have a FSH ActivityDefinition in ig/input/fsh/.
//
// These are placeholders until each is added to the IG. Once an
// ActivityDefinition exists with a matching id (via TOOL_AD_IDS in tools.ts),
// the FHIR-derived row wins over the stub and the entry here should be removed.
//
// TODO: Add minimal FSH ActivityDefinitions for these 15 tools so this file
// can be deleted (tracked separately from Move 6d.6).

import type { WorkflowType } from './tool-ui-metadata'

export interface ToolStub {
  id: string
  name: string
  shortName?: string
  stageId: string
  purpose: string
  description?: string
  /** Kind of FHIR artifact this tool produces. Defaults to 'questionnaire'. */
  workflowType?: WorkflowType
}

export const TOOL_STUBS: ToolStub[] = [
  // ── Flag Risk ──
  {
    id: 'TL-011',
    name: 'Patient Safety Screener-3 (PSS-3)',
    stageId: 'flag-risk',
    purpose: 'Brief acute-care suicide screen',
  },
  {
    id: 'TL-014',
    name: 'Patient Safety Screener / Suicide Risk Screener (Full)',
    stageId: 'flag-risk',
    purpose: 'Combined acute-care screen with local stratification',
  },

  // ── Clarify Risk ──
  {
    id: 'TL-019',
    name: 'Columbia C-SSRS Since Last Contact',
    stageId: 'clarify-risk',
    purpose: 'Repeat assessment since the prior contact',
  },
  {
    id: 'TL-005',
    name: 'NIMH Brief Suicide Safety Assessment (BSSA)',
    stageId: 'clarify-risk',
    purpose: 'Disposition-oriented assessment after positive ASQ',
  },

  // ── Set Risk Status ──
  {
    id: 'TL-006',
    name: 'SAFE-T',
    stageId: 'set-risk-status',
    purpose: 'Structured clinical formulation and triage',
  },

  // ── Document Safety Actions ──
  {
    id: 'TL-008',
    name: 'Means Safety Counseling',
    stageId: 'document-safety-actions',
    purpose: 'Lethal means reduction',
  },
  {
    id: 'TL-013',
    name: 'Now Matters Now',
    stageId: 'document-safety-actions',
    purpose: 'Patient-facing coping-skills and safety-plan support resource',
  },
  {
    id: 'TL-015',
    name: 'Crisis Response Planning',
    stageId: 'document-safety-actions',
    purpose: 'Alternative crisis-planning framework',
  },
  {
    id: 'TL-016',
    name: 'CALM / Means Safety Counseling Protocol',
    stageId: 'document-safety-actions',
    purpose: 'Named means-safety protocol option',
  },

  // ── Coordinate Handoffs ──
  {
    id: 'TL-009',
    name: 'Transition Checkpoint',
    stageId: 'coordinate-handoffs',
    purpose: 'Pre-discharge transfer of care',
    workflowType: 'communication',
  },
  {
    id: 'TL-023',
    name: 'CAMS SSF-5 Outcome/Disposition Final Session',
    stageId: 'coordinate-handoffs',
    purpose: 'Episode closure, disposition, and next-step planning',
  },
  {
    id: 'TL-017',
    name: 'Rapid Referral to Outpatient Behavioral Healthcare',
    stageId: 'coordinate-handoffs',
    purpose: 'Warm handoff and accelerated access to follow-up',
    workflowType: 'communication',
  },

  // ── Track Follow-Up ──
  {
    id: 'TL-010',
    name: 'Outreach / Caring Contacts',
    stageId: 'track-follow-up',
    purpose: 'Closed-loop follow-up',
    workflowType: 'communication',
  },
  {
    id: 'TL-012',
    name: 'ED-SAFE / CLASP-ED Follow-up Protocol',
    stageId: 'track-follow-up',
    purpose: 'Protocol-based post-discharge follow-up — schedule and track the follow-up appointment',
    workflowType: 'appointment',
  },
  {
    id: 'TL-018',
    name: 'Colorado Post-Visit Protocol',
    stageId: 'track-follow-up',
    purpose: 'Protocol-based post-visit outreach',
    workflowType: 'communication',
  },
]
