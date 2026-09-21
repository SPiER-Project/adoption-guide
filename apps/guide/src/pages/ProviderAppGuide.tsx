/**
 * ProviderAppGuide — what the clinician-facing SMART app is, and how the pathway
 * decides what it recommends.
 *
 * ── The shape, and why all three "see it running" pages share it ───────────
 *
 * One screen, one pattern (adoption-guide audit §4.4, applied 2026-09-20):
 * what it is in two sentences, what you see in four bullets, the button, then
 * two closed `Disclosure`s — *How it decides* and *What this does and does not
 * prove*. This page measured 981 words in 2.9 screens with four `Notice`s, two
 * of them warnings, and the audit's finding was not the length on its own: the
 * hedges were **equal-weighted with the instruction**. The mock-EHR pass
 * settled that pattern — task first, caveats demoted into closed drawers,
 * **never deleted** — and every word of all four Notices survives inside the
 * two drawers below.
 *
 * ⚠️ **Closed is not gone, and neither drawer may be emptied.** The second one
 * carries §1 guardrail 3 — *the host is ours, so none of this is evidence of
 * interoperability* — which does not expire with a release.
 *
 * ── Why it is the Provider App and not the Patient App ──────────────────────
 *
 * Renamed 2026-09-17 (Brad). The old name named the app's SUBJECT; a clinician
 * is its USER. It is launched from a patient's chart, by a chart activity or a
 * CDS Hooks card, and the person holding it is the person treating the patient.
 *
 * ⚠️ **The old name is not free for reuse by accident.** It now means the
 * patient-facing app SPiER does not ship — said on the page too, in the second
 * drawer. `/guide/patient-app` remains a redirect because it was published and
 * is what `/patient/chart` pointed at. The page no longer dates the rename:
 * audit §5 rule 3, no repo vocabulary in reader copy, and a rename date is the
 * project's history rather than the reader's business.
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
 * publishes the protocol, `/settings` sets what a site enabled (a page of the
 * APP since 2026-09-15, not of this guide), and the chart renders the cards —
 * three pages each holding a third of one mechanism. The *How it decides*
 * drawer is the join, and it is written to point at those three rather than
 * restate them.
 *
 * No `PageHeader`: the `/guide` layout draws it from the section list, so
 * sections start at `<h3>` and declare no width (CLAUDE.md, one page template).
 */
import { Link } from 'react-router-dom'
import { DEMO_CHART_PICKS, MOCK_EHR_URL } from '../data/surfaces'
import '../css/SurfaceGuide.css'
import { Button } from '@spier/ui/Button'
import { Disclosure } from '@spier/ui/Disclosure'

