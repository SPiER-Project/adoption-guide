/**
 * "Where this patient is" — the eight-stage rail, on its own route.
 *
 * ── Why a page ────────────────────────────────────────────────────────────
 *
 * Clinical-app audit §4.3. The rail answers a good question, and it is not the
 * question a clinician launched into a chart is holding: PR 4 made the landing
 * screen answer *what do I do for this patient now* and left the rail sitting
 * under it, where it was still the longest thing on the screen. It is one tap
 * away instead, reached from the landing screen's *Where this patient is · Step
 * N of 8* link and from nowhere else.
 *
 * ⚠️ **No patient in the path, like `/patient/why` and `/patient/pathway/:stageId`
 * beside it.** The active patient persists across non-chart routes through
 * `PatientContext`; putting the id in the URL here would be a second place for
 * it to be right or wrong.
 *
 * ⚠️ **It decides nothing about what is due.** The "N due" counts come from the
 * same `evaluatePathway` the landing screen renders, keyed by the stage each
 * obligation sits at — not from the cards on the rail, which are guidance
 * (§4.5's own rule) and would have marked a finished stage outstanding.
 *
 * ⚠️ **The header is a title and nothing else since 2026-09-22.** It carried
 * "Now at step 2 of 8 — Clarify Risk · 1 of 8 stages with activity · 1
 * recommended action": three clauses, each of which a row below already states
 * in a pill — *You are here*, *Complete*, *1 due* — and two of which are
 * counted in a stage vocabulary a clinician has no reason to know. A summary
 * whose every fact is visible under it is a second thing to read, not a
 * shortcut past the reading.
 */
import { useMemo } from 'react'
import { PageHeader } from '@spier/ui/PageHeader'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { buildCdsCards, isPathwayObligationCard } from '@spier/core/lib/cdsHooks'
import { evaluatePathway } from '@spier/core/lib/pathwayEvaluation'
import {
  derivePathwayStatus,
  groupArtifactsByStage,
} from '@spier/core/lib/patientPathway'
import { workflowArtifactsOf } from '@spier/core/lib/registry'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { useToolConfig } from '../context/ToolConfigContext'
import { toolEnablementFor } from '../lib/toolEnablement'
import { PatientPathway } from '../components/PatientPathway'
import '../css/PatientChart.css'

export function PatientWhere() {
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
  } = usePatient()
  const { isToolEnabled: siteToolEnabled } = useToolConfig()
  const { chromeMode } = usePresentation()
  const isToolEnabled = useMemo(
    () => toolEnablementFor(chromeMode, siteToolEnabled),
    [chromeMode, siteToolEnabled],
  )

  const workflowArtifacts = useMemo(
    () => workflowArtifactsOf({ documentReferences, serviceRequests, appointments, consents, procedures }),
    [documentReferences, serviceRequests, appointments, consents, procedures],
  )
  const artifacts = useMemo(
    () => ({ responses, carePlans, observations, communications, workflowArtifacts }),
    [responses, carePlans, observations, communications, workflowArtifacts],
  )
  const { statuses } = useMemo(() => derivePathwayStatus(artifacts), [artifacts])
  const stageGroups = useMemo(() => groupArtifactsByStage(artifacts), [artifacts])

  const record = useMemo(
    () => ({ responses, observations, carePlans, communications, procedures, episodes, riskAlerts }),
    [responses, observations, carePlans, communications, procedures, episodes, riskAlerts],
  )
  const evaluation = useMemo(() => evaluatePathway(record), [record])
  // Guidance only, for the same reason the chart keeps it that way: the
  // pathway's obligations belong to the landing screen, and drawing them here
  // as well is the "three answers to what do I do" defect one layer down.
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

  return (
    <div className="patient-where">
      <PageHeader
        eyebrow="Patient Chart"
        up="/patient/record"
        eyebrowStyle="pill"
        title="Where this patient is"
      />

      <PatientPathway
        stageGroups={stageGroups}
        statuses={statuses}
        cards={guidanceCards}
        dueByStage={dueByStage}
      />
    </div>
  )
}
