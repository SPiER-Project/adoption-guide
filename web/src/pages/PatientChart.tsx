import { useMemo } from 'react'
import { useScrollToHash } from '../hooks/useScrollToHash'
import { usePatient } from '../context/PatientContext'
import { useToolConfig } from '../context/ToolConfigContext'
import { PageHeader } from '../components/PageHeader'
import { usePresentation } from '../context/PresentationContext'
import { PatientPathway, PathwayProgress } from '../components/PatientPathway'
import { EpisodeRecordView } from '../components/EpisodeRecordView'
import { WritebackScorecard } from '../components/WritebackScorecard'
import { OtherActivitySection } from '../components/OtherActivitySection'
import { EncountersTimeline } from '../components/EncountersTimeline'
import { PatientDocuments } from '../components/PatientDocuments'
import { buildWalkthroughRefIndex } from '../lib/chartDisplay'
import { toolEnablementFor } from '../lib/toolEnablement'
import {
  derivePathwayStatus,
  groupArtifactsByStage,
  unstagedArtifacts,
} from '@spier/core/lib/patientPathway'
import { workflowArtifactsOf } from '@spier/core/lib/registry'
import { buildCdsCards } from '@spier/core/lib/cdsHooks'
// This page is where `PatientChart.css` is imported for the whole chart — every
// section component it composes relies on that rather than importing its own.
import '../css/Dashboard.css'
import '../css/PatientChart.css'

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
    encounters,
    flags,
    tasks,
    activePatientId,
    populationPatient,
    isSmartConnected,
    walkthrough,
    isSliceLoading,
    dataSourceError,
    writebackReport,
  } = usePatient()
  const { isToolEnabled: siteToolEnabled } = useToolConfig()
  useScrollToHash()

  // Panel chrome changes three things on this page: the header is the rail's
  // title + status line, the record sections start collapsed (see below), and
  // every catalogued tool is offered — the rule the CDS Hooks service applies,
  // so the host's cards and this rail agree about the patient. lib/toolEnablement
  // has the measured case.
  const { chromeMode } = usePresentation()
  const inPanel = chromeMode === 'panel'
  const isToolEnabled = useMemo(
    () => toolEnablementFor(chromeMode, siteToolEnabled),
    [chromeMode, siteToolEnabled],
  )

  // `Type/id` → display for every artifact a walkthrough step can reference
  // (#263 phase 5b). Built from all the buckets rather than just responses and
  // CarePlans, which is all the retired string matching could reach.
  const walkthroughRefIndex = useMemo(
    () =>
      buildWalkthroughRefIndex({
        responses,
        carePlans,
        observations,
        communications: communications ?? [],
        // Flags, Tasks and Encounters are indexed here but deliberately NOT in
        // `workflowArtifactsOf` below — that feeds pathway derivation, and a
        // precaution Flag is not a stage artifact. This index only answers
        // "can a walkthrough step link to it", and the ED exception branches
        // (patient-013, patient-014) reference all three.
        //
        // Procedures (#324) and Consents (#341) were both missing here, and
        // both were found the same way: a ref this index cannot resolve
        // renders no link at all, and walkthroughRefs.test.ts caught it.
        workflowArtifacts: [
          ...(documentReferences ?? []),
          ...(serviceRequests ?? []),
          ...(appointments ?? []),
          ...(flags ?? []),
          ...(tasks ?? []),
          ...(encounters ?? []),
          ...(procedures ?? []),
          ...(consents ?? []),
        ],
      }),
    [
      responses,
      carePlans,
      observations,
      communications,
      documentReferences,
      serviceRequests,
      appointments,
      flags,
      tasks,
      encounters,
      procedures,
      consents,
    ],
  )

  // Stage-5 artifacts all stage themselves through meta.tag, so they travel as
  // one bucket rather than a named field per resource type — see PatientArtifacts.
  // In panel chrome the record sections below the rail start collapsed: the
  // panel's budget is vertical, and a 17-artifact episode record plus a 10-row
  // document list expanded under the rail put the thing a clinician came for in
  // the top few percent of a very long scroll. See ChartSectionHeader.
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
  const { statuses, activeStageId } = useMemo(
    () => derivePathwayStatus(artifacts),
    [artifacts],
  )
  const stageGroups = useMemo(() => groupArtifactsByStage(artifacts), [artifacts])
  const unstaged = useMemo(() => unstagedArtifacts(artifacts), [artifacts])
  const cdsCards = useMemo(
    () =>
      buildCdsCards({
        activeStageId,
        riskAlerts,
        isToolEnabled,
        recommendedNextStep: populationPatient?.recommendedNextStep ?? null,
        isSmartConnected,
        // Feeds the tier-driven problem-list guidance card, which gates on the
        // harmonized concept Observation rather than on a risk alert.
        observations,
      }),
    [activeStageId, riskAlerts, isToolEnabled, populationPatient, isSmartConnected, observations],
  )

  return (
    <div className="patient-chart">
      {/* In panel chrome the header IS the rail's title and status line. The
          panel showed "Patient View / Patient Chart", then "Suicide-safer care
          pathway", then a two-line progress sentence — three stacked headings
          for one rail, 112px of a 740px frame. The page title names the one
          thing on the page and the lede says where the patient is; the eyebrow
          (a lens name that means nothing inside a host) is hidden by
          PageHeader.css for a panel page with no `up`. */}
      {inPanel ? (
        <PageHeader
          eyebrow="Patient View"
          title="Suicide-safer care pathway"
          lede={<PathwayProgress statuses={statuses} actionCount={cdsCards.length} compact />}
        />
      ) : (
        <PageHeader eyebrow="Patient View" title="Patient Chart" />
      )}

      {dataSourceError && (
        <div className="chart-data-error" role="alert">
          <strong>EHR data error.</strong>
          <p>{dataSourceError}</p>
        </div>
      )}

      {isSliceLoading && (
        <div className="chart-loading-banner" role="status" aria-live="polite">
          Loading chart data from the connected EHR…
        </div>
      )}

      {/* Sits with dataSourceError deliberately: both are SMART-session
          feedback, and a degraded writeback is the case where there is no error
          to show but still something the site needs to know (#350). */}
      <WritebackScorecard report={writebackReport} />

      {!hasData && !isSliceLoading && !dataSourceError && (
        <div className="empty-chart-banner">
          <strong>This chart is empty.</strong>
          <p>
            {isSmartConnected
              ? 'No SPiER artifacts on the connected EHR for this patient yet. Launch an assessment from the recommendation below to write one back.'
              : activePatientId === null
                ? 'Launch an assessment from the recommendation below to try the forms, or pick a patient from the Population view.'
                : 'No artifacts yet for this patient. Launch an assessment from the recommendation below to populate the chart.'}
          </p>
        </div>
      )}

      <PatientPathway
        stageGroups={stageGroups}
        statuses={statuses}
        cards={cdsCards}
        isToolEnabled={isToolEnabled}
      />

      <OtherActivitySection
        responses={unstaged.responses}
        carePlans={unstaged.carePlans}
        observations={unstaged.observations}
        communications={unstaged.communications}
        workflowArtifacts={unstaged.workflowArtifacts}
      />

      <EpisodeRecordView
        episodes={episodes}
        encounters={encounters}
        responses={responses}
        observations={observations}
        carePlans={carePlans}
        communications={communications}
        serviceRequests={serviceRequests}
        procedures={procedures}
        documentReferences={documentReferences}
        appointments={appointments}
        consents={consents}
        defaultCollapsed={inPanel}
      />

      <EncountersTimeline walkthrough={walkthrough} refIndex={walkthroughRefIndex} defaultCollapsed={inPanel} />

      <PatientDocuments
        responses={responses}
        carePlans={carePlans}
        observations={observations}
        defaultCollapsed={inPanel}
      />
    </div>
  )
}
