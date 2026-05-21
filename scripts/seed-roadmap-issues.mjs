#!/usr/bin/env node
// Idempotent seed script — creates the GitHub label taxonomy and the initial
// tracking issues for the SPiER roadmap.
//
// Usage:
//   node scripts/seed-roadmap-issues.mjs           # uses local `gh` auth
//   node scripts/seed-roadmap-issues.mjs --dry-run # print what would happen
//
// Safe to re-run: existing labels and issues (matched by name / title-prefix)
// are skipped, not duplicated.
//
// After seeding, run `node web/scripts/fetch-roadmap.mjs` to snapshot the
// issues into web/src/data/roadmap.generated.json for the site to render.

import { spawnSync } from 'node:child_process'

const DRY_RUN = process.argv.includes('--dry-run')
const REPO = process.env.SPIER_ROADMAP_REPO ?? 'bbthorson/SPiER'

function log(msg) {
  console.log(`[seed-roadmap] ${msg}`)
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
// Label definitions
// Colors are GitHub hex (no leading #).
// ─────────────────────────────────────────────────────────────

const LABELS = [
  // Statuses
  { name: 'status:built', color: '0e8a16', description: 'Tool exists in the app; refinements may still be open' },
  { name: 'status:planned', color: 'fbca04', description: 'Tool is scoped and queued for build' },
  { name: 'status:future', color: 'd4c5f9', description: 'Tool is recognized but deferred; lower priority' },

  // Types
  { name: 'type:epic', color: '5319e7', description: 'Top-level tracking issue (e.g. one per tool)' },
  { name: 'type:task', color: 'c2e0c6', description: 'Concrete piece of work under an epic' },

  // Cross-cutting priorities (mirrors the three roadmap priorities)
  { name: 'priority:p1', color: 'b60205', description: 'P1 — Translate tools to FHIR objects' },
  { name: 'priority:p2', color: 'd93f0b', description: 'P2 — Use LOINC / SNOMED codes' },
  { name: 'priority:p3', color: 'e99695', description: 'P3 — Automations & CDS hooks between stages' },

  // Pathway stages
  { name: 'stage:flag-risk', color: 'bfdadc', description: 'Stage 1 — Flag Risk' },
  { name: 'stage:clarify-risk', color: 'bfdadc', description: 'Stage 2 — Clarify Risk' },
  { name: 'stage:set-risk-status', color: 'bfdadc', description: 'Stage 3 — Set Risk Status' },
  { name: 'stage:document-safety-actions', color: 'bfdadc', description: 'Stage 4 — Document Safety Actions' },
  { name: 'stage:coordinate-handoffs', color: 'bfdadc', description: 'Stage 5 — Coordinate Handoffs' },
  { name: 'stage:track-follow-up', color: 'bfdadc', description: 'Stage 6 — Track Follow-Up' },
  { name: 'stage:manage-active-risk', color: 'bfdadc', description: 'Stage 7 — Manage Active Risk' },
  { name: 'stage:measure-and-share', color: 'bfdadc', description: 'Stage 8 — Measure and Share' },

  // Cross-cutting areas
  { name: 'area:patient-view', color: '1d76db', description: 'Patient chart / clinical view' },
  { name: 'area:population-view', color: '1d76db', description: 'Population / registry view' },
  { name: 'area:catalog', color: '1d76db', description: 'Tool catalog, stages, triggers' },
  { name: 'area:ig', color: '1d76db', description: 'Implementation Guide (FSH, IG Publisher)' },
]

// Tool labels (one per TL-XXX) are generated programmatically from TOOLS below.

// ─────────────────────────────────────────────────────────────
// Tool roster — mirrors the existing PLANS map in web/src/pages/Roadmap.tsx
// and the FHIR-Resources/<tool>/ + ig/input/fsh/<tool>.fsh layout.
//
// `nextStep` is migrated verbatim from PLANS.
// ─────────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'TL-001', name: 'Ask Suicide-Screening Questions', shortName: 'ASQ', stage: 'flag-risk', status: 'built',
    nextStep: 'LOINC coding on the result Observation and a published ActivityDefinition.' },
  { id: 'TL-002', name: 'Patient Health Questionnaire-9', shortName: 'PHQ-9', stage: 'flag-risk', status: 'built',
    nextStep: 'LOINC item codes for each PHQ-9 question and CDS trigger on Item 9 ≥ 1.' },
  { id: 'TL-003', name: 'C-SSRS Screener', shortName: 'C-SSRS Screener', stage: 'flag-risk', status: 'built',
    nextStep: 'Publish ActivityDefinition; add SNOMED CT for severity outcomes.' },
  { id: 'TL-004', name: 'C-SSRS Full (Lifetime/Recent)', shortName: 'C-SSRS Full', stage: 'clarify-risk', status: 'built',
    nextStep: 'Long-form item-level LOINC codes and risk-history-derived Condition extraction.' },
  { id: 'TL-005', name: 'NIMH Brief Suicide Safety Assessment', shortName: 'BSSA', stage: 'clarify-risk', status: 'planned',
    nextStep: 'BSSA Questionnaire JSON and CarePlan generation from the disposition decision tree.' },
  { id: 'TL-006', name: 'SAFE-T', shortName: 'SAFE-T', stage: 'set-risk-status', status: 'planned',
    nextStep: 'SAFE-T as a structured decision-support form; ties to risk-status Observation.' },
  { id: 'TL-007', name: 'Stanley-Brown Safety Plan', shortName: 'Stanley-Brown', stage: 'document-safety-actions', status: 'built',
    nextStep: 'CarePlan transformation formalized as a defined PlanDefinition.action.transform.' },
  { id: 'TL-008', name: 'Means Safety Counseling', shortName: 'Means Counseling', stage: 'document-safety-actions', status: 'planned',
    nextStep: 'Means counseling Questionnaire + Procedure resource generation per CALM model.' },
  { id: 'TL-009', name: 'Transition Checkpoint', shortName: 'Transition', stage: 'coordinate-handoffs', status: 'planned',
    nextStep: 'Transition Questionnaire + ServiceRequest/Task resources for inter-setting handoff.' },
  { id: 'TL-010', name: 'Outreach / Caring Contacts', shortName: 'Caring Contacts', stage: 'track-follow-up', status: 'planned',
    nextStep: 'Caring Contacts Questionnaire + scheduled Task resources for 7/30-day follow-up.' },
  { id: 'TL-011', name: 'Patient Safety Screener-3', shortName: 'PSS-3', stage: 'flag-risk', status: 'planned',
    nextStep: 'Questionnaire JSON, response-to-Observation mapper, route wiring. Public domain instrument.' },
  { id: 'TL-012', name: 'ED-SAFE / CLASP-ED Follow-up', shortName: 'ED-SAFE', stage: 'track-follow-up', status: 'planned',
    nextStep: 'ED-SAFE telephone-follow-up workflow modeled as CommunicationRequest + Communication resources.' },
  { id: 'TL-013', name: 'Now Matters Now', shortName: 'Now Matters Now', stage: 'document-safety-actions', status: 'planned',
    nextStep: 'Now Matters Now integration (external resource library) plus CarePlan link-out.' },
  { id: 'TL-014', name: 'Patient Safety Screener / Suicide Risk Screener (Full)', shortName: 'PSS Full', stage: 'flag-risk', status: 'future',
    nextStep: 'Lower-priority; PSS-3 covers most flag-risk needs. Build only if requested by an adopter.' },
  { id: 'TL-015', name: 'Crisis Response Planning', shortName: 'CRP', stage: 'document-safety-actions', status: 'future',
    nextStep: 'CRP requires licensure and a video-mediated workflow; defer until partner request.' },
  { id: 'TL-016', name: 'CALM / Means Safety Counseling Protocol', shortName: 'CALM', stage: 'document-safety-actions', status: 'future',
    nextStep: 'CALM training assets needed; provider-side workflow rather than patient-facing form.' },
  { id: 'TL-017', name: 'Rapid Referral to Outpatient Behavioral Healthcare', shortName: 'Rapid Referral', stage: 'coordinate-handoffs', status: 'future',
    nextStep: 'Rapid-referral logic depends on having receiving-system FHIR endpoints; defer.' },
  { id: 'TL-018', name: 'Colorado Post-Visit Protocol', shortName: 'CO Post-Visit', stage: 'track-follow-up', status: 'future',
    nextStep: 'Post-visit survey instrument; lower priority than active-risk tooling.' },
  { id: 'TL-019', name: 'C-SSRS Since Last Contact', shortName: 'C-SSRS Since Last', stage: 'clarify-risk', status: 'planned',
    nextStep: 'Questionnaire JSON for the since-last-contact form, mapping to a tracking Observation.' },
  { id: 'TL-020', name: 'CAMS SSF-5 (Section A/B)', shortName: 'CAMS SSF-5', stage: 'clarify-risk', status: 'built',
    nextStep: 'Built (Sections A/B). Next: link Section B drivers to FHIR Condition resources for problem-list tracking.' },
  { id: 'TL-021', name: 'CAMS Stabilization Plan', shortName: 'CAMS Stabilization', stage: 'document-safety-actions', status: 'built',
    nextStep: 'Surface stabilization activities as discrete CarePlan.activity entries with codes.' },
  { id: 'TL-022', name: 'CAMS Interim Session', shortName: 'CAMS Interim', stage: 'manage-active-risk', status: 'built',
    nextStep: 'Link CAMS interim sessions to the parent CAMS Encounter and update active-episode state.' },
  { id: 'TL-023', name: 'CAMS SSF-5 Outcome / Disposition Final Session', shortName: 'CAMS Outcome', stage: 'coordinate-handoffs', status: 'planned',
    nextStep: 'CAMS outcome form; outputs an Observation describing pathway resolution.' },
  { id: 'TL-024', name: 'CAMS Therapeutic Worksheet', shortName: 'CAMS Worksheet', stage: 'manage-active-risk', status: 'built',
    nextStep: 'Longitudinal SSF vital tracking via repeated Observations with consistent LOINC codes.' },
  { id: 'TL-025', name: 'Suicide Behaviors Questionnaire-Revised', shortName: 'SBQ-R', stage: 'flag-risk', status: 'built',
    nextStep: 'LOINC mapping for total score and clinical-cutoff Observation.' },
]

