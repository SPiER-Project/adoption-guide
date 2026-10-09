/**
 * SavingToEhrGuide — the writeback ladder as an adoption choice (#637).
 *
 * ── What this page is for ───────────────────────────────────────────────────
 *
 * The guide already shows the ladder WORKING (each tool's page carries the
 * writeback report under inspection). Nothing told an adopter which rung to aim
 * for. The positioning the ladder was built around (2026-07, Brad): the SMART
 * app is the low-floor on-ramp, native EHR documentation is the recommended end
 * state. This page states that, as choices a site makes, not as the mechanism.
 *
 * ── Where it lives ──────────────────────────────────────────────────────────
 *
 * A SUBSECTION of Provider App (`provider-app/saving-to-the-ehr`), not a
 * sidebar row: it is the second view of one section, reached from the "What
 * was saved back" bullet there, like the published protocol under Care
 * Pathway. Declared in `guideSections.ts`, so the boundary and route gates
 * walk it.
 *
 * ── The rungs are typed, not restated ───────────────────────────────────────
 *
 * `RUNGS` is keyed by `WriteTier` and checked with `satisfies`, and each row's
 * resource type is read from `WRITE_TIER_RESOURCE` — the same table
 * `buildWritePlan` builds its steps from. A rung added to or removed from the
 * ladder is a compile error here. ⚠️ Tier 1 is the QuestionnaireResponse and
 * Tier 2 the Observation; a commit message from the ladder's first draft has
 * them the other way round, and the code is right.
 *
 * ⚠️ **There is no problem-list rung**, and the first drawer says so. The
 * ladder had a Tier-3 Condition proposal until it was retired (a screen never
 * becomes a Condition). Do not describe one.
 *
 * The readable copy is written when a higher rung did not land, AND for every
 * form that produces no scores (#638, decided 2026-10-09): an EHR that stores a
 * completed form without displaying it would otherwise show nothing readable
 * for a safety plan. The "How it decides" drawer states it.
 *
 * Same shape as the three "see it running" pages (adoption-guide audit §4.4):
 * what it is, the list, then closed drawers — caveats demoted, never deleted.
 * No `PageHeader`: the guide layout draws it, so sections start at `<h3>`.
 */
import { Link } from 'react-router-dom'
import { WRITE_TIER_RESOURCE, type WriteTier } from '@spier/core/lib/writeback/types'
import '../css/SurfaceGuide.css'
import { Disclosure } from '@spier/ui/Disclosure'

interface Rung {
  label: string
  body: string
}

/** One entry per rung of the ladder, in the order a site climbs it. */
const RUNGS = {
  0: {
    label: 'A readable copy',
    body: 'The completed form as a document, with its answers attached as data. Any EHR that stores documents can hold it, so this is the floor: a site with nothing else still gets every screen into the chart.',
  },
  1: {
    label: 'The completed form',
    body: 'Every answer as structured data, the form’s own record. Written first, because everything above it points back to it.',
  },
  2: {
    label: 'Scores and risk level',
    body: 'The total, the item scores and the shared risk tier as results the EHR can trend, alert on and report.',
  },
} as const satisfies Record<WriteTier, Rung>

const CLIMB_ORDER: WriteTier[] = [0, 1, 2]

export function SavingToEhrGuide() {
  return (
    <div className="surface-guide">
      <section className="surface-guide__intro">
        <p>
          When a clinician presses <strong>Save to the chart</strong>, the Provider App writes the
          result back on a <strong>ladder</strong>: the most useful form the EHR accepts, falling
          back to one any EHR can hold. A site can start on day one and climb.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">What it can write</h3>
        <ol className="surface-guide__steps">
          {CLIMB_ORDER.map(tier => (
            <li key={tier}>
              <strong>{RUNGS[tier].label}</strong> (<code>{WRITE_TIER_RESOURCE[tier]}</code>)
              &mdash; {RUNGS[tier].body}
            </li>
          ))}
        </ol>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">Where a site starts, and where it ends up</h3>
        <ul className="surface-guide__list">
          <li>
            <strong>Start with the app.</strong> Nothing has to be built in the EHR first: the
            app runs from the chart, and whatever the EHR accepts is what lands.
          </li>
          <li>
            <strong>End with native documentation.</strong> The recommended goal is an EHR that
            captures these instruments in its own forms and writes the same published shapes. The
            app is the bridge to that, not the destination &mdash; the pathway, the cards and the
            measures read the same resources either way.
          </li>
        </ul>
        <p>
          Each instrument&rsquo;s page under <Link to="/guide/tools">Tools</Link> shows what a save
          wrote, rung by rung.
        </p>
      </section>

      <section className="surface-guide__section surface-guide__drawers">
        <Disclosure summary="What it never writes" hint="the problem list is the clinician’s">
          <p>
            It never adds a problem-list entry. A screen is a signal that one may be warranted, not
            the assertion itself, so SPiER derives no <code>Condition</code> from a screen. When a
            problem is warranted, a <Link to="/guide/cds-service">CDS card</Link> prompts the
            clinician, who records it in the EHR. And nothing is written at all until the clinician
            presses Save &mdash; a submitted form shows its results first.
          </p>
        </Disclosure>

        <Disclosure summary="How it decides what to write" hint="the EHR says what it accepts">
          <p>
            Before writing, the app reads the EHR&rsquo;s <code>CapabilityStatement</code> and
            attempts a rung only if the EHR says it can create that type. If a rung is refused or
            fails, the readable copy carries the result instead. A form with no scores, such as a
            safety plan, always gets the readable copy too: an EHR may store the completed form
            without displaying it, and such a form has no results that would show instead.
          </p>
          <p>
            A rung that did not land is shown, never hidden or retried into looking complete. It is
            the useful signal: it says what this EHR cannot yet accept, which is the conversation an
            adopting site needs to have with its vendor.
          </p>
        </Disclosure>

        <Disclosure summary="What this does and does not prove" hint="two servers">
          <ul className="surface-guide__list">
            <li>
              <strong>Every rung has been exercised against the stand-in EHR SPiER runs</strong>,
              including one that refuses scores and one that accepts only documents, and the full
              save has run against the public SMART Health IT sandbox, a server SPiER did not
              write. That sandbox accepts everything, so a refused rung has only been seen on
              the stand-in.
            </li>
          </ul>
        </Disclosure>
      </section>
    </div>
  )
}
