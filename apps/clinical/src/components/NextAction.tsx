/**
 * The one thing the published pathway owes this record, rendered inside the
 * stage it belongs to.
 *
 * ── Where it came from ─────────────────────────────────────────────────────
 *
 * This was `ChartLanding` — a card at the top of `/patient/record` with the
 * stage list a page away behind a link. The chart now opens on the pathway
 * itself (Brad, 2026-09-22), so the obligation moved into the open stage rather
 * than sitting above it: *what do I do* and *where am I* stopped being two
 * screens, and the act is read where the stage it satisfies already is.
 *
 * ⚠️ **It decides nothing.** Every word comes from `evaluatePathway` — the act,
 * the trigger sentence, the published description, the also-due list, the tool.
 * This file chooses layout. The one judgement it makes is the launch button's
 * absence: a site that has not enabled the tool still reads what is due
 * (`cards.ts` makes the same call, in the same words).
 *
 * ⚠️ **The description is printed even when there is a button**, which the
 * landing card deliberately did not do ("a card with a launch does not repeat
 * it", `pathwayEvaluation.ts`). That rule was written for a card at the top of
 * a chart, where the act's title and one trigger sentence were the whole budget.
 * Inside an open stage the reader has asked what this step is, and the published
 * description is the protocol's own answer — a heading and a button with nothing
 * between them is what "there's no clear action" looked like from the other side
 * (Brad, 2026-09-22).
 */
import { Link } from 'react-router-dom'
import type { PathwayEvaluation } from '@spier/core/lib/pathwayEvaluation'
import { Button } from '@spier/ui/Button'
import '../css/NextAction.css'

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

export function NextAction({
  evaluation,
  isToolEnabled,
}: {
  evaluation: PathwayEvaluation
  isToolEnabled: (id: string) => boolean
}) {
  const { primary, alsoDue, reason } = evaluation
  const tool = primary?.tool ?? null
  const launchable = tool && isToolEnabled(tool.id) ? tool : null

  return (
    <div className={`next-action next-action--${primary ? primary.urgency : 'clear'}`}>
      {/* `<h5>`: the stage node's title is the `<h4>` this sits under, which is
          itself under `PageHeader`'s `<h2>` — see
          `docs/internals/css-and-page-template.md`. */}
      <h5 className="next-action__act">{primary ? primary.title : NOTHING_DUE}</h5>
      <p className="next-action__trigger">
        {primary ? primary.reason : withoutLeadingNothingDue(reason)}
      </p>

      {primary && <p className="next-action__instruction">{primary.description}</p>}

      {launchable && (
        <p className="next-action__launch">
          <Button to={launchable.path} variant="primary">
            {launchable.label}
          </Button>
        </p>
      )}

      {/* The rest of what the tier owes, as ONE line of text. They were cards on
          the rail until the landing screen existed, which is how a chart that
          owed three things came to be longer than one that owed nothing. */}
      {alsoDue.length > 0 && (
        <p className="next-action__also">
          <span className="next-action__also-label">Also due</span>{' '}
          {alsoDue.map(o => o.title).join(' · ')}
        </p>
      )}

      {primary && (
        <p className="next-action__why">
          <Link to="/patient/why">Why this?</Link>
        </p>
      )}
    </div>
  )
}
