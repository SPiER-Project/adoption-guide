/**
 * One stage of the suicide-safer care pathway, as a page.
 *
 * ── Why a page and not just the chart's rail ────────────────────────────────
 *
 * Settled with Brad 2026-09-18: *"the adoption guide view of the tools [is]
 * comprehensive (all tools) and giv[es] the user the ability to see what json
 * they are generating. the SMART app should have a defined pathway (a tool
 * selected for each page) and the goal is to guide the clinician through the
 * stages of care."*
 *
 * The chart's rail answers *where is this patient*. This answers *what do I do
 * here*, for one stage, with the instrument already chosen — so a clinician
 * lands on a decision rather than on a catalogue of eight screeners.
 *
 * ── The selection is the PATHWAY's, not the deployment's ────────────────────
 *
 * ⚠️ **This page must not read the tool-configuration preset to decide what it
 * leads with**, and that is the whole reason `packages/core/src/lib/pathwaySelection.ts`
 * exists as a separate module. The preset is a claim about what a *deployment*
 * turned on; the pathway is a claim about *care*. Keyed on the preset, this page
 * would change what it tells a clinician to do every time an operator ticked a
 * box on `/settings`, which is not what "guided" means.
 *
 * The preset still governs what else is OFFERED, which is a different question
 * and the one it is good at — see the escape below.
 *
 * ── The escape ─────────────────────────────────────────────────────────────
 *
 * ⚠️ **A guided page with no way off it designs clinical judgment out of the
 * product.** The pathway names the instrument SPiER demonstrates end to end; it
 * does not know this patient. So every alternative the deployment has enabled is
 * one disclosure away, and anything it has *not* enabled is counted rather than
 * hidden — the same treatment the chart's stage tiles already give, so a
 * clinician who has seen one recognises the other.
 *
 * Since 2026-09-21 that drawer is `components/StageAlternatives.tsx`, because
 * the *Why this?* page owes the same escape for the step it explains
 * (clinical-app audit §4.2). One definition; see its header for why the list is
 * shared rather than moved.
 */
import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { PageHeader } from '@spier/ui/PageHeader'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { Card } from '@spier/ui/Card'
import { EmptyState } from '@spier/ui/EmptyState'
import { stageLeadTools } from '@spier/core/lib/pathwaySelection'
import { stageBlurb } from '@spier/core/data/catalog/stageBlurbs'
import { stageById } from '@spier/core/data/catalog/stages'
import type { Tool } from '@spier/core/data/catalog/tools'
import { useToolConfig } from '../context/ToolConfigContext'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { toolEnablementFor } from '../lib/toolEnablement'
import { toolPurposeLine } from '../lib/toolCopy'
import { StageAlternatives, ToolActions } from '../components/StageAlternatives'
import '../css/PathwayStage.css'

export function PathwayStage() {
  const { stageId } = useParams<{ stageId: string }>()
  const stage = stageId ? stageById(stageId) : undefined
  const { isToolEnabled: siteToolEnabled } = useToolConfig()
  const { chromeMode } = usePresentation()
  // Same rule the chart applies: in a host chart every catalogued tool is
  // offered, because the host's own recommendation cards cannot read this
  // browser's storage and the two must not contradict each other about the same
  // patient. See lib/toolEnablement.ts.
  const isToolEnabled = useMemo(
    () => toolEnablementFor(chromeMode, siteToolEnabled),
    [chromeMode, siteToolEnabled],
  )

  const lead = useMemo<Tool[]>(() => (stage ? stageLeadTools(stage.id) : []), [stage])

  // An unknown stage is a bad URL, not a blank page. The chart is where every
  // link to here comes from, so it is where a wrong one goes back to.
  if (!stage) return <Navigate to="/patient/record" replace />

  return (
    <div className="pathway-stage">
      {/* `lede` is the clinician's sentence for the stage, not the CodeSystem's
          "The EHR supports…" definition — see
          `packages/core/src/data/catalog/stageBlurbs.ts`. */}
      <PageHeader
        eyebrow="Patient Chart"
        up="/patient/record"
        eyebrowStyle="pill"
        title={stage.title}
        lede={stageBlurb(stage.id)}
      />

      <SectionHeader title="What to do here" />
      {lead.length === 0 ? (
        <EmptyState>SPiER has no tool for this stage yet.</EmptyState>
      ) : (
        lead.map(tool => (
          <Card key={tool.id} accent>
            <h4 className="pathway-stage__tool-name">{tool.name}</h4>
            <p className="pathway-stage__tool-purpose">{toolPurposeLine(tool)}</p>
            <ToolActions tool={tool} />
          </Card>
        ))
      )}

      <StageAlternatives stageId={stage.id} isToolEnabled={isToolEnabled} />
    </div>
  )
}