// ─────────────────────────────────────────────────────────────
// Cross-cutting priority epics
// ─────────────────────────────────────────────────────────────

const PRIORITY_EPICS = [
  {
    key: 'p1',
    title: '[P1] Translate tools to FHIR objects',
    body: [
      'Cross-cutting roadmap priority #1.',
      '',
      'Today the catalog (`Tool`, `Stage`, `Trigger`, `Preset`) lives as bespoke TypeScript interfaces. To be a real reference implementation rather than just a demo, the catalog needs to be FHIR-shaped:',
      '',
      '- `Tool` → **ActivityDefinition** (referencing the Questionnaire)',
      '- `Stage` + pathway → **PlanDefinition** with grouped actions',
      '- `Trigger` → **PlanDefinition.action.trigger** (TriggerDefinition)',
      '- `Preset` / user tool-config → a custom **PlanDefinition** that selects a subset of the canonical pathway\'s actions',
      '- **Licensing & usage requirements per tool** — capture each instrument\'s licensing status using `ActivityDefinition.copyright`, `copyrightLabel`, and related fields.',
      '',
      'Payoff: a configured implementation can be exported as a FHIR Bundle and handed to another EHR. SPiER stops modeling interop and starts demonstrating it.',
    ].join('\n'),
    labels: ['type:epic', 'priority:p1', 'area:catalog', 'area:ig'],
  },
  {
    key: 'p2',
    title: '[P2] Use LOINC / SNOMED codes where available',
    body: [
      'Cross-cutting roadmap priority #2. Precondition: P1 (FHIR shapes) is far enough along that there are concrete elements to code.',
      '',
      'Once tools are FHIR shapes, every coded element should reference a standard terminology rather than a local string:',
      '',
      '- Questionnaire item codes → LOINC where published (e.g. PHQ-9 individual items, ASQ result, C-SSRS items)',
      '- Observation codes → LOINC for survey results, vitals-style measures (CAMS SSF psychological pain, etc.)',
      '- Condition / Problem codes → SNOMED CT (suicidal ideation, suicide attempt, self-harm, depression)',
      '- Procedure / intervention codes → SNOMED or CPT (safety planning, means counseling, follow-up)',
      '',
      'Where no published LOINC exists (e.g. CAMS SSF measures), document the local code system clearly so a receiving system knows what to map.',
    ].join('\n'),
    labels: ['type:epic', 'priority:p2', 'area:catalog', 'area:ig'],
  },
  {
    key: 'p3',
    title: '[P3] Automations & CDS hooks between stages',
    body: [
      'Cross-cutting roadmap priority #3. Precondition: P2 (coding) is far enough along that triggers can reference real codes.',
      '',
      'With structured, coded tools in place, the workflow logic between stages becomes machine-readable:',
      '',
      '- **Triggers between stages** — e.g. PHQ-9 Item 9 ≥ 1 fires the Flag Risk → Clarify Risk transition, modeled as `PlanDefinition.action.trigger`.',
      '- **CDS Hooks integration** — expose risk-elevating events (`patient-view`, `order-sign`) so an EHR can call out to a SPiER service and receive cards recommending the next stage\'s tool.',
      '- **Care-plan auto-generation** — completion of a Stabilization or Stanley-Brown questionnaire writes a derived `CarePlan` resource automatically (already partially implemented; formalize as a defined transformation).',
    ].join('\n'),
    labels: ['type:epic', 'priority:p3', 'area:catalog', 'area:ig'],
  },
]

