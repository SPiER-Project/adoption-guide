/**
 * PopulationDashboardGuide — what the population dashboard is for, and the
 * honest state of the live one.
 *
 * ── Why this page exists ────────────────────────────────────────────────────
 *
 * `/population` used to be the caseload table itself, on a guide URL, computed
 * from fourteen patients compiled into the guide's own JavaScript. Decided
 * 2026-09-09 (Brad): that URL explains the dashboard *product* and points at the
 * mock EHR to see it in action; the live caseload answers on
 * `/population/caseload`.
 *
 * Same boundary property as its sibling `PatientAppGuide`: declared in
 * `data/guideSections.ts`, so `check:guide-boundary` walks this module
 * transitively and fails if it ever reaches the fixtures or a data source. This
 * page therefore cannot show a single number about a real cohort, which is the
 * point — the numbers belong where the patients are.
 *
 * ⚠️ **The honesty paragraph is not hedging and must not be softened — but it
 * has now changed TWICE, and what it says is different each time.** Its history,
 * because the rule is that it changes in the commit that makes it false:
 *
 *   - Originally two reasons the embedded caseload was not a SMART launch: the
 *     frame carried no launch context, *and* every token the mock could issue
 *     was bound to one patient, so a caseload was unservable in principle.
 *   - After Phase A (#489) the mock could mint a worklist grant, so only the
 *     first reason survived.
 *   - Now (Phase B/C) there is no frame: the host offers a real user-scoped
 *     launch, the app reads the roster from the server, and the claim that
 *     remains is the one §1 guardrail 3 never lets go of — **the host is ours,
 *     so none of this is evidence of interoperability.**
 *
 * That last claim does not expire with a phase. Do not delete it.
 */
import { Link } from 'react-router-dom'
import { MOCK_EHR_URL } from '../data/surfaces'
import '../css/SurfaceGuide.css'

const ISSUE_401_URL = 'https://github.com/SPiER-Project/adoption-guide/issues/401'

export function PopulationDashboardGuide() {
  return (
    <div className="surface-guide">
      <section className="surface-guide__intro">
        <p>
          The population dashboard is the other half of SPiER&rsquo;s clinical surface: an app that
          indexes <strong>across a patient panel</strong> and answers one question for each person
          on it &mdash; <em>is an action owed, and which one?</em>
        </p>
        <p>
          It is a work queue rather than a report. A report tells you how the panel did last
          quarter; this tells you who has a positive screen with no assessment behind it, whose
          safety plan was never written, and whose risk episode is overdue for review.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">What it computes</h3>
        <ul className="surface-guide__list">
          <li>
            <strong>A risk-tier census</strong> &mdash; how the panel distributes across the derived
            tiers, which is the number a host cannot compute for itself without SPiER&rsquo;s
            crosswalks.
          </li>
          <li>
            <strong>Alert groups</strong> &mdash; patients gathered by what is outstanding, so the
            list is actionable rather than merely sorted.
          </li>
          <li>
            <strong>A next step per patient</strong> &mdash; the same recommendation the{' '}
            <Link to="/guide/patient-app">patient-level app</Link> would show in that
            person&rsquo;s chart, from the same derivation, so a caseload and a chart cannot
            disagree.
          </li>
          <li>
            <strong>Pathway measures</strong> &mdash; the Stage-8 measures scored over the panel for
            a chosen period. See the <Link to="/population/measures">measure dashboard</Link>.
          </li>
        </ul>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">How it decides an action is owed</h3>
        <p>
          Per patient, the same four inputs the chart uses &mdash; the published{' '}
          <Link to="/guide/pathway">pathway</Link>, the{' '}
          <Link to="/guide/tools">tool catalog</Link>, that patient&rsquo;s record, and what the
          site has <Link to="/guide/tool-configuration">enabled</Link> &mdash; then grouped rather
          than rendered one at a time.
        </p>
        <p>
          The one rule that only matters at panel scale is <strong>cadence</strong>: the pathway
          gives each risk tier a reassessment interval, so a patient with nothing outstanding today
          can still be owed a review. That interval is published in the same{' '}
          <code>PlanDefinition</code> the pathway page renders, and a repo gate checks the app, the
          artifact and the CQL still agree on it.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">See it running</h3>
        <p>
          The mock EHR offers it the way a vendor hangs a worklist activity &mdash; a button beside
          its patient list, which mints the launch and opens the app:
        </p>
        <p>
          <a
            className="surface-guide__cta"
            href={MOCK_EHR_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the mock EHR demo &rarr;
          </a>
        </p>
        <p className="surface-guide__warn">
          <strong>A real SMART launch, and still not evidence of interoperability.</strong> The
          authorization is genuine &mdash; a user-scoped grant with no patient in context, so the
          app may read across the panel and is refused if it tries to write to anyone &mdash; and
          the roster and every chart read come from that server over FHIR. What it does not show is
          portability: <strong>the host is written and run by the same project as the app</strong>,
          so a handshake succeeding here says the app behaves correctly as a guest, not that it
          works against a server nobody here controls. That claim needs a third-party sandbox.
          Background in{' '}
          <a href={ISSUE_401_URL} target="_blank" rel="noopener noreferrer">
            issue #401
          </a>
          .
        </p>
        <p>
          With no host connected the same screen runs against sample patients, which is how to see
          the derivation without a launch:{' '}
          <Link to="/population/caseload">open the demo caseload</Link>.
        </p>
      </section>
    </div>
  )
}
