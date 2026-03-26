import { useMemo } from 'react'
import { RUBRIC_CRITERIA, RUBRIC_TOOLS, STAGE_ORDER } from '../data/ehrAdoptionData'
import { useLocalStorage } from '../hooks/useLocalStorage'
import '../css/EhrAdoptionRubric.css'

type Scores = Record<string, Record<string, number>> // toolId → criterionId → level

const LEVEL_COLORS = ['#fee2e2', '#fed7aa', '#fef08a', '#bbf7d0']
const LEVEL_TEXT_COLORS = ['#991b1b', '#9a3412', '#854d0e', '#166534']

export function EhrAdoptionRubric() {
  const [scores, setScores] = useLocalStorage<Scores>('spier-ehr-rubric', {})

  const getScore = (toolId: string, criterionId: string) =>
    scores[toolId]?.[criterionId] ?? 0

  const setScore = (toolId: string, criterionId: string, level: number) => {
    setScores(prev => ({
      ...prev,
      [toolId]: { ...prev[toolId], [criterionId]: level },
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

  const overallStats = useMemo(() => {
    let totalScore = 0
    let totalTarget = 0
    for (const tool of RUBRIC_TOOLS) {
      for (const criterion of RUBRIC_CRITERIA) {
        totalScore += getScore(tool.toolId, criterion.id)
        totalTarget += tool.targets[criterion.id] ?? 3
      }
    }
    return { score: totalScore, target: totalTarget, pct: totalTarget > 0 ? Math.round((totalScore / totalTarget) * 100) : 0 }
  }, [scores])

  const stageStats = useMemo(() => {
    const stats: Record<string, { score: number; target: number; pct: number }> = {}
    for (const stage of STAGE_ORDER) {
      let score = 0
      let target = 0
      for (const tool of toolsByStage[stage] ?? []) {
        for (const criterion of RUBRIC_CRITERIA) {
          score += getScore(tool.toolId, criterion.id)
          target += tool.targets[criterion.id] ?? 3
        }
      }
      stats[stage] = { score, target, pct: target > 0 ? Math.round((score / target) * 100) : 0 }
    }
    return stats
  }, [scores, toolsByStage])

  const resetScores = () => setScores({})

  return (
    <div className="ehr-rubric">
      <h2 className="page-title">EHR Adoption Rubric</h2>
      <p className="rubric-description">
        Self-assess your EHR&rsquo;s adoption of suicide safer care tools across three criteria.
        Select your current maturity level for each tool — the target column shows the recommended level.
      </p>

      {/* Overall score */}
      <div className="rubric-overall">
        <div className="rubric-overall-score">
          <span className="rubric-overall-pct">{overallStats.pct}%</span>
          <span className="rubric-overall-label">Overall Adoption</span>
        </div>
        <div className="rubric-overall-bar">
          <div className="rubric-overall-fill" style={{ width: `${overallStats.pct}%` }} />
        </div>
        <button className="rubric-reset-btn" onClick={resetScores}>Reset All</button>
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
                  <span
                    className="rubric-level-chip"
                    style={{ background: LEVEL_COLORS[l.level], color: LEVEL_TEXT_COLORS[l.level] }}
                  >
                    {l.level}
                  </span>
                  <strong>{l.label}</strong> &mdash; {l.description}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      {/* Matrix table by stage */}
      {STAGE_ORDER.map(stage => {
        const tools = toolsByStage[stage] ?? []
        const stats = stageStats[stage]
        return (
          <div key={stage} className="rubric-stage-section">
            <div className="rubric-stage-header">
              <h3 className="rubric-stage-title">{stage}</h3>
              <span className="rubric-stage-pct">{stats.pct}%</span>
            </div>
            <table className="rubric-table">
              <thead>
                <tr>
                  <th className="rubric-th-tool">Tool</th>
                  {RUBRIC_CRITERIA.map(c => (
                    <th key={c.id} className="rubric-th-criterion">{c.name}</th>
                  ))}
                  <th className="rubric-th-gap">Gap</th>
                </tr>
              </thead>
              <tbody>
                {tools.map(tool => {
                  let toolGap = 0
                  for (const c of RUBRIC_CRITERIA) {
                    toolGap += (tool.targets[c.id] ?? 3) - getScore(tool.toolId, c.id)
                  }
                  return (
                    <tr key={tool.toolId}>
                      <td className="rubric-td-tool">{tool.name}</td>
                      {RUBRIC_CRITERIA.map(criterion => {
                        const current = getScore(tool.toolId, criterion.id)
                        const target = tool.targets[criterion.id] ?? 3
                        return (
                          <td key={criterion.id} className="rubric-td-score">
                            <div className="rubric-score-cell">
                              <select
                                className="rubric-select"
                                value={current}
                                onChange={e => setScore(tool.toolId, criterion.id, Number(e.target.value))}
                                style={{
                                  background: LEVEL_COLORS[current],
                                  color: LEVEL_TEXT_COLORS[current],
                                }}
                              >
                                {criterion.levels.map(l => (
                                  <option key={l.level} value={l.level}>{l.level} — {l.label}</option>
                                ))}
                              </select>
                              <span className="rubric-target">Target: {target}</span>
                            </div>
                          </td>
                        )
                      })}
                      <td className="rubric-td-gap">
                        <span className={`rubric-gap-badge ${toolGap === 0 ? 'rubric-gap-badge--met' : 'rubric-gap-badge--gap'}`}>
                          {toolGap === 0 ? '\u2713' : `-${toolGap}`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