// ─────────────────────────────────────────────────────────────
// Label management
// ─────────────────────────────────────────────────────────────

function ensureLabel({ name, color, description }) {
  // `gh label create` errors if the label already exists; use --force to
  // update in place (idempotent for color/description tweaks).
  const args = [
    'label', 'create', name,
    '--repo', REPO,
    '--color', color,
    '--description', description ?? '',
    '--force',
  ]
  const r = gh(args)
  if (!r.ok) {
    log(`label create FAILED for ${name}: ${r.stderr?.trim() ?? '(no stderr)'}`)
    return false
  }
  log(`label ensured: ${name}`)
  return true
}

function ensureToolLabels() {
  for (const t of TOOLS) {
    ensureLabel({
      name: `tool:${t.id}`,
      color: 'fef2c0',
      description: `${t.shortName ?? t.name} (${t.stage})`,
    })
  }
}

function ensureStandardLabels() {
  for (const l of LABELS) ensureLabel(l)
}

// ─────────────────────────────────────────────────────────────
// Issue management
// ─────────────────────────────────────────────────────────────

function listExistingIssueTitles() {
  // Pull all issues (open + closed) so re-runs don't double-create.
  const r = gh(['issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '500', '--json', 'title'])
  if (!r.ok) {
    log(`could not list existing issues: ${r.stderr?.trim() ?? '(no stderr)'}`)
    return new Set()
  }
  try {
    const arr = JSON.parse(r.stdout || '[]')
    return new Set(arr.map((x) => x.title))
  } catch {
    return new Set()
  }
}

function createIssue({ title, body, labels }) {
  const args = ['issue', 'create', '--repo', REPO, '--title', title, '--body', body]
  for (const l of labels) {
    args.push('--label', l)
  }
  const r = gh(args)
  if (!r.ok) {
    log(`issue create FAILED for "${title}": ${r.stderr?.trim() ?? '(no stderr)'}`)
    return false
  }
  log(`issue created: ${title}`)
  return true
}

function toolEpicTitle(t) {
  return `[${t.id}] ${t.shortName ?? t.name}`
}

function toolEpicBody(t) {
  return [
    `**Tool:** ${t.name}${t.shortName && t.shortName !== t.name ? ` (${t.shortName})` : ''}`,
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
    'Sourced from `web/src/pages/Roadmap.tsx` `PLANS` map during the 2026-05 GitHub Issues migration.',
  ].join('\n')
}

function seedToolEpics(existingTitles) {
  for (const t of TOOLS) {
    const title = toolEpicTitle(t)
    if (existingTitles.has(title)) {
      log(`skipping (already exists): ${title}`)
      continue
    }
    createIssue({
      title,
      body: toolEpicBody(t),
      labels: ['type:epic', `tool:${t.id}`, `stage:${t.stage}`, `status:${t.status}`],
    })
  }
}

function seedPriorityEpics(existingTitles) {
  for (const p of PRIORITY_EPICS) {
    if (existingTitles.has(p.title)) {
      log(`skipping (already exists): ${p.title}`)
      continue
    }
    createIssue({ title: p.title, body: p.body, labels: p.labels })
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

function main() {
  if (DRY_RUN) log('DRY RUN — no GitHub calls will be made')
  log(`target repo: ${REPO}`)

  log('— ensuring standard labels —')
  ensureStandardLabels()

  log('— ensuring per-tool labels —')
  ensureToolLabels()

  const existing = DRY_RUN ? new Set() : listExistingIssueTitles()
  log(`found ${existing.size} existing issue(s)`)

  log('— seeding tool epics —')
  seedToolEpics(existing)

  log('— seeding priority epics —')
  seedPriorityEpics(existing)

  log('done. Next step: `node web/scripts/fetch-roadmap.mjs` to snapshot issues into the site.')
}

main()