export function ProviderAppGuide() {
  return (
    <div className="surface-guide">
      <section className="surface-guide__intro">
        <p>
          The Provider App is a <strong>SMART on FHIR app a clinician launches from a
          patient&rsquo;s chart</strong> &mdash; from a chart activity, or from a CDS Hooks card
          that names the instrument, so the panel opens already scoped to the tool the pathway
          called for.
        </p>
        <p>
          It keeps nothing of its own. Every stage, score and recommendation in it is derived from
          what is already in the record, which is what lets the same app run against any server
          holding the right resources.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">What the clinician sees</h3>
        <ul className="surface-guide__list">
          <li>
            <strong>Where this patient is on the pathway</strong> &mdash; the eight stages as a
            rail, each marked not started, active or complete from what is on file.
          </li>
          <li>
            <strong>What to do next</strong> &mdash; cards naming the specific tool the pathway
            calls for, each one launchable rather than a note.
          </li>
          <li>
            <strong>What has already been done</strong> &mdash; assessments, safety plans and
            follow-up activity, grouped by the stage each belongs to.
          </li>
          <li>
            <strong>What was saved back</strong> &mdash; after a submit, which of the writes landed
            in the EHR, itemised by resource type.
          </li>
        </ul>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">See it running</h3>
        <p>
          The app is launched, not browsed, so it wants a host. SPiER runs a stand-in vendor EHR for
          exactly this &mdash; open a chart in it and press <strong>Launch SPiER</strong>.
        </p>
        <p>
          <Button href={MOCK_EHR_URL} target="_blank" rel="noopener noreferrer" accent arrow>
            Open the Demo EHR
          </Button>
        </p>
        <p>
          Three charts are worth opening first:{' '}
          {DEMO_CHART_PICKS.map((pick, i) => (
            <span key={pick.name}>
              {i > 0 && ', '}
              <strong>{pick.name}</strong> ({pick.situation})
            </span>
          ))}
          .
        </p>
      </section>

      {/* The two drawers. Everything the four Notices used to say inline, at the
          weight the audit asked for: one line each until a reader wants it. */}
      <section className="surface-guide__section surface-guide__drawers">
        <Disclosure summary="How it decides what to recommend" hint="four inputs, three of them artifacts">
          <p>
            Nothing here is hand-written per patient. Four inputs combine into one answer, and three
            of the four are artifacts an implementation can inspect or change:
          </p>
          <ol className="surface-guide__steps">
            <li>
              <strong>The published pathway.</strong> Screen &rarr; positive-screen gate &rarr;
              assess &rarr; branch by risk tier, published as a FHIR <code>PlanDefinition</code>.
              The app reads it rather than restating it; the same artifact is rendered on the{' '}
              <Link to="/guide/pathway">Care Pathway</Link> page.
            </li>
            <li>
              <strong>The tool catalog.</strong> Each tool is an <code>ActivityDefinition</code>{' '}
              declaring the stage it serves and the Questionnaire it uses. That is how a recorded
              answer set is attributed to a stage: the response names its Questionnaire, the
              Questionnaire belongs to a tool, and the tool declares the stage. See{' '}
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
              does not use is a recommendation nobody can act on, so it is dropped. That is set on
              the app&rsquo;s own Settings page &mdash; a page of the SMART app, not of this guide.
            </li>
          </ol>
          <p>
            The result is emitted as real <strong>CDS Hooks 2.0 cards</strong>, from the same
            builder that serves SPiER&rsquo;s hosted{' '}
            <Link to="/guide/cds-service">CDS service</Link>. An EHR calling the endpoint and a
            clinician looking at the panel get the same recommendation, because there is one
            implementation of the rule rather than two.
          </p>
          <p>
            <strong>One deliberate exception.</strong> Inside a host chart, every catalogued tool is
            offered regardless of that preset. The host&rsquo;s <em>own</em> cards come from the
            hosted CDS service, which is stateless and cannot read this browser&rsquo;s storage; a
            panel honouring a preset the host&rsquo;s cards did not would put two different answers
            about one patient side by side. In a real chart the host <em>is</em> the site, and a
            per-site toolset the service could read is what would replace this exception.
          </p>
        </Disclosure>

        <Disclosure
          summary="What this does and does not prove"
          hint="the host is ours"
        >
          <ul className="surface-guide__list">
            <li>
              <strong>The SMART handshake, the reads and the writes are real</strong> &mdash; and
              they run against a server this project wrote. What the demo shows is that the app
              behaves correctly as a guest in someone else&rsquo;s chart; a portability claim needs
              a server nobody here controls. The full version of that caveat is on the{' '}
              <Link to="/guide/dashboard">Population Dashboard</Link> page.
            </li>
            <li>
              <strong>This is the clinician&rsquo;s app, not the patient&rsquo;s.</strong> A
              patient-facing surface &mdash; something a person opens for their own safety plan or
              caring contacts &mdash; is a separate app, and SPiER does not ship one today. The
              name &ldquo;Patient App&rdquo; is reserved for it.
            </li>
            <li>
              <strong>You will not see any FHIR in it, deliberately.</strong> A clinician filling in
              a C-SSRS has no use for the wire format, so the app shows none of it &mdash; not
              beside an instrument, not on a recorder, not under a document in the chart. That is
              what makes it something a health system could adopt rather than a demo with the
              scaffolding left up. The wire format lives here instead: each tool&rsquo;s page under{' '}
              <Link to="/guide/tools">Tools</Link> opens the same form with its Questionnaire, its
              QuestionnaireResponse and its writeback report beside it, and the{' '}
              <Link to="/guide/data-dictionary">Data Dictionary</Link> holds the contract.
            </li>
            <li>
              <strong>Without a host there is no chart to open.</strong> The patient data lives in
              the EHR and this guide holds none &mdash; but the instruments still fill in, with
              nothing behind them, from <Link to="/guide/tools">Tools</Link>.
            </li>
          </ul>
        </Disclosure>
      </section>
    </div>
  )
}
