#!/usr/bin/env node
// Idempotent migration script — Phase 1 of docs/plans/ssc-stage-tiles-rollout.md.
//
// Brings GitHub labels/issues in line with the July 2026 SSC stage-tile
// restructure (already merged in the FHIR/catalog layer):
//   - renames the 3 stage labels whose codes changed
//   - retitles/redescribes labels for tools that were renamed, restaged, or
//     retired, and fixes one pre-existing stage-label drift (TL-024)
//   - closes issues for consolidated (TL-022/023 → TL-020) and retired
//     (TL-012/016/018) tools, with an explanatory comment
//   - creates a new `status:retired` label for those tools
//   - creates tracking epics for the new placeholder tools (TL-026–TL-045)
//
// Usage:
//   node scripts/migrate-roadmap-stages.mjs           # uses local `gh` auth
//   node scripts/migrate-roadmap-stages.mjs --dry-run # print what would happen
//
// Safe to re-run: label edits are idempotent; issue creation is skipped if a
// title already exists; comments/closes are NOT re-applied if the issue is
// already closed (checked against a live issue-state fetch).
//
// After running, refresh the site snapshot:
//   node web/scripts/fetch-roadmap.mjs

import { spawnSync } from 'node:child_process'

const DRY_RUN = process.argv.includes('--dry-run')
const REPO = process.env.SPIER_ROADMAP_REPO ?? 'SPiER-Project/adoption-guide'

function log(msg) {
  console.log(`[migrate-roadmap] ${msg}`)
}

