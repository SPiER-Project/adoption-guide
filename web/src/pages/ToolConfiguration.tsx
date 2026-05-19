import { useMemo } from 'react'
import { STAGES, TOOLS, launchableTools } from '../data/catalog'
import { PRESETS, useToolConfig } from '../context/ToolConfigContext'
import '../css/ToolConfiguration.css'

export function ToolConfiguration() {
  const { activePreset, isToolEnabled, setPreset, toggleTool } = useToolConfig()

  const toolsByStage = useMemo(() => {
    return STAGES
      .map(stage => ({
        stage,
        tools: TOOLS.filter(t => t.stageId === stage.id),
      }))
      .filter(g => g.tools.length > 0)
  }, [])

  const launchableCount = useMemo(() => launchableTools().length, [])
  const enabledCount = useMemo(
    () => launchableTools().filter(t => isToolEnabled(t.id)).length,
    [isToolEnabled],
  )

  return (
    <div className="tool-config">
      <header className="tool-config-header">
        <h2 className="tool-config-title">Tool Configuration</h2>
        <p className="tool-config-intro">
          Choose which suicide-prevention tools your implementation supports. The Patient View's
          recommendation cards will only offer launch options for tools you enable here &mdash;
          mirroring how different EHRs and sites vary in what they're set up to do. Tools that
          aren't yet built in SPiER are listed but cannot be toggled.
        </p>
        <p className="tool-config-meta">
          <span className="tool-config-meta-count">
            {enabledCount} of {launchableCount} buildable tools enabled
          </span>
          <span className="tool-config-meta-divider">&middot;</span>
          <span className="tool-config-meta-preset">
            Profile:{' '}
            <strong>
              {activePreset === 'custom'
                ? 'Customized'
                : PRESETS.find(p => p.id === activePreset)?.label ?? activePreset}
            </strong>
          </span>
          <span className="tool-config-meta-divider">&middot;</span>
          <span className="tool-config-meta-count">
            {TOOLS.length} total in catalog ({TOOLS.length - launchableCount} on roadmap)
          </span>
        </p>
      </header>

      <section className="tool-config-presets">
        <h3 className="tool-config-section-title">Presets</h3>
        <div className="preset-grid">
          {PRESETS.map(preset => {
            const isActive = activePreset === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                className={`preset-card ${isActive ? 'preset-card--active' : ''}`}
                onClick={() => setPreset(preset.id)}
                aria-pressed={isActive}
              >
                <span className="preset-card-label">{preset.label}</span>
                <span className="preset-card-desc">{preset.description}</span>
              </button>
            )
          })}
        </div>
        {activePreset === 'custom' && (
          <p className="preset-custom-hint">
            You've customized the toolset. Click a preset above to reset to its baseline selection.
          </p>
        )}
      </section>

      <section className="tool-config-tools">
        <h3 className="tool-config-section-title">Tools by pathway stage</h3>
        {toolsByStage.map(({ stage, tools }) => (
          <div key={stage.id} className="tool-config-stage">
            <header className="tool-config-stage-header">
              <h4 className="tool-config-stage-title">{stage.title}</h4>
              <p className="tool-config-stage-desc">{stage.description}</p>
            </header>
            <div className="tool-config-stage-list">
              {tools.map(tool => {
                const launchable = tool.launchActions.length > 0
                const enabled = launchable && isToolEnabled(tool.id)
                const rowClass = !launchable
                  ? 'tool-row tool-row--not-built'
                  : enabled
                    ? 'tool-row'
                    : 'tool-row tool-row--disabled'
                return (
                  <label key={tool.id} className={rowClass}>
                    {launchable ? (
                      <input
                        type="checkbox"
                        className="tool-row-toggle"
                        checked={enabled}
                        onChange={() => toggleTool(tool.id)}
                      />
                    ) : (
                      <span className="tool-row-roadmap-badge" title="Not yet built — see Roadmap">
                        Roadmap
                      </span>
                    )}
                    <span className="tool-row-body">
                      <span className="tool-row-name">
                        {tool.shortName ?? tool.name}
                        <span className="tool-row-id">{tool.id}</span>
                        <span className={`tool-row-status tool-row-status--${tool.inclusionStatus}`}>
                          {tool.inclusionStatus}
                        </span>
                      </span>
                      <span className="tool-row-purpose">{tool.purpose}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
