/**
 * Tool Configuration — which instruments THIS SPiER deployment offers.
 *
 * ── Why this is a page of the app and not a section of the guide ───────────
 *
 * It lived at `/guide/tool-configuration` until 2026-09-15, in a guide group
 * called "Configure". That was wrong twice over, and the second one is the
 * interesting one.
 *
 * The obvious problem: since the 2026-09-09 boundary the guide EXPLAINS and
 * HOSTS — it does not configure. This was the only guide section with side
 * effects on another surface, and it had to carry a hand-written callout saying
 * so because nothing else in the UI did.
 *
 * The subtler problem: the argument that first moved it off the guide pointed at
 * the mock EHR, because `toolPresets.ts` and `services/mock-ehr/src/capability.ts`
 * describe themselves in almost the same sentence — "what does a site like ours
 * have turned on?" against "what this server says it can do". They are NOT the
 * same fact. The capability profile is a fact about the EHR: which FHIR writes
 * land. The toolset is a fact about SPiER's own deployment — the EHR never sees
 * the tool catalog and has no opinion on whether a site offers CAMS. A SMART app
 * is configured by whoever deploys it, so the setting belongs in the app that
 * owns the catalog. Hence `/settings`, beside the chart rather than above it.
 *
 * ⚠️ **This page still does nothing in panel chrome, and that is not an
 * oversight.** `lib/toolEnablement.ts` offers every catalogued tool inside a
 * host chart. Moving this page into the app dissolved ONE of that rule's four
 * reasons (it is no longer "set on a guide page the panel cannot reach") and
 * left the load-bearing one standing: the host's own CDS cards come from the
 * stateless Worker, which cannot read this browser's localStorage, so a panel
 * honouring the preset would disagree with the host chart beside it — exactly
 * the defect fixed on 2026-09-02. The banner below says this out loud rather
 * than letting a presenter flip a switch and watch nothing happen.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { TOOLS, groupToolsByStage, launchableTools } from '@spier/core/data/catalog'
import { PageHeader } from '../components/PageHeader'
import { useToolConfig } from '../context/ToolConfigContext'
import { usePresentation } from '../context/PresentationContext'
import { PRESETS, presetToolIds, type PresetId } from '../data/toolPresets'
import { usePatient } from '../context/PatientContext'
import { INCLUSION_ICON, type InclusionStatus } from '../lib/statusIcons'
import '../css/ToolConfiguration.css'
import { cx } from '../lib/cx'
import { Notice } from '../components/Notice'
import { Pill } from '../components/Pill'
import { Card } from '../components/Card'

function InclusionBadge({ status }: { status: InclusionStatus }) {
  const Icon = INCLUSION_ICON[status]
  return (
    <span className={`tool-row-status tool-row-status--${status}`}>
      <Icon aria-hidden="true" size={11} />
      {status}
    </span>
  )
}

export function ToolConfiguration() {
  const { activePreset, isToolEnabled, setPreset, toggleTool } = useToolConfig()
  const { activePatientId } = usePatient()
  const inPanel = usePresentation().chromeMode === 'panel'

  const toolsByStage = useMemo(() => groupToolsByStage(TOOLS, { skipEmpty: true }), [])
  const launchable = useMemo(() => launchableTools(), [])
  const launchableCount = launchable.length
  const enabledCount = useMemo(
    () => launchable.filter(t => isToolEnabled(t.id)).length,
    [isToolEnabled, launchable],
  )
  const presetCounts = useMemo(
    () =>
      Object.fromEntries(PRESETS.map(p => [p.id, presetToolIds(p.id).length])) as Record<
        PresetId,
        number
      >,
    [],
  )

  // Mirrors the sidebar: keep the loaded patient rather than dropping the
  // reader onto the blank chart.
  const patientBase = activePatientId ? `/patient/record/${activePatientId}` : '/patient/record'

  return (
    <div className="tool-config">
      {/* Owns its own header, like PathwayProtocol beside it: the Patient lens
          has no layout component to render one, and in panel chrome `up` is the
          page's only way back to the chart. */}
      <PageHeader
        eyebrow="Settings"
        up="/patient/record"
        title="Tool Configuration"
        lede="Which suicide-prevention tools this SPiER deployment offers. Sites differ in what they have in place; this is where that is set."
      />

      <header className="tool-config-header">
        <p className="tool-config-intro">
          This is a setting of <strong>the app</strong>, not of the EHR it connects to. An EHR
          advertises which FHIR resources it will accept &mdash; that is its{' '}
          <em>capability</em>, and the Demo EHR has its own switch for it. It never sees SPiER's tool
          catalog and has no opinion on whether a site offers CAMS. Tools that aren't yet built in
          SPiER are listed but cannot be toggled.
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
            {TOOLS.length} total in catalog ({TOOLS.length - launchableCount} not yet built)
          </span>
        </p>
      </header>

      {/* Two different true statements, because the rule really does differ by
          chrome. See the ⚠️ on this file and lib/toolEnablement.ts — the panel
          offering everything is a fix, not a bug, and a presenter who flips a
          preset in a host chart and sees nothing change needs to be told why
          here rather than to conclude the switch is broken. */}
      <Card as="aside" padding="compact" tone="muted" accent className="tool-config-effect">
        {inPanel ? (
          <p className="tool-config-effect__body">
            <strong>This setting does not apply inside a host chart.</strong> Here the host{' '}
            <em>is</em> the site, and its own recommendation cards come from SPiER's hosted CDS
            service, which cannot read this browser's storage. If the chart beside you honoured a
            preset the host's cards did not, the two would disagree about the same patient &mdash;
            so in a panel every catalogued tool is offered. Flip presets on the standalone app to
            see them take effect.
          </p>
        ) : (
          <p className="tool-config-effect__body">
            <strong>Changes here take effect on the patient chart.</strong> Recommendation cards
            only offer launch actions for enabled tools, so this page decides what the chart can
            offer at each pathway stage &mdash; a narrower profile models a site with less tooling
            in place, not a gap to close.{' '}
            <Link to={patientBase} className="tool-config-effect__link">
              Open the patient chart &rarr;
            </Link>
          </p>
        )}
      </Card>

      <section className="tool-config-presets">
        <h3 className="tool-config-section-title">Presets</h3>
        <div className="preset-grid">
          {PRESETS.map(preset => {
            const isActive = activePreset === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                className={cx('preset-card', isActive && 'preset-card--active')}
                onClick={() => setPreset(preset.id)}
                aria-pressed={isActive}
              >
                <span className="preset-card-label">{preset.label}</span>
                {/* Counted from the resolved preset rather than typed into the
                    description, so the two can't disagree. */}
                <span className="preset-card-count">
                  {presetCounts[preset.id]} of {launchableCount} tools
                </span>
                <span className="preset-card-desc">{preset.description}</span>
              </button>
            )
          })}
        </div>
        {activePreset === 'custom' && (
          <Notice tone="warning">
            You've customized the toolset. Click a preset above to reset to its baseline selection.
          </Notice>
        )}
      </section>

      <section className="tool-config-tools">
        <h3 className="tool-config-section-title">Tools by pathway stage</h3>
        {toolsByStage.map(({ stage, tools }) => (
          <Card key={stage.id} className="tool-config-stage">
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
                      <Pill size="sm" tone="warning" icon={Clock} title="Catalogued, but not yet launchable from this app">
                        Not built
                      </Pill>
                    )}
                    <span className="tool-row-body">
                      <span className="tool-row-name">
                        {tool.shortName ?? tool.name}
                        <span className="tool-row-id">{tool.id}</span>
                        <InclusionBadge status={tool.inclusionStatus} />
                      </span>
                      <span className="tool-row-purpose">{tool.purpose}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </Card>
        ))}
      </section>
    </div>
  )
}
