import { useMemo } from 'react'
import { STAGES } from '@spier/core/data/catalog'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { useToolConfig } from '../context/ToolConfigContext'
import { PageHeader } from '@spier/ui/PageHeader'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { ChartLanding } from '../components/ChartLanding'
import { WritebackScorecard } from '../components/WritebackScorecard'
import { toolEnablementFor } from '../lib/toolEnablement'
import { derivePathwayStatus } from '@spier/core/lib/patientPathway'
import { workflowArtifactsOf } from '@spier/core/lib/registry'
import { evaluatePathway } from '@spier/core/lib/pathwayEvaluation'
// This page is where `PatientChart.css` is imported for the whole chart — the
// rail on `/patient/where` relies on that too rather than importing its own.
import '../css/PatientChart.css'
import { Notice } from '@spier/ui/Notice'

/**
 * The chart: one instruction, and two ways off it.
 *
 * ⚠️ **This page is the landing screen and nothing else since 2026-09-21.** It
 * used to compose the landing screen, the eight-stage rail and three record
 * sections — the rail and the record are pages now
 * (`PatientWhere.tsx`, `PatientOnFile.tsx`, clinical-app audit §4.3 and §4.4),
 * reached from the landing screen's two links. What is left here is the
 * evaluation the landing card renders, the two facts those links carry, and the
 * SMART-session feedback that belongs above everything.
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
  const inPanel = chromeMode === 'panel'
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
  // ⚠️ The recommendation is what the PUBLISHED PATHWAY owes this record — not
  // the active stage's lead tool, and not the patient's curated
  // `recommendedNextStep` (clinical-app audit §1.5, decision §7.1). The same
  // evaluator backs `buildCdsCards`, so the chart, the embedded panel and the
  // hosted service all answer the same question the same way.
  const record = useMemo(
    () => ({ responses, observations, carePlans, communications, procedures, episodes, riskAlerts }),
    [responses, observations, carePlans, communications, procedures, episodes, riskAlerts],
  )
  const evaluation = useMemo(() => evaluatePathway(record), [record])

  // The facts the landing screen's two links carry.
  const activeIndex = STAGES.findIndex(s => statuses[s.id] === 'active')
  const stepLabel =
    activeIndex >= 0 ? `Step ${activeIndex + 1} of ${STAGES.length}` : `All ${STAGES.length} steps passed`
  const recordCount =
    responses.length +
    carePlans.length +
    observations.length +
    (communications?.length ?? 0) +
    workflowArtifacts.length

  return (
    <div className="patient-chart">
      {/* ⚠️ **No page header at all in panel chrome, and that is the landing
          screen's whole claim.** The panel already carries the host's header
          and, above this, SPiER's own identity strip; a page title between the
          patient's name and the one thing to do for them is the third heading
          in a frame that was measured spending 28% of its height before the
          first question (PanelShell.tsx). In a standalone tab the page is
          browsed rather than launched into, so it keeps a title — and the
          patient banner LaunchShell draws above it is the landing screen's
          "who" line (audit §4.7), which is why nothing here draws a second. */}
      {!inPanel && <PageHeader eyebrow="SPiER" title="Patient Chart" />}

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

      {/* The landing screen: one instruction, and two ways off it. First on the
          page in both chromes, under the identity the chrome itself draws
          (audit §4.1, §4.7). */}
      <ChartLanding
        evaluation={evaluation}
        isToolEnabled={isToolEnabled}
        stepLabel={stepLabel}
        recordCount={recordCount}
      />

      {/* ⚠️ **Below the landing card since 2026-09-21, not above it.** The
          empty-chart notice stays — a chart with nothing on it is a fact a
          clinician needs — but it is not the answer to "what do I do", and it
          used to sit where the answer belongs. Its wording no longer says
          "below": the recommendation is now the first thing on the screen. */}
      {!hasData && !isSliceLoading && !dataSourceError && (
        <Notice title="This chart is empty.">
          <p>
            {isSmartConnected
              ? 'No screening or safety records on the connected EHR for this patient yet. Anything recorded from here is written back.'
              : activePatientId === null
                ? 'Nothing is recorded for anyone yet — start from the recommendation above, or pick a patient from the Population view.'
                : 'Nothing recorded for this patient yet. Start from the recommendation above.'}
          </p>
        </Notice>
      )}
    </div>
  )
}
