/**
 * Tools — the catalogue, as a list.
 *
 * Every instrument and workflow step SPiER models, grouped by the pathway
 * stage it belongs to, one line per tool: its name as a link to the tool's own
 * page, its status, its purpose. Forty links in about two screens.
 *
 * ── What this replaced (2026-09-20) ─────────────────────────────────────────
 *
 * Forty accordion cards, one line each; expanding one added five sections and
 * 1,600px, expanding another collapsed the first, and the form a reader would
 * actually try was a secondary button at the BOTTOM of the expanded detail,
 * after the FHIR examples. On a phone the page was seventeen screens with
 * nothing expanded, and its stage progress bar overflowed sideways with no
 * affordance (adoption-guide UX audit §2, §3, §4.3). The detail is now each
 * tool's page (`ToolPage.tsx`), with the form first; this page is the list.
 *
 * What the accordion carried that the list keeps, one click down rather than
 * deleted (the mock-EHR rule: task first, the rest in closed drawers):
 *
 *   - the stage-to-stage TRIGGERS, as a "how this stage hands off" drawer
 *     under each stage's list — they are catalogue prose about transitions the
 *     IG has not yet machine-encoded, and nowhere else says them;
 *   - the Zero Suicide alignment, as a closing paragraph rather than a tinted
 *     callout above the list — it is context, not a caveat, and it was pushing
 *     the first tool below the fold.
 *
 * ── Rules this page is written against ──────────────────────────────────────
 *
 * ⚠️ A GUIDE SUB-PAGE: it renders inside AdoptionGuide's header, so no
 * PageHeader and no page title of its own, no padding and no width on the root
 * (`npm run check:template`). The section is `wide` (it was for the accordion
 * grid; the list keeps it so the tool page beside it does not change measure
 * with the chrome), so every run of prose caps itself at the reading measure.
 *
 * ⚠️ The stage anchors are `#stage-<stage id>` and stay so: `/guide/pathway`
 * forwards them here (it served this catalogue before it was the pathway), and
 * the stage list at the top links them. `useScrollToHash` scrolls a cold deep
 * link on mount.
 *
 * ⚠️ The two links into other guide sections are route LITERALS so that
 * `check:surface-links` can read them; the forty tool links are computed from
 * the catalog, which that gate cannot see — `PatientJourney.test.tsx` asserts
 * one per tool instead. The reader is named in the first sentence, and the
 * prose before the first stage heading stays under the audit's cap (§5).
 *
 * The component keeps its historical name: the file is linked by path from
 * two plan documents, and the route table and three gates read it by that
 * name. It is the Tools catalogue.
 */
import { Link } from 'react-router-dom'
import { STAGES, TOOLS, groupToolsByStage, triggersFromStage, type StageTrigger, type Tool } from '@spier/core/data/catalog'
import { useScrollToHash } from '@spier/app-shell/hooks/useScrollToHash'
import { Disclosure } from '@spier/ui/Disclosure'
import { EmptyState } from '@spier/ui/EmptyState'
import { Pill, type PillTone } from '@spier/ui/Pill'
import { guideHref } from '../data/guideSections'
import { guideToolHref, toolForms } from '../data/toolForms'
import '../css/PatientJourney.css'

const STATUS_LABELS: Record<Tool['inclusionStatus'], string> = {
  core: 'Core',
  optional: 'Optional',
  future: 'Future',
}

const STATUS_TONE: Record<Tool['inclusionStatus'], PillTone> = { core: 'success', optional: 'info', future: 'neutral' }

/**
 * The first sentence of a tool's purpose. The catalogue's purposes run to two
 * sentences, and the second usually restates the stage — "Belongs to the
 * Identify Possible Risk stage" — which the heading above the row already says.
 * The whole purpose is the tool page's lede.
 */
function firstSentence(text: string): string {
  const m = /^(.*?[.!?])(?:\s|$)/.exec(text)
  return m ? m[1] : text
}

function TriggerRows({ triggers }: { triggers: StageTrigger[] }) {
  return (
    <ul className="tools-index__triggers">
      {triggers.map((t) => (
        <li key={t.id} className="tools-index__trigger">
          <span className="tools-index__trigger-event">{t.event}</span>
          <span className="tools-index__trigger-condition">{t.condition}</span>
          <span className="tools-index__trigger-action">{t.action}</span>
        </li>
      ))}
    </ul>
  )
}

