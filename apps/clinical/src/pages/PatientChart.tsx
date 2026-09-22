import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { useToolConfig } from '../context/ToolConfigContext'
import { PageHeader } from '@spier/ui/PageHeader'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { NextAction } from '../components/NextAction'
import { PatientPathway } from '../components/PatientPathway'
import { WritebackScorecard } from '../components/WritebackScorecard'
import { toolEnablementFor } from '../lib/toolEnablement'
import { buildCdsCards, isPathwayObligationCard } from '@spier/core/lib/cdsHooks'
import { derivePathwayStatus, groupArtifactsByStage } from '@spier/core/lib/patientPathway'
import { workflowArtifactsOf } from '@spier/core/lib/registry'
import { evaluatePathway } from '@spier/core/lib/pathwayEvaluation'
// This page is where `PatientChart.css` is imported for the whole chart — the
// rail on `/patient/where` relies on that too rather than importing its own.
import '../css/PatientChart.css'
import { Notice } from '@spier/ui/Notice'

/**
 * The chart: the eight-stage pathway, opened at what this record owes.
 *
 * ── Two reversals, in six days, and the second is deliberate ───────────────
 *
 * The clinical-app audit (§4.1, §4.3) made this page ONE instruction and moved
 * the eight-stage list to `/patient/where`, a link away — the answer to "what do
 * I do" had been a card somewhere inside a list grouped by stage, and a reader
 * had to join the two. That fixed the joining by deleting one half of it.
 *
 * Brad, 2026-09-22: a clinician opening a chart wants both — *where is this
 * patient on the journey* and *what do I do about it* — and they are the same
 * screen when the act is rendered INSIDE the stage it satisfies. So the list is
 * the landing screen, the stage the pathway owes something at is open, and
 * `NextAction` is the first thing in it. `/patient/where` is gone; nothing
 * links to a page that is now the front door.
 *
 * ⚠️ **The recommendation is still what the PUBLISHED PATHWAY owes this
 * record** — not the active stage's lead tool, and not the patient's curated
 * `recommendedNextStep` (audit §1.5, decision §7.1). The same evaluator backs
 * `buildCdsCards`, so the chart, the embedded panel and the hosted CDS service
 * all answer the same question the same way. What changed is where the answer
 * is drawn, not how it is reached.
 *
 * ⚠️ **The header is drawn in BOTH chromes now** (Brad, 2026-09-22). The panel
 * suppressed it entirely, on the measurement that a page title between the
 * patient's name and the one thing to do was a third heading in a frame already
 * spending 28% of its height on chrome. Against that: a panel with no header at
 * all leaves a reader who has navigated into a stage or a form with nothing
 * saying where they are. `PageHeader.css` collapses it to a single line under
 * `.panel-shell`, so the cost is one line and the trail is the way back.
 */
