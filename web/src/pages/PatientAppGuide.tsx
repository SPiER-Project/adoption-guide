/**
 * PatientAppGuide — what the patient-level SMART app is, and how the pathway
 * decides what it recommends.
 *
 * ── Why this page exists ────────────────────────────────────────────────────
 *
 * `/patient/chart` used to be the chart itself, on a guide URL, rendering
 * fourteen bundled demo patients. Decided 2026-09-09 (Brad): **the adoption
 * guide explains the tool and hosts the SMART apps; the mock EHR holds the
 * patient data and launches them.** So that URL now redirects here and the app
 * answers on `/patient/record`.
 *
 * ⚠️ **This page holds no patient data, and that is mechanically enforced.**
 * It is declared in `data/guideSections.ts`, which is what
 * `check:guide-boundary` derives the guide's page set from — the gate then walks
 * this module's imports transitively and fails on `@spier/demo-population`,
 * either concrete data source, or `useRegistrySlices`. Declaring the explainer
 * as a guide *section* rather than hand-rolling a route is the whole reason the
 * boundary is checkable rather than merely intended.
 *
 * ── What it owes, specifically ──────────────────────────────────────────────
 *
 * The brief was *"explain the patient-level smart app and how the care pathways
 * can be configured by the system to help recommend what to do."* That second
 * half is the one thing about SPiER no page states end to end: `/guide/pathway`
 * publishes the protocol, `/guide/tool-configuration` sets what a site enabled,
 * and the chart renders the cards — three pages each holding a third of one
 * mechanism. The "How it decides" section below is the join, and it is written
 * to point at those three rather than restate them.
 *
 * No `PageHeader`: the `/guide` layout draws it from the section list, so
 * sections start at `<h3>` and declare no width (CLAUDE.md, one page template).
 */
import { Link } from 'react-router-dom'
import { DEMO_CHART_PICKS, MOCK_EHR_URL } from '../data/surfaces'
import '../css/SurfaceGuide.css'

export function PatientAppGuide() {
  return (
    <div className="surface-guide">
      <section className="surface-guide__intro">
        <p>
          SPiER&rsquo;s patient-level surface is a <strong>SMART on FHIR app</strong>. An EHR
          launches it from a patient&rsquo;s chart; it docks as a panel beside that chart, reads the
          patient&rsquo;s record over FHIR, and writes back what the clinician records.
        </p>
        <p>
          It keeps nothing of its own. Every stage, score and recommendation you see in it is
          derived from what is already in the record, which is what lets the same app run against
          any server that holds the right resources.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">What the clinician sees</h3>
        <ul className="surface-guide__list">
          <li>
            <strong>Where this patient is on the pathway</strong> &mdash; a rail across the eight
            stages, with each one marked not started, active or complete based on what is on file.
          </li>
          <li>
            <strong>What to do next</strong> &mdash; recommendation cards naming the specific tool
            the pathway calls for, each one a launchable action rather than a note.
          </li>
          <li>
            <strong>What has already been done</strong> &mdash; the patient&rsquo;s assessments,
            safety plans and follow-up activity grouped by the stage each belongs to.
          </li>
          <li>
            <strong>What was saved back</strong> &mdash; after a submit, which of the things SPiER
            tried to write actually landed in the EHR, itemised by resource type.
          </li>
        </ul>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">How it decides what to recommend</h3>
        <p>
          Nothing here is hand-written per patient. Four inputs combine into one answer, and three
          of the four are artifacts an implementation can inspect or change:
        </p>
        <ol className="surface-guide__steps">
          <li>
            <strong>The published pathway.</strong> Screen &rarr; positive-screen gate &rarr;
            assess &rarr; branch by risk tier, published as a FHIR{' '}
            <code>PlanDefinition</code>. The app reads it rather than restating it &mdash; the same
            artifact is rendered as-is on the{' '}
            <Link to="/guide/pathway">Care Pathway</Link> page.
          </li>
          <li>
            <strong>The tool catalog.</strong> Each tool is an{' '}
            <code>ActivityDefinition</code> declaring the stage it serves and the Questionnaire it
            uses. That is how a recorded answer set is attributed to a stage: the response names its
            Questionnaire, the Questionnaire belongs to a tool, and the tool declares the stage. See{' '}
            <Link to="/guide/tools">Tools</Link>.
          </li>
          <li>
            <strong>The patient&rsquo;s own record.</strong> What is on file decides which stages
            are complete and which is active. A positive PHQ-9 item 9 with no assessment recorded
            is not a note somewhere &mdash; it is the reason the next card says{' '}
            <em>clarify risk</em>.
          </li>
          <li>
            <strong>What this implementation has turned on.</strong> A card naming a tool the site
            does not use is a recommendation nobody can act on, so it is dropped.{' '}
            <Link to="/guide/tool-configuration">Tool Configuration</Link> is where that is set.
          </li>
        </ol>
        <p>
          The result is emitted as real <strong>CDS Hooks 2.0 cards</strong>, from the same builder
          that serves SPiER&rsquo;s hosted <Link to="/guide/cds-service">CDS service</Link>. That is
          deliberate: an EHR calling the endpoint and a clinician looking at the panel get the same
          recommendation, because there is one implementation of the rule rather than two.
        </p>
        <p className="surface-guide__note">
          <strong>One deliberate exception.</strong> Inside a host chart, every catalogued tool is
          offered regardless of the Tool Configuration preset. That preset is implementer equipment
          &mdash; it is set on a guide page the panel cannot reach and stored in the app&rsquo;s own
          browser storage, not in anything the EHR said. In a real chart the host <em>is</em> the
          site, so letting a sandbox setting from another surface suppress a clinician&rsquo;s
          recommendation would be arbitrary.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">See it running</h3>
        <p>
          The app is launched, not browsed &mdash; so the way to see it properly is from a host.
          SPiER runs a stand-in vendor EHR for exactly this:
        </p>
        <p>
          <a
            className="surface-guide__cta"
            href={MOCK_EHR_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the Demo EHR &rarr;
          </a>
        </p>
        <p>Open a chart, press <strong>Launch SPiER</strong>. Three charts are worth opening first:</p>
        <ul className="surface-guide__list">
          {DEMO_CHART_PICKS.map(pick => (
            <li key={pick.name}>
              <strong>{pick.name}</strong> &mdash; {pick.situation}. Shows {pick.shows}.
            </li>
          ))}
        </ul>
        <p className="surface-guide__warn">
          <strong>That host is ours, so nothing seen there is evidence of interoperability.</strong>{' '}
          The SMART handshake, the FHIR reads and the writes are real, and they run against a server
          this project wrote. What it demonstrates is that the app works as a guest in someone
          else&rsquo;s chart; a portability claim needs a server we do not control.
        </p>
        <p>
          With no host connected the app still runs the instruments and recorders against sample
          data, which is the way to walk a workflow without a launch:{' '}
          <Link to="/patient/record">open the demo chart</Link>.
        </p>
      </section>
    </div>
  )
}