export function PatientJourney() {
  // Scroll to a #stage-… section on mount (cold deep-link) and on hash change.
  useScrollToHash()
  const groups = groupToolsByStage(TOOLS)

  return (
    <div className="tools-index">
      <p className="tools-index__lede">
        If you are wiring SPiER into an EHR, this is every instrument and workflow step it models:{' '}
        {TOOLS.length} tools across the {STAGES.length} stages of the pathway. Each is a page of its own, with
        the form in front and what it writes behind.
      </p>
      <p className="tools-index__aside">
        For the same catalogue scored &mdash; where each tool is in the build, and how deeply it integrates
        &mdash; see <Link to="/guide/tools/readiness">Adoption Readiness</Link>. For the protocol these tools
        serve, see the <Link to="/guide/pathway">Care Pathway</Link>.
      </p>

      <nav aria-label="Stages">
        <ol className="tools-index__stage-list">
          {STAGES.map((stage, idx) => (
            <li key={stage.id}>
              <a href={`#${guideHref('tools')}#stage-${stage.id}`} className="tools-index__stage-link">
                <span className="tools-index__stage-n" aria-hidden="true">{idx + 1}</span>
                {stage.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {groups.map(({ stage, tools }, idx) => {
        const triggers = triggersFromStage(stage.id)
        const handoffs = triggers.filter((t) => t.toStageId && t.toStageId !== stage.id)
        const ongoing = triggers.filter((t) => !t.toStageId)
        const next = STAGES[idx + 1]
        return (
          <section
            key={stage.id}
            id={`stage-${stage.id}`}
            className="tools-index__stage"
            aria-labelledby={`stage-${stage.id}-title`}
          >
            <div className="tools-index__stage-head">
              <span className="tools-index__stage-number" aria-hidden="true">{idx + 1}</span>
              <div>
                <h3 id={`stage-${stage.id}-title`} className="tools-index__stage-title">{stage.title}</h3>
                <p className="tools-index__stage-desc">{stage.description}</p>
              </div>
            </div>

            {tools.length > 0 ? (
              <ul className="tools-index__list">
                {tools.map((tool) => (
                  <li key={tool.id} className={`tools-index__row tools-index__row--${tool.inclusionStatus}`}>
                    <Link to={guideToolHref(tool.id)} className="tools-index__name">{tool.name}</Link>
                    <span className="tools-index__badges">
                      <Pill size="sm" tone={STATUS_TONE[tool.inclusionStatus]}>{STATUS_LABELS[tool.inclusionStatus]}</Pill>
                      {/* Which rows have a form to fill in — 32 of 40, sharing
                          29 forms — so a reader who came to try one is not sent
                          to a page that says "no form yet". */}
                      {toolForms(tool).length > 0 && <Pill size="sm" variant="label" tone="sky">Form</Pill>}
                    </span>
                    <span className="tools-index__purpose">{firstSentence(tool.purpose)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>No tools are catalogued at this stage yet.</EmptyState>
            )}

            {(handoffs.length > 0 || ongoing.length > 0) && (
              <Disclosure
                className="tools-index__handoff"
                variant="quiet"
                summary="How this stage hands off"
                hint={triggers.length}
              >
                {handoffs.length > 0 && next && (
                  <>
                    <p className="tools-index__trigger-group">To {next.title}</p>
                    <TriggerRows triggers={handoffs} />
                  </>
                )}
                {ongoing.length > 0 && (
                  <>
                    <p className="tools-index__trigger-group">Ongoing</p>
                    <TriggerRows triggers={ongoing} />
                  </>
                )}
              </Disclosure>
            )}
          </section>
        )
      })}

      <p className="tools-index__zero-suicide">
        SPiER&rsquo;s {STAGES.length} technical stages are a FHIR-native instantiation of the workflow layers
        of the{' '}
        <a href="https://zerosuicide.edc.org/" target="_blank" rel="noopener noreferrer">Zero Suicide</a>{' '}
        framework: stages 1&ndash;3 model <em>Identify</em>, stage 4 <em>Engage</em>, stages 5&ndash;6{' '}
        <em>Transition</em>, stage 7 <em>Treat</em> and stage 8 <em>Improve</em>. Its organizational layers
        (<em>Lead</em>, <em>Train</em>) are outside an EHR pathway&rsquo;s scope.
      </p>
    </div>
  )
}
