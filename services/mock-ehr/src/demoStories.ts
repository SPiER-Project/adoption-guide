/**
 * demoStories — one line per demo patient saying what their chart is FOR, and
 * the three charts a first-time viewer should open.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The front door listed fourteen names with demographics and nothing else, so a
 * viewer had no reason to open one chart rather than another — and the natural
 * first click, the first row, is a finished episode with nothing left to do.
 * The most compelling thing this demo can show (fill in an assessment, watch
 * the host confirm the write) has no motivation on a chart where every stage is
 * already complete. Nothing pointed at a chart where it would.
 *
 * ── Why it is hand-written, and why that is allowed here ────────────────────
 *
 * `fixtures.ts` derives every demographic from the Patient resources on
 * purpose, and `CLAUDE.md` names the sites where the fourteen patients' data
 * must agree. This is NOT a fifth copy of that data: it carries no MRN, no
 * name, no date — only the host's own one-line annotation of each scenario,
 * which is demo authoring, not patient data. It is keyed by id and
 * `demoStories.test.ts` asserts the key set equals `DEMO_PATIENTS` exactly, so
 * a patient added without a story, or a story for a patient that no longer
 * exists, fails a test rather than rendering an empty cell.
 *
 * The lines are written in the HOST's voice — what a clinician opening this
 * chart would want to know — not in SPiER's. SPiER's own recommendation for
 * each patient is what the panel shows once launched; restating it here would
 * put SPiER's judgement on the host's page, on the demo whose subject is which
 * pixels belong to whom.
 */

export interface DemoStory {
  /** One line: what this chart is a story about. Rendered in the patient table. */
  story: string
  /**
   * Present on the two or three charts the front door tells a viewer to open
   * first. `why` says which situation this chart shows; `watch` says what to
   * notice after launching SPiER on it.
   */
  tryIt?: { why: string; watch: string }
}

export const DEMO_STORIES: Record<string, DemoStory> = {
  'patient-001': {
    story: 'Full pathway on file; episode still open after follow-up.',
  },
  'patient-002': {
    story: 'No suicide-risk screening on file.',
    tryIt: {
      why: 'Start from zero. Nothing has been recorded for him.',
      watch: 'SPiER recommends a screen. Fill one in and submit it: the panel reports what it wrote, and this host’s own write log confirms it.',
    },
  },
  'patient-003': {
    story: 'PHQ-9 with item 9 endorsed; risk not yet clarified.',
  },
  'patient-004': {
    story: 'Positive ASQ, not acute; brief safety assessment still owed.',
  },
  'patient-005': {
    story: 'Acute positive ASQ — the urgent branch.',
  },
  'patient-006': {
    story: 'High risk after a CAMS session; stabilization plan still to do.',
    tryIt: {
      why: 'Part-way through the pathway: assessed high risk, with the stabilization plan still to do.',
      watch: 'Two recommendations: define the risk picture, and Start Stabilization Plan. Open the stabilization plan from its card, complete it, and watch it land on this chart.',
    },
  },
  'patient-007': {
    story: 'Adolescent; discharged with a safety plan, intake booked but unconfirmed.',
  },
  'patient-008': {
    story: 'Low risk sustained through follow-up; ready for outcome reporting.',
  },
  'patient-009': {
    story: 'Mid-course CAMS treatment; next session due.',
  },
  'patient-010': {
    story: 'Low risk, closed out; appears in the quarterly report.',
  },
  'patient-011': {
    story: 'A complete ED episode, from screen to handoff to follow-up.',
    tryIt: {
      why: 'The whole pathway, filled in. Screened positive in the ED, assessed, safety-planned, handed off and followed up.',
      watch: 'Every stage on the rail is complete and each one shows what was recorded there. Nothing is left to do; this is what a finished episode looks like.',
    },
  },
  'patient-012': {
    story: 'Negative ED screen; nothing due until the re-screen interval.',
  },
  'patient-013': {
    story: 'Positive ED screen, transferred to a higher level of care.',
  },
  'patient-014': {
    story: 'Left the ED before disposition; no contact since.',
  },
}

/** The ids the front door leads with, in the order it shows them. */
export const TRY_IT_ORDER: string[] = ['patient-002', 'patient-006', 'patient-011']

export function storyOf(id: string): DemoStory {
  const story = DEMO_STORIES[id]
  if (!story) {
    // Reachable only if the test that pins the key set is deleted; a loud
    // failure here beats an empty table cell nobody notices.
    throw new Error(`[mock-ehr] No demo story for ${id}. Add one to demoStories.ts.`)
  }
  return story
}
