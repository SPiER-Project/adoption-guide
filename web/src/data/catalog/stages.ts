export interface Stage {
  id: string
  title: string
  description: string
  orderIndex: number
}

export const STAGES: Stage[] = [
  {
    id: 'flag-risk',
    title: 'Flag Risk',
    description: 'The EHR captures a suicide-related signal and indicates whether further suicide-risk review is needed.',
    orderIndex: 0,
  },
  {
    id: 'clarify-risk',
    title: 'Clarify Risk',
    description: 'The EHR captures the details needed to understand the nature, severity, and context of suicide risk.',
    orderIndex: 1,
  },
  {
    id: 'set-risk-status',
    title: 'Set Risk Status',
    description: 'The EHR supports documenting the current risk status and the clinical reasoning that guides next steps.',
    orderIndex: 2,
  },
  {
    id: 'document-safety-actions',
    title: 'Document Safety Actions',
    description: 'The EHR supports documenting and updating the concrete actions used to reduce risk and support safety.',
    orderIndex: 3,
  },
  {
    id: 'coordinate-handoffs',
    title: 'Coordinate Handoffs',
    description: 'The EHR supports the transfer of essential suicide-safety information, responsibility, and follow-up details across people, settings, and time points.',
    orderIndex: 4,
  },
  {
    id: 'track-follow-up',
    title: 'Track Follow-Up',
    description: 'The EHR tracks whether outreach and follow-up steps occur after the immediate encounter.',
    orderIndex: 5,
  },
  {
    id: 'manage-active-risk',
    title: 'Manage Active Risk',
    description: 'The EHR keeps active suicide-safer care episodes visible, trackable, and escalated when needed.',
    orderIndex: 6,
  },
  {
    id: 'measure-and-share',
    title: 'Measure and Share',
    description: 'The EHR makes pathway activity usable for reporting, quality improvement, accountability, and information sharing.',
    orderIndex: 7,
  },
]

export const stageById = (id: string) => STAGES.find(s => s.id === id)
export const stageTitleById = (id: string) => stageById(id)?.title ?? id
