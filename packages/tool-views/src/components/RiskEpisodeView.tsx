import { useMemo, useState } from 'react'
import { usePatient } from '../context/PatientContext'
import { makeId } from '@spier/core/lib/id'
import {
  buildEpisode,
  buildFlag,
  clearFlag,
  closeEpisode,
  episodeCurrentTier,
  findOpenEpisode,
  pickEpisodeTrigger,
  CLOSURE_REASONS,
  ENTRY_REASONS,
  RISK_TIERS,
} from '@spier/core/lib/riskEpisode'
import { displayFor } from '@spier/core/lib/codedOption'
import { WorkflowForm, WorkflowField, WorkflowHint } from './WorkflowForm'
import { useRecorderNotice } from '../lib/useRecorderNotice'
import { todayLocalIso } from '../lib/dates'
import { Button } from '@spier/ui/Button'

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

export function RiskEpisodeView() {
  const { addArtifact, activePatientId, episodes, flags, observations, responses } = usePatient()
  // ⚠️ **The success notice's "Open the risk registry" link is gone (2026-09-21).**
  // Opening an episode left a clinician with three places to go — the registry,
  // the chart, and whatever the pathway owed next — which is clinical-app audit
  // §1.5 inside one notice. The beat now offers ONE next action and one way
  // back (`NextStep`), and the caseload is reached from the chrome.

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
  const [startDate, setStartDate] = useState(todayLocalIso())
  const [closureReason, setClosureReason] = useState(CLOSURE_REASONS[0].code)
  const [endDate, setEndDate] = useState(todayLocalIso())
  const { notice, written, report } = useRecorderNotice()
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
      return activeFlag ? [closed, clearFlag(activeFlag, endDate)] : [closed]
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
    const episode = buildEpisode({
      id,
      patientId: activePatientId,
      entryReason,
      currentTier,
      startDate,
      triggerRef: requiresTrigger ? triggerRef : undefined,
    })
    const flag = buildFlag({ id: `flag-${id}`, patientId: activePatientId, startDate })
    addArtifact(episode)
    addArtifact(flag)
    report('Episode opened and chart banner raised.', episode, flag)
  }

  function handleClose(e: React.FormEvent) {
    e.preventDefault()
    if (!openEpisode) return
    const closed = closeEpisode(openEpisode, { closureReason, endDate })
    addArtifact(closed)
    // Clear the banner in the same action — a flag outliving its episode is
    // the failure mode this recorder exists to prevent.
    const cleared = activeFlag ? clearFlag(activeFlag, endDate) : null
    if (cleared) addArtifact(cleared)
    report('Episode closed and chart banner cleared.', ...[closed, cleared].filter(r => r !== null))
  }

  const tier = episodeCurrentTier(openEpisode)

  return (
    <WorkflowForm
      title="Suicide-Risk Episode / Pathway Status"
      lede={
        <>
          Opens or closes a suicide-safer care episode under{' '}
          <strong>Track Risk Over Time</strong>, raising or clearing the chart banner with it. The
          episode is what safety tasks attach to and what the risk registry lists.
        </>
      }
      fhirNote={
        <>
          Writes an <strong>EpisodeOfCare</strong> and its <strong>Flag</strong> banner as one act,
          so a banner cannot outlive the episode it announces. A patient may have several episodes
          over time but only one open at once, which is why this view is modal rather than
          validated. A <code>positive-screen</code> entry carries a profile invariant requiring the
          episode to name the artifact that evidenced it (#263) — hence the required{' '}
          <code>episode-trigger</code> reference.
        </>
      }
      draft={draft}
      draftTitle={openEpisode ? 'Live FHIR (close episode)' : 'Live FHIR (open episode + flag)'}
      notice={notice}
      justRecorded={written}
    >
      {openEpisode ? (
        <>
          <WorkflowHint>
            <strong>Episode open</strong> since{' '}
            {(openEpisode as { period?: { start?: string } }).period?.start ?? 'unknown'}
            {tier ? ` · current tier: ${displayFor(RISK_TIERS, tier)}` : ''}. Only one episode can
            be open at a time, so close this one before opening another.
          </WorkflowHint>
          <form className="workflow-form" onSubmit={handleClose}>
            <WorkflowField label="Closure reason">
              <select
                className="workflow-input"
                value={closureReason}
                onChange={e => setClosureReason(e.target.value)}
              >
                {CLOSURE_REASONS.map(r => (
                  <option key={r.code} value={r.code}>{r.display}</option>
                ))}
              </select>
            </WorkflowField>
            <WorkflowField label="Closure date">
              <input
                type="date"
                className="workflow-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </WorkflowField>
            <Button type="submit">Close episode</Button>
          </form>
        </>
      ) : (
        <form className="workflow-form" onSubmit={handleOpen}>
          <WorkflowField label="Reason for entry">
            <select
              className="workflow-input"
              value={entryReason}
              onChange={e => setEntryReason(e.target.value)}
            >
              {ENTRY_REASONS.map(r => (
                <option key={r.code} value={r.code}>{r.display}</option>
              ))}
            </select>
          </WorkflowField>
          {requiresTrigger && (
            <WorkflowField
              label="Screening artifact that evidenced it"
              help={
                <>
                  A positive screen has to name the screen that found it. Pick another reason for
                  entry if none is on file.
                </>
              }
            >
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
            </WorkflowField>
          )}
          <WorkflowField label="Current risk tier">
            <select
              className="workflow-input"
              value={currentTier}
              onChange={e => setCurrentTier(e.target.value)}
            >
              {RISK_TIERS.map(t => (
                <option key={t.code} value={t.code}>{t.display}</option>
              ))}
            </select>
          </WorkflowField>
          <WorkflowField label="Episode start date">
            <input
              type="date"
              className="workflow-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </WorkflowField>
          <Button type="submit" disabled={triggerMissing}>Open episode</Button>
          {triggerMissing && (
            <p className="workflow-field-help">
              {triggerCandidates.length === 0
                ? 'This patient has no screening result on file, so a positive screen cannot be evidenced. Choose a different reason for entry.'
                : 'Select the screening artifact before opening the episode.'}
            </p>
          )}
        </form>
      )}
    </WorkflowForm>
  )
}