function gh(args, { input } = {}) {
  if (DRY_RUN) {
    log(`(dry-run) gh ${args.join(' ')}`)
    return { ok: true, stdout: '' }
  }
  const result = spawnSync('gh', args, {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    return { ok: false, stdout: result.stdout, stderr: result.stderr }
  }
  return { ok: true, stdout: result.stdout }
}

// ─────────────────────────────────────────────────────────────
// 1. Stage label renames (preserves issue associations)
// ─────────────────────────────────────────────────────────────

const STAGE_RENAMES = [
  { from: 'stage:flag-risk', to: 'stage:identify-possible-risk', description: 'Stage 1 — Identify Possible Risk' },
  { from: 'stage:set-risk-status', to: 'stage:define-risk-picture', description: 'Stage 3 — Define the Risk Picture' },
  { from: 'stage:manage-active-risk', to: 'stage:track-risk-over-time', description: 'Stage 7 — Track Risk Over Time' },
]

const STAGE_DESCRIPTION_ONLY = [
  { name: 'stage:measure-and-share', description: 'Stage 8 — Measure and Share the Data' },
]

function renameStageLabels() {
  for (const { from, to, description } of STAGE_RENAMES) {
    const r = gh(['label', 'edit', from, '--repo', REPO, '--name', to, '--description', description])
    if (!r.ok) {
      log(`label rename FAILED for ${from} → ${to}: ${r.stderr?.trim() ?? '(no stderr)'}`)
      continue
    }
    log(`label renamed: ${from} → ${to}`)
  }
  for (const { name, description } of STAGE_DESCRIPTION_ONLY) {
    const r = gh(['label', 'edit', name, '--repo', REPO, '--description', description])
    if (!r.ok) {
      log(`label description update FAILED for ${name}: ${r.stderr?.trim() ?? '(no stderr)'}`)
      continue
    }
    log(`label description updated: ${name}`)
  }
}

// ─────────────────────────────────────────────────────────────
// 2. New standard labels
// ─────────────────────────────────────────────────────────────

const NEW_STANDARD_LABELS = [
  { name: 'status:retired', color: 'cccccc', description: 'Tool removed from the catalog; issue kept for history' },
]

function ensureLabel({ name, color, description }) {
  const args = ['label', 'create', name, '--repo', REPO, '--color', color, '--description', description ?? '', '--force']
  const r = gh(args)
  if (!r.ok) {
    log(`label create FAILED for ${name}: ${r.stderr?.trim() ?? '(no stderr)'}`)
    return false
  }
  log(`label ensured: ${name}`)
  return true
}

// ─────────────────────────────────────────────────────────────
// 3. Tool-label description updates (existing tool:TL-0xx labels)
// Format mirrors the seed script: "<name> (<stage>)", with a short note for
// retired/consolidated tools.
// ─────────────────────────────────────────────────────────────

const TOOL_LABEL_UPDATES = [
  { id: 'TL-001', description: 'ASQ (identify-possible-risk)' },
  { id: 'TL-002', description: 'PHQ-9 / PHQ-A Item 9 Trigger (identify-possible-risk)' },
  { id: 'TL-003', description: 'C-SSRS Screener (identify-possible-risk)' },
  { id: 'TL-006', description: 'SAFE-T (define-risk-picture)' },
  { id: 'TL-008', description: 'Lethal Means Safety Counseling (document-safety-actions) — includes CALM (formerly TL-016)' },
  { id: 'TL-009', description: 'Suicide-Safety Handoff (coordinate-handoffs)' },
  { id: 'TL-011', description: 'PSS-3 (identify-possible-risk)' },
  { id: 'TL-012', description: 'ED-SAFE — retired, superseded by TL-033–TL-036' },
  { id: 'TL-013', description: 'Patient-Facing Crisis Resources (document-safety-actions)' },
  { id: 'TL-014', description: 'PSS Full (clarify-risk) — moved from identify-possible-risk' },
  { id: 'TL-016', description: 'CALM — retired, merged into TL-008' },
  { id: 'TL-018', description: 'CO Post-Visit — retired, superseded by TL-033–TL-036' },
  { id: 'TL-020', description: 'CAMS SSF-5 (clarify-risk) — one tool: Section A/B, Interim, Outcome/Disposition' },
  { id: 'TL-022', description: 'CAMS Interim — consolidated into TL-020' },
  { id: 'TL-023', description: 'CAMS Outcome — consolidated into TL-020' },
  { id: 'TL-024', description: 'CAMS Worksheet (define-risk-picture) — corrected from a stale manage-active-risk label' },
  { id: 'TL-025', description: 'SBQ-R (identify-possible-risk)' },
]

function updateToolLabelDescriptions() {
  for (const { id, description } of TOOL_LABEL_UPDATES) {
    const r = gh(['label', 'edit', `tool:${id}`, '--repo', REPO, '--description', description])
    if (!r.ok) {
      log(`tool-label update FAILED for tool:${id}: ${r.stderr?.trim() ?? '(no stderr)'}`)
      continue
    }
    log(`tool-label updated: tool:${id}`)
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Per-issue fixups: retitle, relabel, close+comment
// ─────────────────────────────────────────────────────────────

const RETITLES = [
  { number: 24, title: '[TL-008] Lethal Means Safety Counseling' },
  { number: 25, title: '[TL-009] Suicide-Safety Handoff' },
  { number: 29, title: '[TL-013] Patient-Facing Crisis Resources' },
]

const RELABELS = [
  // TL-014 moved Identify Possible Risk → Clarify Risk.
  { number: 30, addLabels: ['stage:clarify-risk'], removeLabels: ['stage:identify-possible-risk'] },
  // TL-024 was mislabeled stage:manage-active-risk pre-restructure; its real
  // stage (per pathway-stages.fsh) is Define the Risk Picture.
  { number: 40, addLabels: ['stage:define-risk-picture'], removeLabels: ['stage:track-risk-over-time'] },
]

// Comments reference sibling new-tool issues via `{{TL-0xx}}` tokens, resolved
// to real `#<number>` links after those issues are created (see
// resolveIssueRefs) — GitHub only auto-links numeric `#<n>`, not `#TL-0xx`.
const CLOSE_RETIRED = [
  {
    number: 28, // TL-012 ED-SAFE
    comment:
      'Retired in the July 2026 SSC stage-tile restructure. Superseded by the generalized Track Follow-Up workflow tools: {{TL-033}} (Follow-Up Outreach / Contact Attempts), {{TL-035}} (Missed Appointment / No-Show Follow-Up), {{TL-036}} (Follow-Up Escalation Workflow). See docs/reference/ssc-stage-tiles-question-set.md.',
    addLabels: ['status:retired'],
    removeLabels: ['status:planned'],
  },
  {
    number: 32, // TL-016 CALM
    comment:
      'Retired in the July 2026 SSC stage-tile restructure. Merged into TL-008 (now "Lethal Means Safety Counseling"), which explicitly covers the CALM protocol as one of its documented means-safety actions.',
    addLabels: ['status:retired'],
    removeLabels: ['status:future'],
  },
  {
    number: 34, // TL-018 Colorado Post-Visit
    comment:
      'Retired in the July 2026 SSC stage-tile restructure. Superseded by the generalized Track Follow-Up workflow tools: {{TL-034}} (Follow-Up Appointment Tracking), {{TL-035}} (Missed Appointment / No-Show Follow-Up). See docs/reference/ssc-stage-tiles-question-set.md.',
    addLabels: ['status:retired'],
    removeLabels: ['status:future'],
  },
  {
    number: 38, // TL-022 CAMS Interim
    comment:
      'Consolidated into TL-020 (CAMS SSF-5) in the July 2026 SSC stage-tile restructure — the SSC spec treats CAMS SSF-5 as one tool whose session-specific forms (First Session, Interim, Outcome/Disposition) are captured inside it rather than tracked as separate stage-scattered tools. The Interim re-rating (`AdministerCAMSInterimSession`) now maps to TL-020 in the catalog. See #36 and docs/reference/ssc-stage-tiles-question-set.md.',
    addLabels: ['status:retired'],
    removeLabels: ['status:built'],
  },
  {
    number: 39, // TL-023 CAMS Outcome/Disposition
    comment:
      'Consolidated into TL-020 (CAMS SSF-5) in the July 2026 SSC stage-tile restructure — same rationale as #38. The Outcome/Disposition final session (`AdministerCAMSOutcomeDisposition`) now maps to TL-020 in the catalog; it remains a placeholder (no Questionnaire binding yet) — see Wave 3 of docs/plans/ssc-stage-tiles-rollout.md. See #36.',
    addLabels: ['status:retired'],
    removeLabels: ['status:planned'],
  },
]

// Resolved after createNewToolEpics() runs — maps 'TL-0xx' → issue number.
let toolIssueNumbers = new Map()

function resolveIssueRefs(text) {
  return text.replace(/\{\{(TL-\d+)\}\}/g, (_, id) => {
    const n = toolIssueNumbers.get(id)
    return n ? `#${n}` : id // fall back to the bare id if not resolved (e.g. dry-run)
  })
}

const COMMENT_ONLY = [
  {
    number: 36, // TL-020 CAMS SSF-5
    comment:
      'Consolidated in the July 2026 SSC stage-tile restructure: this tool now also covers the Interim re-rating (formerly tracked as #38 / TL-022) and the Outcome/Disposition final session (formerly tracked as #39 / TL-023) as session forms of the same SSF-5 assessment, per the SSC spec (docs/reference/ssc-stage-tiles-question-set.md). Outcome/Disposition remains a placeholder ActivityDefinition (no Questionnaire binding yet).',
  },
]

function issueState(number) {
  const r = gh(['issue', 'view', String(number), '--repo', REPO, '--json', 'state'])
  if (!r.ok) return null
  try {
    return JSON.parse(r.stdout).state
  } catch {
    return null
  }
}

function retitleIssues() {
  for (const { number, title } of RETITLES) {
    const r = gh(['issue', 'edit', String(number), '--repo', REPO, '--title', title])
    if (!r.ok) {
      log(`retitle FAILED for #${number}: ${r.stderr?.trim() ?? '(no stderr)'}`)
      continue
    }
    log(`retitled #${number}: ${title}`)
  }
}

function relabelIssues() {
  for (const { number, addLabels = [], removeLabels = [] } of RELABELS) {
    const args = ['issue', 'edit', String(number), '--repo', REPO]
    for (const l of addLabels) args.push('--add-label', l)
    for (const l of removeLabels) args.push('--remove-label', l)
    const r = gh(args)
    if (!r.ok) {
      log(`relabel FAILED for #${number}: ${r.stderr?.trim() ?? '(no stderr)'}`)
      continue
    }
    log(`relabeled #${number}: +${addLabels.join(',')} -${removeLabels.join(',')}`)
  }
}

function closeRetiredIssues() {
  for (const { number, comment, addLabels = [], removeLabels = [] } of CLOSE_RETIRED) {
    if (!DRY_RUN && issueState(number) === 'CLOSED') {
      log(`skipping (already closed): #${number}`)
      continue
    }
    const labelArgs = ['issue', 'edit', String(number), '--repo', REPO]
    for (const l of addLabels) labelArgs.push('--add-label', l)
    for (const l of removeLabels) labelArgs.push('--remove-label', l)
    const rLabel = gh(labelArgs)
    if (!rLabel.ok) log(`relabel FAILED for #${number}: ${rLabel.stderr?.trim() ?? '(no stderr)'}`)

    const rClose = gh(['issue', 'close', String(number), '--repo', REPO, '--comment', resolveIssueRefs(comment)])
    if (!rClose.ok) {
      log(`close FAILED for #${number}: ${rClose.stderr?.trim() ?? '(no stderr)'}`)
      continue
    }
    log(`closed #${number} (retired/consolidated)`)
  }
}

function commentOnly() {
  for (const { number, comment } of COMMENT_ONLY) {
    const r = gh(['issue', 'comment', String(number), '--repo', REPO, '--body', comment])
    if (!r.ok) {
      log(`comment FAILED for #${number}: ${r.stderr?.trim() ?? '(no stderr)'}`)
      continue
    }
    log(`commented on #${number}`)
  }
}

// ─────────────────────────────────────────────────────────────
// 5. New tool epics — TL-026 through TL-045.
//
// Stages use the NEW codes (post-rename). `wave` is informational, matching
// docs/plans/ssc-stage-tiles-rollout.md; TL-026 and TL-029 were gaps in that
// plan's wave tables, folded in here as Wave 1 / Wave 3 respectively.
// ─────────────────────────────────────────────────────────────

const NEW_TOOLS = [
  { id: 'TL-026', name: 'Positive Screen Flag / Suicide-Risk Workflow Trigger', stage: 'identify-possible-risk', status: 'planned',
    nextStep: 'Make positive screens actionable: chart flag, work-queue entry, notification, and next-step routing. Wave 1 — foundational, closely related to the already-encoded ASQ/PHQ-9 Item 9 → Clarify Risk PlanDefinition triggers.' },
  { id: 'TL-027', name: 'C-SSRS Pediatric / Adolescent Version', stage: 'identify-possible-risk', status: 'planned',
    nextStep: 'Age-appropriate C-SSRS wording. Wave 2 — verify Columbia Lighthouse Project licensing covers the pediatric variant before authoring; reuse cssrs.fsh patterns.' },
  { id: 'TL-028', name: 'Cultural Assessment of Risk for Suicide (CARS-S)', stage: 'clarify-risk', status: 'future',
    nextStep: 'Wave 3 — licensing status unknown. Do a licensing audit (FHIR-Resources/CARS-S/licensing/MEMO.md) BEFORE authoring any artifacts.' },
  { id: 'TL-029', name: 'Full Suicide-Risk Assessment / Local Assessment Tool', stage: 'clarify-risk', status: 'future',
    nextStep: 'Fallback for EHRs without a named assessment tool. Lowest priority — a gap in the original wave plan, filed here for tracking.' },
  { id: 'TL-030', name: 'Discharge Safety Packet / Transition Bundle', stage: 'coordinate-handoffs', status: 'future',
    nextStep: 'Wave 5. Suggested shape: DocumentReference or Communication bundle listing included artifacts (safety plan, crisis resources, risk status, follow-up details).' },
  { id: 'TL-031', name: 'Next Appointment / Follow-Up Visit Scheduling', stage: 'coordinate-handoffs', status: 'future',
    nextStep: 'Wave 5. Suggested shape: Appointment resource, scheduled before discharge/transition; alert staff if missing.' },
  { id: 'TL-032', name: 'Consent / Information-Sharing Status', stage: 'coordinate-handoffs', status: 'future',
    nextStep: 'Wave 5. Suggested shape: Consent resource governing what handoff/packet content can be shared and with whom.' },
  { id: 'TL-033', name: 'Follow-Up Outreach / Contact Attempts', stage: 'track-follow-up', status: 'future',
    nextStep: 'Wave 5. Suggested shape: Communication/Task per attempt (due date, method, outcome, next attempt needed). Absorbs ED-SAFE-style phone-call follow-up (see closed #TL-012).' },
  { id: 'TL-034', name: 'Follow-Up Appointment Tracking', stage: 'track-follow-up', status: 'future',
    nextStep: 'Wave 5. Suggested shape: Appointment + encounter-status derivation; 7-day / 30-day completion windows for measure reporting (TL-042).' },
  { id: 'TL-035', name: 'Missed Appointment / No-Show Follow-Up', stage: 'track-follow-up', status: 'future',
    nextStep: 'Wave 5. Connects a no-show to suicide-risk status/workflow and prompts outreach or escalation. Absorbs Colorado Post-Visit Protocol territory (see closed #TL-018).' },
  { id: 'TL-036', name: 'Follow-Up Escalation Workflow', stage: 'track-follow-up', status: 'future',
    nextStep: 'Wave 5. Suggested shape: Task with outcome codes, routed to responsible clinician/team/supervisor.' },
  { id: 'TL-037', name: 'Active Suicide-Safer Care Registry / Work Queue', stage: 'track-risk-over-time', status: 'future',
    nextStep: 'Wave 5 — do as a design PR first. Suggested shape: EpisodeOfCare + Flag (chart banner), the natural anchor for the whole Track Risk Over Time tile.' },
  { id: 'TL-038', name: 'Suicide-Risk Episode / Pathway Status', stage: 'track-risk-over-time', status: 'future',
    nextStep: 'Wave 5. Suggested shape: EpisodeOfCare lifecycle (open/closed, closure reason) — see TL-037 design PR.' },
  { id: 'TL-039', name: 'Reassessment / Risk Review Schedule', stage: 'track-risk-over-time', status: 'future',
    nextStep: 'Wave 5. Suggested shape: Task with due dates driven by risk tier / last assessment date; due/overdue alerts.' },
  { id: 'TL-040', name: 'Open Safety Actions / Care Gap Tracking', stage: 'track-risk-over-time', status: 'future',
    nextStep: 'Wave 5. Suggested shape: Task per open action/gap with owner + due date.' },
  { id: 'TL-041', name: 'Risk Escalation / Overdue Workflow', stage: 'track-risk-over-time', status: 'future',
    nextStep: 'Wave 5. Suggested shape: Task, triggered by overdue reassessment/follow-up or worsening risk; documented outcome.' },
  { id: 'TL-042', name: 'Suicide-Safer Care KPI / Measure Reporting', stage: 'measure-and-share', status: 'future',
    nextStep: 'Wave 6. Suggested shape: FHIR Measure resources for the SSC measure list (screen→assessment, safety plan before discharge, 7/30-day follow-up, …) + example MeasureReports.' },
  { id: 'TL-043', name: 'Reporting Dashboard / Aggregate View', stage: 'measure-and-share', status: 'future',
    nextStep: 'Wave 6. Primarily app-side work (PopulationView aggregate); scope as a web feature rather than a FHIR artifact.' },
  { id: 'TL-044', name: 'Data Export / Analytics Extract', stage: 'measure-and-share', status: 'future',
    nextStep: 'Wave 6. Structured export (CSV/warehouse/FHIR API) with timestamps for measurement; align with the CapabilityStatement.' },
  { id: 'TL-045', name: 'Data Sharing / Interoperability Output', stage: 'measure-and-share', status: 'future',
    nextStep: 'Wave 6. Documentation + CapabilityStatement work; align with the existing CDS Hooks service and SMART read/write paths.' },
]

function ensureNewToolLabels() {
  for (const t of NEW_TOOLS) {
    ensureLabel({ name: `tool:${t.id}`, color: 'fef2c0', description: `${t.name} (${t.stage})` })
  }
}

function listExistingIssuesByTitle() {
  const r = gh(['issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '500', '--json', 'title,number'])
  if (!r.ok) {
    log(`could not list existing issues: ${r.stderr?.trim() ?? '(no stderr)'}`)
    return new Map()
  }
  try {
    return new Map(JSON.parse(r.stdout || '[]').map((x) => [x.title, x.number]))
  } catch {
    return new Map()
  }
}

function newToolEpicBody(t) {
  return [
    `**Tool:** ${t.name}`,
    `**Stage:** ${t.stage}`,
    `**Current status:** ${t.status}`,
    '',
    '## Next',
    '',
    t.nextStep,
    '',
    '---',
    '',
    'This is the tracking epic for this tool. Concrete pieces of work should be opened as separate issues with the `tool:' + t.id + '` label.',
    '',
    'Filed during the July 2026 GitHub roadmap migration (Phase 1 of docs/plans/ssc-stage-tiles-rollout.md), created directly from the SSC stage-tile spec (docs/reference/ssc-stage-tiles-question-set.md) rather than migrated from an existing Roadmap.tsx entry.',
  ].join('\n')
}

// Creates each new tool epic (skipping ones that already exist) and returns
// a 'TL-0xx' → issue-number map so later steps (retirement comments) can
// cross-link with real `#<number>` references instead of bare tool ids.
function createNewToolEpics(existingByTitle) {
  const numbers = new Map()
  for (const t of NEW_TOOLS) {
    const title = `[${t.id}] ${t.name}`
    const existingNumber = existingByTitle.get(title)
    if (existingNumber) {
      log(`skipping (already exists): ${title} (#${existingNumber})`)
      numbers.set(t.id, existingNumber)
      continue
    }
    const args = [
      'issue', 'create', '--repo', REPO,
      '--title', title,
      '--body', newToolEpicBody(t),
      '--label', 'type:epic',
      '--label', `tool:${t.id}`,
      '--label', `stage:${t.stage}`,
      '--label', `status:${t.status}`,
    ]
    const r = gh(args)
    if (!r.ok) {
      log(`issue create FAILED for "${title}": ${r.stderr?.trim() ?? '(no stderr)'}`)
      continue
    }
    log(`issue created: ${title}`)
    const match = r.stdout.match(/\/issues\/(\d+)/)
    if (match) numbers.set(t.id, Number(match[1]))
  }
  return numbers
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

function main() {
  if (DRY_RUN) log('DRY RUN — no GitHub calls will be made')
  log(`target repo: ${REPO}`)

  log('— renaming stage labels —')
  renameStageLabels()

  log('— ensuring new standard labels —')
  for (const l of NEW_STANDARD_LABELS) ensureLabel(l)

  log('— ensuring new tool labels —')
  ensureNewToolLabels()

  log('— updating existing tool-label descriptions —')
  updateToolLabelDescriptions()

  log('— retitling renamed-tool issues —')
  retitleIssues()

  log('— relabeling restaged issues —')
  relabelIssues()

  // Create the new tool epics BEFORE closing retired issues, so the
  // retirement comments can cross-link to them with real issue numbers
  // (see resolveIssueRefs / {{TL-0xx}} tokens in CLOSE_RETIRED).
  const existingByTitle = DRY_RUN ? new Map() : listExistingIssuesByTitle()
  log(`found ${existingByTitle.size} existing issue(s)`)

  log('— creating new tool epics (TL-026–TL-045) —')
  toolIssueNumbers = createNewToolEpics(existingByTitle)

  log('— closing retired/consolidated issues —')
  closeRetiredIssues()

  log('— commenting on TL-020 (consolidation note) —')
  commentOnly()

  log('done. Next step: `node web/scripts/fetch-roadmap.mjs` to refresh the site snapshot.')
}

main()
