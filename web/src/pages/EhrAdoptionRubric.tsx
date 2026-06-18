import { useMemo } from 'react'
import { RUBRIC_CRITERIA, RUBRIC_TOOLS, STAGE_ORDER, STAGE_DESCRIPTIONS } from '../data/ehrAdoptionData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import '../css/EhrAdoptionRubric.css'

interface RubricState {
  supported: Record<string, boolean>                    // toolId → checked
  stageScores: Record<string, Record<string, number>>   // stage → criterionId → level
}

const EMPTY_STATE: RubricState = { supported: {}, stageScores: {} }

export function EhrAdoptionRubric() {
  const [state, setState] = useLocalStorage<RubricState>('spier-ehr-rubric-v3', EMPTY_STATE)

  const isSupported = (toolId: string) => state.supported[toolId] ?? false

  const toggleTool = (toolId: string) => {
    setState(prev => ({
      ...prev,
      supported: { ...prev.supported, [toolId]: !prev.supported[toolId] },
    }))
  }

  const getStageScore = (stage: string, criterionId: string) =>
    state.stageScores[stage]?.[criterionId] ?? 0

  const setStageScore = (stage: string, criterionId: string, level: number) => {
    setState(prev => ({
      ...prev,
      stageScores: {
        ...prev.stageScores,
        [stage]: { ...prev.stageScores[stage], [criterionId]: level },
      },
    }))
  }

  const toolsByStage = useMemo(() => {
    const grouped: Record<string, typeof RUBRIC_TOOLS> = {}
    for (const stage of STAGE_ORDER) grouped[stage] = []
    for (const tool of RUBRIC_TOOLS) {
      grouped[tool.stage]?.push(tool)
    }
    return grouped
  }, [])

  const stageStats = useMemo(() => {
    const stats: Record<string, { covered: boolean; supportedCount: number; totalCount: number; allSupported: boolean }> = {}
    for (const stage of STAGE_ORDER) {
      const tools = toolsByStage[stage] ?? []
      // Inlined from isSupported() so this memo's deps stay honest (state.supported).
      const supportedCount = tools.filter(t => state.supported[t.toolId] ?? false).length
      stats[stage] = {
        covered: supportedCount > 0,
        supportedCount,
        totalCount: tools.length,
        allSupported: supportedCount === tools.length,
      }
    }
    return stats
  }, [state.supported, toolsByStage])

  const overallStats = useMemo(() => {
    const coveredStages = STAGE_ORDER.filter(s => stageStats[s]?.covered).length
    const totalStages = STAGE_ORDER.length

    let maturityScore = 0
    let maturityMax = 0
    for (const stage of STAGE_ORDER) {
      if (stageStats[stage]?.covered) {
        for (const c of RUBRIC_CRITERIA) {
          // Inlined from getStageScore() so this memo's deps stay honest (state).
          maturityScore += state.stageScores[stage]?.[c.id] ?? 0
          maturityMax += 3
        }
      }
    }

    return {
      coveredStages,
      totalStages,
      coveragePct: Math.round((coveredStages / totalStages) * 100),
      maturityPct: maturityMax > 0 ? Math.round((maturityScore / maturityMax) * 100) : 0,
    }
  }, [state, stageStats])

  const resetAll = () => setState(EMPTY_STATE)

  return (
    <div className="ehr-rubric">
      <h2 className="page-title">EHR Adoption Rubric</h2>
      <p className="rubric-description">
        Assess your EHR&rsquo;s adoption of suicide safer care tools. Check which tools your system
        supports (at least one per stage is needed), then rate each stage across three maturity criteria.
      </p>

      {/* Overall summary */}
      <div className="rubric-summary">
        <div className="rubric-summary-stat">
          <span className="rubric-summary-value">{overallStats.coveredStages}/{overallStats.totalStages}</span>
          <span className="rubric-summary-label">Stages Covered</span>
        </div>
        <div className="rubric-summary-bar">
          <div className="rubric-summary-fill rubric-summary-fill--coverage" style={{ width: `${overallStats.coveragePct}%` }} />
        </div>
        <div className="rubric-summary-stat">
          <span className="rubric-summary-value">{overallStats.maturityPct}%</span>
          <span className="rubric-summary-label">Maturity</span>
        </div>
        <div className="rubric-summary-bar">
          <div className="rubric-summary-fill rubric-summary-fill--maturity" style={{ width: `${overallStats.maturityPct}%` }} />
        </div>
        <button className="rubric-reset-btn" onClick={resetAll}>Reset All</button>
      </div>

      {/* Legend */}
      <div className="rubric-legend">
        {RUBRIC_CRITERIA.map(criterion => (
          <details key={criterion.id} className="rubric-legend-criterion">
            <summary className="rubric-legend-summary">
              <strong>{criterion.name}</strong> &mdash; {criterion.description}
            </summary>
            <div className="rubric-legend-levels">
              {criterion.levels.map(l => (
                <div key={l.level} className="rubric-legend-level">
                  <span className={`rubric-level-chip rubric-level-chip--${l.level}`}>
                    {l.level}
                  </span>
                  <strong>{l.label}</strong> &mdash; {l.description}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      {/* Stages */}
      {STAGE_ORDER.map(stage => {
        const tools = toolsByStage[stage] ?? []
        const stats = stageStats[stage]
        return (
          <div key={stage} className={`rubric-stage-section ${stats.covered ? 'rubric-stage-section--covered' : ''}`}>
            <div className="rubric-stage-header">
              <div className="rubric-stage-title-row">
                <span className={`rubric-stage-indicator ${stats.covered ? 'rubric-stage-indicator--covered' : ''}`}>
                  {stats.covered ? '\u2713' : '\u2015'}
                </span>
                <div className="rubric-stage-title-block">
                  <h3 className="rubric-stage-title">{stage}</h3>
                  {STAGE_DESCRIPTIONS[stage] && (
                    <p className="rubric-stage-description">{STAGE_DESCRIPTIONS[stage]}</p>
                  )}
                </div>
              </div>
              <div className="rubric-stage-counts">
                <span className={`rubric-stage-coverage ${stats.allSupported ? 'rubric-stage-coverage--all' : ''}`}>
                  {stats.supportedCount}/{stats.totalCount} tools
                </span>
                {stats.allSupported && <span className="rubric-bonus-badge">All tools!</span>}
              </div>
            </div>

            {/* Tool checkboxes */}
            <div className="rubric-tool-list">
              {tools.map(tool => (
                <label key={tool.toolId} className={`rubric-tool-checkbox ${isSupported(tool.toolId) ? 'rubric-tool-checkbox--checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSupported(tool.toolId)}
                    onChange={() => toggleTool(tool.toolId)}
                  />
                  <span className="rubric-tool-name">{tool.name}</span>
                </label>
              ))}
            </div>

            {/* Stage-level maturity scoring — only shown when at least one tool is supported */}
            {stats.covered && (
              <div className="rubric-maturity">
                <div className="rubric-maturity-label">Stage Maturity</div>
                <div className="rubric-maturity-grid">
                  {RUBRIC_CRITERIA.map(criterion => {
                    const current = getStageScore(stage, criterion.id)
                    return (
                      <div key={criterion.id} className="rubric-maturity-cell">
                        <span className="rubric-maturity-criterion">{criterion.name}</span>
                        <select
                          className={`rubric-select rubric-select--level-${current}`}
                          value={current}
                          onChange={e => setStageScore(stage, criterion.id, Number(e.target.value))}
                        >
                          {criterion.levels.map(l => (
                            <option key={l.level} value={l.level}>{l.level} — {l.label}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
