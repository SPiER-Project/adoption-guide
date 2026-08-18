import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { CodeDrawer } from './CodeDrawer'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from './PageHeader'
import { makeId } from '../lib/id'
import {
  buildEpisode,
  buildFlag,
  clearFlag,
  closeEpisode,
  displayFor,
  episodeCurrentTier,
  findOpenEpisode,
  pickEpisodeTrigger,
  CLOSURE_REASONS,
  ENTRY_REASONS,
  RISK_TIERS,
} from '../lib/riskEpisode'
import type { FlagResource } from '../types/fhir'
import '../css/WorkflowActionView.css'

/**
 * TL-038 — open and close a suicide-safer care episode (Stage 7).
 *
 * The episode is the anchor of Track Risk Over Time: safety tasks attach to it
 * and the registry work queue is a query over open ones. Opening also raises
 * the chart-banner Flag; closing clears it, so the banner can't outlive the
 * episode it announces.
 *
 * Per the Stage-7 design decision, a patient may have SEVERAL episodes over
 * time but only ONE open at a time — so this view is modal: it offers "open"
 * only when nothing is open, and "close" otherwise. That makes the constraint
 * structural rather than a validation message.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server.
 */

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function RiskEpisodeView() {
  const { addArtifact, activePatientId, episodes, flags, observations, responses } = usePatient()

  const openEpisode = useMemo(() => findOpenEpisode(episodes), [episodes])
  const activeFlag = useMemo(
    () => flags.find(f => (f as { status?: string }).status === 'active'),
    [flags],
  )

  // Candidate triggers for a positive-screen entry: the patient's screening
  // Observations, most recent first. `positive-screen` carries a profile
  // invariant requiring the episode to name the artifact that evidenced it
  // (#263), and this dropdown is the default option — so before phase 4 the
  // recorder produced a non-conformant episode on every unmodified submit.
  const triggerCandidates = useMemo(
    () =>
      [...observations]
        .reverse()
        .filter(o => typeof o.id === 'string')
        .map(o => ({
          ref: `Observation/${o.id}`,
          label:
            (o as { code?: { text?: string; coding?: { display?: string }[] } }).code?.text ??
            (o as { code?: { coding?: { display?: string }[] } }).code?.coding?.[0]?.display ??
            String(o.id),
        })),
    [observations],
  )

  const [entryReason, setEntryReason] = useState(ENTRY_REASONS[0].code)
  const [currentTier, setCurrentTier] = useState('moderate')
  const [startDate, setStartDate] = useState(todayIso())
  const [closureReason, setClosureReason] = useState(CLOSURE_REASONS[0].code)
  const [endDate, setEndDate] = useState(todayIso())
  const [notice, setNotice] = useState<string | null>(null)
  // Default to whatever the concept layer would pick, so the common case is
  // one click rather than a required decision.
  const [triggerRef, setTriggerRef] = useState<string>(
    () => pickEpisodeTrigger(observations, responses[responses.length - 1]?.id) ?? '',
  )

  const requiresTrigger = entryReason === 'positive-screen'
  const triggerMissing = requiresTrigger && !triggerRef

  // Live preview of what will be written: the episode plus, on open, its flag.
  const draft = useMemo(() => {
    if (openEpisode) {
      const closed = closeEpisode(openEpisode, { closureReason, endDate })
      return activeFlag ? [closed, clearFlag(activeFlag as FlagResource, endDate)] : [closed]
    }
    const id = 'episode-preview'
    return [
      buildEpisode({
        id,
        patientId: activePatientId,
        entryReason,
        currentTier,
        startDate,
        triggerRef: requiresTrigger ? triggerRef || undefined : undefined,
      }),
      buildFlag({ id: `flag-${id}`, patientId: activePatientId, startDate }),
    ]
  }, [openEpisode, activeFlag, closureReason, endDate, entryReason, currentTier, startDate, activePatientId, requiresTrigger, triggerRef])

  function handleOpen(e: React.FormEvent) {
    e.preventDefault()
    if (triggerMissing) return
    const id = `episode-${makeId()}`
    addArtifact(
      buildEpisode({
        id,
        patientId: activePatientId,
        entryReason,
        currentTier,
        startDate,
        triggerRef: requiresTrigger ? triggerRef : undefined,
      }),
    )
    addArtifact(buildFlag({ id: `flag-${id}`, patientId: activePatientId, startDate }))
    setNotice('Episode opened and chart banner raised.')
  }

  function handleClose(e: React.FormEvent) {
    e.preventDefault()
    if (!openEpisode) return
    addArtifact(closeEpisode(openEpisode, { closureReason, endDate }))
    // Clear the banner in the same action — a flag outliving its episode is
    // the failure mode this recorder exists to prevent.
    if (activeFlag) addArtifact(clearFlag(activeFlag as FlagResource, endDate))
    setNotice('Episode closed and chart banner cleared.')
  }

  const tier = episodeCurrentTier(openEpisode)

  return (
    <div className="form-view">
      <PageHeader
        eyebrow={['Patient View', 'Workflow']}
        up="/patient/chart"
        title="Suicide-Risk Episode / Pathway Status"
        lede={
          <>
            Records an <strong>EpisodeOfCare</strong> plus its <strong>Flag</strong> chart banner,
            tagged to the <strong>Track Risk Over Time</strong> stage. The episode is the anchor
            safety tasks attach to.
          </>
        }
      />

      <div className="form-wrapper">
        <div className="form-card">
          {activePatientId === null && (
            <p className="workflow-form-hint">
              No patient selected — this will be recorded in the scratch chart. Pick a patient from
              the Population view to attach it to a specific record.
            </p>
          )}

          {openEpisode ? (
            <>
              <p className="workflow-form-hint">
                <strong>Episode open</strong> since{' '}
                {(openEpisode as { period?: { start?: string } }).period?.start ?? 'unknown'}
                {tier ? ` · current tier: ${displayFor(RISK_TIERS, tier)}` : ''}. Only one episode can
                be open at a time, so close this one before opening another.
              </p>
              <form className="workflow-form" onSubmit={handleClose}>
                <label className="workflow-field">
                  <span className="workflow-field-label">Closure reason</span>
                  <select
                    className="workflow-input"
                    value={closureReason}
                    onChange={e => setClosureReason(e.target.value)}
                  >
                    {CLOSURE_REASONS.map(r => (
                      <option key={r.code} value={r.code}>{r.display}</option>
                    ))}
                  </select>
                </label>
                <label className="workflow-field">
                  <span className="workflow-field-label">Closure date</span>
                  <input
                    type="date"
                    className="workflow-input"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </label>
                <button type="submit" className="workflow-submit-btn">Close episode</button>
              </form>
            </>
          ) : (
            <form className="workflow-form" onSubmit={handleOpen}>
              <label className="workflow-field">
                <span className="workflow-field-label">Reason for entry</span>
                <select
                  className="workflow-input"
                  value={entryReason}
                  onChange={e => setEntryReason(e.target.value)}
                >
                  {ENTRY_REASONS.map(r => (
                    <option key={r.code} value={r.code}>{r.display}</option>
                  ))}
                </select>
              </label>
              {requiresTrigger && (
                <label className="workflow-field">
                  <span className="workflow-field-label">Screening artifact that evidenced it</span>
                  <select
                    className="workflow-input"
                    value={triggerRef}
                    onChange={e => setTriggerRef(e.target.value)}
                  >
                    <option value="">— select the screen —</option>
                    {triggerCandidates.map(c => (
                      <option key={c.ref} value={c.ref}>{c.label}</option>
                    ))}
                  </select>
                  <span className="workflow-field-help">
                    A positive-screen entry SHALL name the artifact that evidenced it
                    (<code>episode-trigger</code>). Pick another reason if no screen is on file.
                  </span>
                </label>
              )}
              <label className="workflow-field">
                <span className="workflow-field-label">Current risk tier</span>
                <select
                  className="workflow-input"
                  value={currentTier}
                  onChange={e => setCurrentTier(e.target.value)}
                >
                  {RISK_TIERS.map(t => (
                    <option key={t.code} value={t.code}>{t.display}</option>
                  ))}
                </select>
              </label>
              <label className="workflow-field">
                <span className="workflow-field-label">Episode start date</span>
                <input
                  type="date"
                  className="workflow-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </label>
              <button type="submit" className="workflow-submit-btn" disabled={triggerMissing}>
                Open episode
              </button>
              {triggerMissing && (
                <p className="workflow-field-help">
                  {triggerCandidates.length === 0
                    ? 'This patient has no screening Observation on file, so a positive screen cannot be evidenced. Choose a different reason for entry.'
                    : 'Select the screening artifact before opening the episode.'}
                </p>
              )}
            </form>
          )}

          {notice && (
            <div className="workflow-success-notice">
              {notice} <Link to="/patient/chart#activity">View in chart</Link>
              {' · '}
              <Link to="/population">Open the risk registry</Link>
            </div>
          )}
        </div>

        <CodeDrawer>
          <FhirJsonViewer
            data={draft}
            title={openEpisode ? 'Live FHIR (close episode)' : 'Live FHIR (open episode + flag)'}
            defaultOpen
          />
        </CodeDrawer>
      </div>
    </div>
  )
}
