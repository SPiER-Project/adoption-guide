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
import { PageHeader } from '@spier/ui/PageHeader'
import { useToolConfig } from '../context/ToolConfigContext'
import { usePresentation } from '@spier/tool-views/context/PresentationContext'
import { PRESETS, presetToolIds, type PresetId } from '../data/toolPresets'
import { usePatient } from '@spier/tool-views/context/PatientContext'
import { InclusionBadge } from '@spier/tool-views/components/InclusionBadge'
import '../css/ToolConfiguration.css'
import { cx } from '@spier/ui/cx'
import { Notice } from '@spier/ui/Notice'
import { Pill } from '@spier/ui/Pill'
import { Card } from '@spier/ui/Card'

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
          has no layout component to render one, and in panel chrome the trail is
          the page's only way back to the chart.

          ⚠️ The crumb says "Care pathway" because that is where it GOES. It read
          "Settings" beside an up-link to the chart — a label for this page,
          styled as the trail above it, pointing somewhere it did not name. A
          segment names its destination (`PageHeader`'s `Crumb`), and this page's
          own name is the title. */}
      <PageHeader
        eyebrow={[{ label: 'Care pathway', to: '/patient/record' }]}
        title="Tool Configuration"
        lede="Which suicide-prevention tools this site has in place."
      />

      {/* ⚠️ **One sentence, where there were three paragraphs** (audit §4.9,
          §8.4). The page was 1,501 words: an intro explaining the difference
          between this setting and the EHR's own capability, a three-count meta
          line, a chrome-dependent effect note, four preset descriptions, eight
          stage descriptions written to an EHR vendor and forty published tool
          purposes each ending "Belongs to the … stage of the SPiER pathway".
          Its reader sets a deployment up once; what they need is the picker,
          the list and what flipping a switch does. */}
      <Card as="aside" padding="compact" tone="muted" accent className="tool-config-effect">
        <p className="tool-config-effect__body">
          {inPanel ? (
            <>
              <strong>Your EHR decides here, not this page.</strong> Inside a chart every tool
              is offered, so that what you see matches the suggestions the chart makes beside
              it.
            </>
          ) : (
            <>
              <strong>Turning a tool off hides it from the chart.</strong> A narrower list
              models a site with less in place — it is not a gap to close.{' '}
              <Link to={patientBase} className="tool-config-effect__link">
                Open the patient chart &rarr;
              </Link>
            </>
          )}
        </p>
      </Card>

      <p className="tool-config-meta">
        <span className="tool-config-meta-count">
          {enabledCount} of {launchableCount} on
        </span>
        <span className="tool-config-meta-divider">&middot;</span>
        <span className="tool-config-meta-preset">
          {activePreset === 'custom'
            ? 'Customized'
            : PRESETS.find(p => p.id === activePreset)?.label ?? activePreset}
        </span>
      </p>

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
            {/* ⚠️ The stage's DESCRIPTION is gone, not reworded. It is the
                published definition and it is addressed to an EHR vendor —
                "The EHR finds a suicide-risk signal and determines whether
                more review is needed" (audit §1.9, §8.4). PR 5 replaced the
                same string on the rail with a clinician sentence; on a
                checklist the stage is a grouping and its title is the whole of
                what a grouping needs. */}
            <h4 className="tool-config-stage-title">{stage.title}</h4>
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
                    {/* ⚠️ The tool's `purpose` is gone too, and for the reason
                        the stage description is: all forty are published
                        strings ending in "Belongs to the … stage of the SPiER
                        pathway", and forty of them were 800 of this page's
                        1,501 words. `lib/toolCopy.ts` renders the clinical
                        first sentence where a reader is CHOOSING an instrument
                        — the stage page and *Why this?* — and this reader is
                        ticking a list of instruments they already run. */}
                    <span className="tool-row-name">
                      {tool.shortName ?? tool.name}
                      <span className="tool-row-id">{tool.id}</span>
                      <InclusionBadge className="tool-row-status" status={tool.inclusionStatus} />
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
