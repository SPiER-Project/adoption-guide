/**
 * "Use a different instrument for this stage" — the escape from a guided page.
 *
 * ⚠️ **A guided page with no way off it designs clinical judgment out of the
 * product.** That sentence is `PathwayStage.tsx`'s, and it is the whole reason
 * this exists: the pathway names the instrument SPiER demonstrates end to end,
 * and it does not know this patient. So everything else the deployment has
 * enabled at that stage is one disclosure away, and anything it has NOT enabled
 * is counted rather than hidden.
 *
 * ⚠️ **One definition, two pages, and the audit asked for one.** Clinical-app
 * audit §4.2 puts the alternatives on *Why this?* — the page that holds the
 * reasoning behind the chart's one recommendation — while §4.3 leaves the stage
 * page as it is. Those pages ask the same question about different subjects
 * ("what else could satisfy the step I am being told to do" and "what else
 * could satisfy this stage"), so this is one component rendered twice rather
 * than the list MOVING off a page whose own design note says it must not lose
 * it. `check:dupes` would fail the paste either way.
 *
 * It keeps a bare `<details>` rather than `Disclosure`, which is a recorded
 * decision and not an oversight: see the note in `packages/ui/src/Disclosure.tsx`
 * about the three clinician-facing drawers that carry a judgement about their
 * own weight.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@spier/ui/Button'
import { Card } from '@spier/ui/Card'
import { stageAlternativeTools } from '@spier/core/lib/pathwaySelection'
import { toolPurposeLine } from '../lib/toolCopy'
import type { Tool } from '@spier/core/data/catalog/tools'
import '../css/PathwayStage.css'

export function ToolActions({ tool }: { tool: Tool }) {
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

export function StageAlternatives({
  stageId,
  isToolEnabled,
  summary = 'Use a different instrument for this stage',
}: {
  stageId: string
  isToolEnabled: (id: string) => boolean
  /** The drawer's label. *Why this?* names the step rather than the stage. */
  summary?: string
}) {
  const { available, withheld } = useMemo(() => {
    const alternatives = stageAlternativeTools(stageId)
    const available = alternatives.filter(t => isToolEnabled(t.id))
    return { available, withheld: alternatives.length - available.length }
  }, [stageId, isToolEnabled])

  if (available.length === 0 && withheld === 0) return null

  return (
    <details className="pathway-stage__alternatives">
      <summary className="pathway-stage__alternatives-summary">{summary}</summary>
      <p className="pathway-stage__alternatives-note">
        The pathway names what SPiER demonstrates end to end. It does not know this patient, so
        everything else this deployment offers at this stage is here.
      </p>
      {available.map(tool => (
        <Card key={tool.id} padding="compact">
          <h4 className="pathway-stage__tool-name">{tool.name}</h4>
          <p className="pathway-stage__tool-purpose">{toolPurposeLine(tool)}</p>
          <ToolActions tool={tool} />
        </Card>
      ))}
      {withheld > 0 && (
        <p className="pathway-stage__alternatives-note">
          {withheld} {withheld === 1 ? 'other tool is' : 'other tools are'} catalogued for this
          stage but not enabled in your implementation. <Link to="/settings">Configure tools</Link>.
        </p>
      )}
    </details>
  )
}
