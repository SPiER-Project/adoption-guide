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
 */
import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PageHeader } from '@spier/ui/PageHeader'
import { SectionHeader } from '@spier/ui/SectionHeader'
import { Card } from '@spier/ui/Card'
import { Button } from '@spier/ui/Button'
import { EmptyState } from '@spier/ui/EmptyState'
import { stageAlternativeTools, stageLeadTools } from '@spier/core/lib/pathwaySelection'
import { stageById } from '@spier/core/data/catalog/stages'
import type { Tool } from '@spier/core/data/catalog/tools'
import { useToolConfig } from '../context/ToolConfigContext'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { toolEnablementFor } from '../lib/toolEnablement'
import '../css/PathwayStage.css'

function ToolActions({ tool }: { tool: Tool }) {
  return (
    <p className="pathway-stage__actions">
      {tool.launchActions.map((action, i) => (
        <Button key={action.path} to={action.path} variant={i === 0 ? 'primary' : 'secondary'}>
          {action.label}
        </Button>
      ))}
    </p>
  )
}

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

  const { lead, available, withheld } = useMemo(() => {
    if (!stage) return { lead: [] as Tool[], available: [] as Tool[], withheld: 0 }
    const alternatives = stageAlternativeTools(stage.id)
    const available = alternatives.filter(t => isToolEnabled(t.id))
    return {
      lead: stageLeadTools(stage.id),
      available,
      withheld: alternatives.length - available.length,
    }
  }, [stage, isToolEnabled])

  // An unknown stage is a bad URL, not a blank page. The chart is where every
  // link to here comes from, so it is where a wrong one goes back to.
  if (!stage) return <Navigate to="/patient/record" replace />

  return (
    <div className="pathway-stage">
      <PageHeader
        eyebrow="Patient Chart"
        up="/patient/record"
        eyebrowStyle="pill"
        title={stage.title}
        lede={stage.description}
      />

      <SectionHeader title="What to do here" />
      {lead.length === 0 ? (
        <EmptyState>SPiER has no tool for this stage yet.</EmptyState>
      ) : (
        lead.map(tool => (
          <Card key={tool.id} accent>
            <h4 className="pathway-stage__tool-name">{tool.name}</h4>
            <p className="pathway-stage__tool-purpose">{tool.purpose}</p>
            <ToolActions tool={tool} />
          </Card>
        ))
      )}

      {(available.length > 0 || withheld > 0) && (
        <details className="pathway-stage__alternatives">
          <summary className="pathway-stage__alternatives-summary">
            Use a different instrument for this stage
          </summary>
          <p className="pathway-stage__alternatives-note">
            The pathway names what SPiER demonstrates end to end. It does not know this patient, so
            everything else this deployment offers at this stage is here.
          </p>
          {available.map(tool => (
            <Card key={tool.id} padding="compact">
              <h4 className="pathway-stage__tool-name">{tool.name}</h4>
              <p className="pathway-stage__tool-purpose">{tool.purpose}</p>
              <ToolActions tool={tool} />
            </Card>
          ))}
          {withheld > 0 && (
            <p className="pathway-stage__alternatives-note">
              {withheld} {withheld === 1 ? 'other tool is' : 'other tools are'} catalogued for this
              stage but not enabled in your implementation.{' '}
              <Link to="/settings">Configure tools</Link>.
            </p>
          )}
        </details>
      )}
    </div>
  )
}
