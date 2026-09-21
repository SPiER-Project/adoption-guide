import { useMemo } from 'react'
import { useScrollToHash } from '@spier/app-shell/hooks/useScrollToHash'
import { STAGES } from '@spier/core/data/catalog'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { useToolConfig } from '../context/ToolConfigContext'
import { PageHeader } from '@spier/ui/PageHeader'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { PatientPathway } from '../components/PatientPathway'
import { ChartLanding, ON_FILE_ANCHOR } from '../components/ChartLanding'
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
import { buildCdsCards, isPathwayObligationCard } from '@spier/core/lib/cdsHooks'
import { evaluatePathway } from '@spier/core/lib/pathwayEvaluation'
// This page is where `PatientChart.css` is imported for the whole chart — every
// section component it composes relies on that rather than importing its own.
import '../css/PatientChart.css'
import { Notice } from '@spier/ui/Notice'

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
    isSmartConnected,
    walkthrough,
    isSliceLoading,
    dataSourceError,
    writebackReport,
  } = usePatient()
  const { isToolEnabled: siteToolEnabled } = useToolConfig()
  // `jumpTo` rather than a <Link> for the landing screen's two in-page links:
  // it updates the hash on the CURRENT path, so a chart opened as
  // /patient/record/patient-005 does not lose its patient id on the way to its
  // own record section.
  const { jumpTo } = useScrollToHash()

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
  const { statuses } = useMemo(
    () => derivePathwayStatus(artifacts),
    [artifacts],
  )
  const stageGroups = useMemo(() => groupArtifactsByStage(artifacts), [artifacts])
  const unstaged = useMemo(() => unstagedArtifacts(artifacts), [artifacts])
  // ⚠️ The cards are what the PUBLISHED PATHWAY owes this record — not the
  // active stage's lead tool, and not the patient's curated `recommendedNextStep`
  // (clinical-app audit §1.5, decision §7.1). The builder evaluates the protocol
  // itself, so the chart, the embedded panel and the hosted service all answer
  // the same question the same way.
  const record = useMemo(
    () => ({ responses, observations, carePlans, communications, procedures, episodes, riskAlerts }),
    [responses, observations, carePlans, communications, procedures, episodes, riskAlerts],
  )
  // What the landing screen says. The SAME answer the cards below are built
  // from — `buildCdsCards` calls this evaluator and decides nothing itself — so
  // the screen and the wire format cannot disagree about what is due.
  const evaluation = useMemo(() => evaluatePathway(record), [record])
  const cdsCards = useMemo(
    () => buildCdsCards({ record, isToolEnabled }),
    [record, isToolEnabled],
  )
  // ⚠️ The rail keeps the GUIDANCE cards and nothing else. The pathway's
  // obligations are the landing screen's, and rendering them in both places is
  // the "three answers to what do I do" defect (§1.5) rebuilt one layer down.
  // "Guidance is not an action" is audit §4.5's own rule, and it belongs on
  // *Where this patient is* rather than at the top of the chart.
  const guidanceCards = useMemo(() => cdsCards.filter(c => !isPathwayObligationCard(c)), [cdsCards])

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
          (audit §4.1, §4.7). Everything below it — the rail, the record — is
          something a clinician opens on purpose. */}
      <ChartLanding
        evaluation={evaluation}
        isToolEnabled={isToolEnabled}
        stepLabel={stepLabel}
        recordCount={recordCount}
        onJump={jumpTo}
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
              ? 'No SPiER artifacts on the connected EHR for this patient yet. Anything recorded from here is written back.'
              : activePatientId === null
                ? 'Nothing is recorded for anyone yet — start from the recommendation above, or pick a patient from the Population view.'
                : 'No artifacts yet for this patient. Start from the recommendation above.'}
          </p>
        </Notice>
      )}

      <PatientPathway
        stageGroups={stageGroups}
        statuses={statuses}
        cards={guidanceCards}
        isToolEnabled={isToolEnabled}
      />

      {/* Everything on file, under one anchor — the landing screen's second
          link lands here. PR 5 (§4.4) makes these three sections one page with
          one list; until then the honest destination for "what's on file" is
          the top of the three. */}
      <div id={ON_FILE_ANCHOR} className="chart-record">
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
    </div>
  )
}