export function PatientChart() {
  const {
    carePlans,
    responses,
    riskAlerts,
    observations,
    communications,
    documentReferences,
    serviceRequests,
    appointments,
    consents,
    procedures,
    episodes,
    activePatientId,
    isSmartConnected,
    isSliceLoading,
    dataSourceError,
    writebackReport,
  } = usePatient()
  const { isToolEnabled: siteToolEnabled } = useToolConfig()

  // Panel chrome changes one thing on this page now: every catalogued tool is
  // offered, which is the rule the CDS Hooks service applies, so the host's
  // cards and this screen agree about the patient. lib/toolEnablement has the
  // measured case.
  const { chromeMode } = usePresentation()
  const isToolEnabled = useMemo(
    () => toolEnablementFor(chromeMode, siteToolEnabled),
    [chromeMode, siteToolEnabled],
  )

  // Stage-5 artifacts all stage themselves through meta.tag, so they travel as
  // one bucket rather than a named field per resource type — see PatientArtifacts.
  const workflowArtifacts = useMemo(
    () => workflowArtifactsOf({ documentReferences, serviceRequests, appointments, consents, procedures }),
    [documentReferences, serviceRequests, appointments, consents, procedures],
  )
  const artifacts = useMemo(
    () => ({ responses, carePlans, observations, communications, workflowArtifacts }),
    [responses, carePlans, observations, communications, workflowArtifacts],
  )
  const hasData =
    responses.length > 0 ||
    carePlans.length > 0 ||
    observations.length > 0 ||
    communications.length > 0 ||
    workflowArtifacts.length > 0
  const { statuses } = useMemo(() => derivePathwayStatus(artifacts), [artifacts])
  const stageGroups = useMemo(() => groupArtifactsByStage(artifacts), [artifacts])

  const record = useMemo(
    () => ({ responses, observations, carePlans, communications, procedures, episodes, riskAlerts }),
    [responses, observations, carePlans, communications, procedures, episodes, riskAlerts],
  )
  const evaluation = useMemo(() => evaluatePathway(record), [record])

  // ⚠️ **Guidance only on the list.** The pathway's obligations are rendered
  // once, by `NextAction`, inside the stage they belong to; a card repeating one
  // of them a few pixels below would be the "three answers to what do I do"
  // defect (audit §1.5) rebuilt one layer down. A guidance card — the
  // problem-list prompt, say — is not an obligation and keeps its place on the
  // stage it targets.
  const guidanceCards = useMemo(
    () => buildCdsCards({ record, isToolEnabled }).filter(c => !isPathwayObligationCard(c)),
    [record, isToolEnabled],
  )

  // What is owed, per stage. A standing instruction counts: it is something the
  // protocol asks for at that stage whether or not any record can retire it.
  const dueByStage = useMemo(() => {
    const out: Record<string, number> = {}
    for (const o of [evaluation.primary, ...evaluation.alsoDue]) {
      if (!o) continue
      out[o.stageId] = (out[o.stageId] ?? 0) + 1
    }
    return out
  }, [evaluation])

  const recordCount =
    responses.length +
    carePlans.length +
    observations.length +
    (communications?.length ?? 0) +
    workflowArtifacts.length

  // Where the act is drawn. With nothing due it goes to the stage the patient is
  // AT, so "nothing is due" is stated somewhere a reader is already looking
  // rather than being the absence of a card.
  const actionStageId =
    evaluation.primary?.stageId ??
    stageGroups.find(g => statuses[g.stageId] === 'active')?.stageId ??
    stageGroups[0]?.stageId

  return (
    <div className="patient-chart">
      {/* ⚠️ **Drawn in BOTH chromes since 2026-09-22** — see the module header.
          `eyebrow` is the trail and `title` is where you are; every page below
          this one names it as its parent through `up`, so the header is the
          breadcrumb rather than a second component beside one. */}
      <PageHeader eyebrow="SPiER" title="Care pathway" />

      {dataSourceError && (
        <Notice tone="danger" title="EHR data error.">
          {dataSourceError}
        </Notice>
      )}

      {isSliceLoading && (
        <Notice tone="info">Loading chart data from the connected EHR…</Notice>
      )}

      {/* Sits with dataSourceError deliberately: both are SMART-session
          feedback, and a degraded writeback is the case where there is no error
          to show but still something the site needs to know (#350). */}
      <WritebackScorecard report={writebackReport} />

      {/* ⚠️ **Above the list, not inside it.** A chart with nothing on it is a
          fact a clinician needs before reading eight stages of "Upcoming" —
          and it is not the answer to "what do I do", which is why it says
          nothing about what to do. */}
      {!hasData && !isSliceLoading && !dataSourceError && (
        <Notice title="This chart is empty.">
          <p>
            {isSmartConnected
              ? 'No screening or safety records on the connected EHR for this patient yet. Anything recorded from here is written back.'
              : activePatientId === null
                ? 'Nothing is recorded for anyone yet — start from the open step below, or pick a patient from the Population view.'
                : 'Nothing recorded for this patient yet.'}
          </p>
        </Notice>
      )}

      <PatientPathway
        stageGroups={stageGroups}
        statuses={statuses}
        cards={guidanceCards}
        dueByStage={dueByStage}
        action={
          actionStageId
            ? {
                stageId: actionStageId,
                node: <NextAction evaluation={evaluation} isToolEnabled={isToolEnabled} />,
              }
            : undefined
        }
      />

      {/* The record itself, one tap away. It was a link on the landing card
          beside "Where this patient is"; that second link's destination IS this
          page now, so one is left. */}
      <p className="patient-chart__on-file">
        <Link to="/patient/on-file">What&rsquo;s on file</Link>
        <span className="patient-chart__fact">
          {recordCount} {recordCount === 1 ? 'record' : 'records'}
        </span>
      </p>
    </div>
  )
}
