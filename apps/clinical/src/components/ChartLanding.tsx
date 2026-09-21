/**
 * The chart's landing screen: one instruction, and two ways off it.
 *
 * ── What it replaces ───────────────────────────────────────────────────────
 *
 * Until 2026-09-21 a clinician launched into a patient's chart met a rail of
 * eight stages and had to READ it to find out what to do (clinical-app audit
 * §1.5, §4.1). PR 3 fixed what the chart recommends — one obligation, from the
 * published pathway, and a step that has been done stops being recommended —
 * but the shape was unchanged: the answer was still a card somewhere inside a
 * rail grouped by stage, which on Sarah Patel's chart put the problem-list
 * prompt above the thing she was actually owed.
 *
 * This is the shape. In order, and with nothing above it:
 *
 *   who            the identity strip, drawn by the CHROME rather than here —
 *                  see below
 *   do this now    one card: the act as its title, the trigger as one sentence,
 *                  one button, and the rest of what the tier owes as one line
 *                  of text under it
 *   why this?      one link, to the page that holds the reasoning (§4.2)
 *   where · what   two links with a fact each, into the rail and the record
 *
 * ⚠️ **"Who" is the chrome's line, not a second one here.** Audit §4.7: the
 * launch chrome's patient banner and the landing screen's "who" line are ONE
 * strip. `LaunchShell` draws `PatientBanner` above the page and `PanelShell`
 * draws the dense identity strip (including, since §1.7, on a narrow panel the
 * host said it had a banner for) — so a "who" line rendered here would be the
 * duplicate the SMART parameter exists to prevent, one inch lower.
 *
 * ⚠️ **It decides nothing.** Every word of the card comes from
 * `evaluatePathway` — the act, the trigger sentence, the also-due list, the
 * tool. This file chooses layout. The one judgement it makes is the launch
 * button's absence: a site that has not enabled the tool still reads what is
 * due (`cards.ts` makes the same call, in the same words).
 */
import { Link } from 'react-router-dom'
import type { PathwayEvaluation } from '@spier/core/lib/pathwayEvaluation'
import { Button } from '@spier/ui/Button'
import { Card } from '@spier/ui/Card'
import '../css/ChartLanding.css'

/** The in-page anchors the two links land on. PR 5 makes them pages. */
export const WHERE_ANCHOR = 'activity'
export const ON_FILE_ANCHOR = 'on-file'

/**
 * The card's heading is "Nothing is due", and the evaluator's own sentence for
 * a clear chart opens with the same three words — it is written to stand alone
 * on the wire and in the CDS card's detail, where nothing above it has said so
 * yet. Under this heading it reads twice, so the heading's copy is dropped from
 * the sentence rather than from the evaluator, which owes the other consumers
 * the whole thing.
 */
const NOTHING_DUE = 'Nothing is due'

function withoutLeadingNothingDue(reason: string): string {
  const prefix = `${NOTHING_DUE}. `
  return reason.startsWith(prefix) ? reason.slice(prefix.length) : reason
}

export function ChartLanding({
  evaluation,
  isToolEnabled,
  stepLabel,
  recordCount,
  onJump,
}: {
  evaluation: PathwayEvaluation
  isToolEnabled: (id: string) => boolean
  /** Where the patient is, as the rail's link says it: "Step 3 of 8". */
  stepLabel: string
  recordCount: number
  /** Scrolls to an in-page anchor without losing the route's patient id. */
  onJump: (anchor: string) => void
}) {
  const { primary, alsoDue, reason } = evaluation
  const tool = primary?.tool ?? null
  const launchable = tool && isToolEnabled(tool.id) ? tool : null

  return (
    <section className="chart-landing">
      <Card
        as="section"
        accent
        className={`chart-landing__now chart-landing__now--${primary ? primary.urgency : 'clear'}`}
      >
        {/* `<h3>` because `PageHeader` owns page-title typography and section
            headings start below it — `docs/internals/css-and-page-template.md`.
            In panel chrome there is no page header at all and this is the first
            thing on the screen, which is the point. */}
        <h3 className="chart-landing__act">{primary ? primary.title : NOTHING_DUE}</h3>
        <p className="chart-landing__trigger">
          {primary ? primary.reason : withoutLeadingNothingDue(reason)}
        </p>

        {/* A step with nothing to launch is a standing instruction — "at every
            contact, ask" — and its published description IS the act, so
            dropping it would leave a heading with no instruction under it. A
            step whose tool is merely turned off says nothing extra: the site
            can turn it on, and the words are already above. */}
        {primary && !tool && <p className="chart-landing__instruction">{primary.description}</p>}

        {launchable && (
          <p className="chart-landing__launch">
            <Button to={launchable.path} variant="primary">
              {launchable.label}
            </Button>
          </p>
        )}

        {/* The rest of what the tier owes, as ONE line of text. They were cards
            on the rail until this change, which is how a chart that owes three
            things came to be longer than one that owes nothing (§4.5). */}
        {alsoDue.length > 0 && (
          <p className="chart-landing__also">
            <span className="chart-landing__also-label">Also due</span>{' '}
            {alsoDue.map(o => o.title).join(' · ')}
          </p>
        )}
      </Card>

      {primary && (
        <p className="chart-landing__why">
          <Link to="/patient/why">Why this?</Link>
        </p>
      )}

      <p className="chart-landing__ways">
        <span className="chart-landing__way">
          <Button variant="link" onClick={() => onJump(WHERE_ANCHOR)}>
            Where this patient is
          </Button>
          <span className="chart-landing__fact">{stepLabel}</span>
        </span>
        <span className="chart-landing__way">
          <Button variant="link" onClick={() => onJump(ON_FILE_ANCHOR)}>
            What&rsquo;s on file
          </Button>
          <span className="chart-landing__fact">
            {recordCount} {recordCount === 1 ? 'record' : 'records'}
          </span>
        </span>
      </p>
    </section>
  )
}
