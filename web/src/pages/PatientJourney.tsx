import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  STAGES,
  toolsByStage,
  triggersFromStage,
  type Tool,
} from '@spier/core/data/catalog'
import { ToolDetail } from '../components/ToolDetail'
import { useScrollToHash } from '../hooks/useScrollToHash'
import { guideHref } from '../data/guideSections'
import '../css/PatientJourney.css'
import { cx } from '@spier/ui/cx'
import { Notice } from '@spier/ui/Notice'
import { Pill, type PillTone } from '@spier/ui/Pill'
import { Card } from '@spier/ui/Card'

const STATUS_LABELS: Record<Tool['inclusionStatus'], string> = {
  core: 'Core',
  optional: 'Optional',
  future: 'Future',
}

const STAGE_TOOL_TONE: Record<string, PillTone> = { core: 'success', optional: 'info', future: 'neutral' }

export function PatientJourney() {
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null)
  // Scroll to a #stage-… section on mount (cold deep-link) and on hash change.
  useScrollToHash()

  const toggleTool = (toolId: string) => {
    setExpandedToolId(prev => (prev === toolId ? null : toolId))
  }

  return (
    <div className="patient-journey">
      <p className="journey-description">
        Every instrument and recorder SPiER models, grouped by the care stage it belongs to &mdash; from
        flagging risk through measuring and sharing pathway activity. Click a tool to see its specification,
        implementation details, data elements, and launch options. For the clinical protocol these tools
        serve &mdash; screen, gate, assess, branch by risk tier &mdash; see the{' '}
        <Link to={guideHref('pathway')}>Care Pathway</Link>.
      </p>
      <p className="journey-description">
        For the same catalogue scored rather than described &mdash; where each instrument is in the
        build, how strongly it is recommended, and how deeply it integrates &mdash; see{' '}
        <Link to={guideHref('tools/readiness')}>Adoption Readiness</Link>.
      </p>

      <Notice as="aside" tone="info">
        <strong>Aligned with Zero Suicide.</strong>{' '}
        SPiER's 8 technical stages are a FHIR-native instantiation of the workflow layers of the{' '}
        <a href="https://zerosuicide.edc.org/" target="_blank" rel="noopener noreferrer">Zero Suicide</a>{' '}
        framework. Stages 1&ndash;3 model <em>Identify</em>; stage 4 models <em>Engage</em>;
        stages 5&ndash;6 model <em>Transition</em>; stage 7 models <em>Treat</em>;
        stage 8 models <em>Improve</em>. The organizational layers (<em>Lead</em>, <em>Train</em>)
        are out of SPiER's EHR-pathway scope.
      </Notice>

      {/* Horizontal progress bar */}
      <Card className="journey-progress">
        {STAGES.map((stage, idx) => (
          <div key={stage.id} className="journey-progress-step">
            <a href={`#${guideHref('tools')}#stage-${stage.id}`} className="journey-progress-dot">
              {idx + 1}
            </a>
            <span className="journey-progress-label">{stage.title}</span>
            {idx < STAGES.length - 1 && <div className="journey-progress-line" />}
          </div>
        ))}
      </Card>

      {/* Stage detail sections */}
      <div className="journey-stages">
        {STAGES.map((stage, idx) => {
          const stageTools = toolsByStage(stage.id)
          const stageTriggers = triggersFromStage(stage.id)
          const nextStage = STAGES[idx + 1]
          const crossStageTriggers = stageTriggers.filter(t => t.toStageId && t.toStageId !== stage.id)
          const ongoingTriggers = stageTriggers.filter(t => !t.toStageId)

          return (
            <div key={stage.id} id={`stage-${stage.id}`} className="journey-stage">
              <div className="stage-header">
                <span className="stage-number">{idx + 1}</span>
                <div>
                  <h3 className="stage-title">{stage.title}</h3>
                  <p className="stage-description">{stage.description}</p>
                </div>
              </div>

              {stageTools.length > 0 && (
                <div className="stage-tools">
                  {stageTools.map(tool => {
                    const isExpanded = expandedToolId === tool.id
                    return (
                      <div
                        key={tool.id}
                        className={cx('stage-tool-card', `stage-tool-card--${tool.inclusionStatus}`, isExpanded && 'stage-tool-card--expanded')}
                      >
                        <button
                          type="button"
                          className="stage-tool-summary"
                          onClick={() => toggleTool(tool.id)}
                          aria-expanded={isExpanded}
                        >
                          <div className="stage-tool-header">
                            <span className="stage-tool-name">{tool.name}</span>
                            <Pill size="sm" tone={STAGE_TOOL_TONE[tool.inclusionStatus]}>
                              {STATUS_LABELS[tool.inclusionStatus]}
                            </Pill>
                          </div>
                          <p className="stage-tool-purpose">{tool.purpose}</p>
                          {tool.settings.length > 0 && (
                            <p className="stage-tool-settings">{tool.settings.join(', ')}</p>
                          )}
                          <span className="stage-tool-expand-hint">
                            {isExpanded ? 'Hide details \u2191' : 'Show details \u2193'}
                          </span>
                        </button>
                        {isExpanded && <ToolDetail tool={tool} />}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Triggers → next stage */}
              {crossStageTriggers.length > 0 && nextStage && (
                <div className="stage-triggers">
                  <div className="triggers-label">
                    Triggers &rarr; {nextStage.title}
                  </div>
                  {crossStageTriggers.map(trigger => (
                    <div key={trigger.id} className="trigger-item">
                      <span className="trigger-event">{trigger.event}</span>
                      <span className="trigger-condition">{trigger.condition}</span>
                      <span className="trigger-action">{trigger.action}</span>
                    </div>
                  ))}
                </div>
              )}

              {ongoingTriggers.length > 0 && (
                <div className="stage-triggers">
                  <div className="triggers-label">Ongoing Triggers</div>
                  {ongoingTriggers.map(trigger => (
                    <div key={trigger.id} className="trigger-item">
                      <span className="trigger-event">{trigger.event}</span>
                      <span className="trigger-condition">{trigger.condition}</span>
                      <span className="trigger-action">{trigger.action}</span>
                    </div>
                  ))}
                </div>
              )}

              {idx < STAGES.length - 1 && (
                <div className="stage-connector">
                  <div className="stage-connector-arrow">&darr;</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
