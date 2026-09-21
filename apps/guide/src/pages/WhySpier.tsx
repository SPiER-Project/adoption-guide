/**
 * WhySpier — the long form of what SPiER is doing and why, and the home of the
 * prose that used to make the front door 1,716 words.
 *
 * ── Why this page exists ────────────────────────────────────────────────────
 *
 * The adoption-guide UX audit (docs/plans/archive/adoption-guide-ux-audit-2026-09-20.md
 * §3, §4.1) found the Overview saying Capture → Translate → Act three times —
 * as three cards, as three numbered essays, and again in a section explaining
 * that the three were not the navigation — then giving the four surfaces five
 * paragraphs of prose followed by four cards making the same four points. The
 * front door now answers three questions and stops. The argument did not need
 * deleting, it needed a page of its own, and this is it.
 *
 * ⚠️ **Capture → Translate → Act is canonical in the IG**, on
 * `ig/input/pagecontent/how-to-read.md`. What is here is the same model in the
 * words a reader who has not opened a specification can follow; when the two
 * disagree, the IG is right and this page is the one to change.
 *
 * ⚠️ **The interoperability caveat is deliberately NOT on this page.** The
 * audit counted it on four pages at the weight of the instruction it followed
 * (§5 rule 2: one statement per site, linked from everywhere else). It is
 * stated once, on the Overview, under the demo path it qualifies — see the
 * note on `content/overview.ts`'s `start` section and the header of
 * `data/surfaces.ts`, which records why the claim itself is load-bearing.
 *
 * Boundary property shared with its two prose siblings, `ProviderAppGuide` and
 * `PopulationDashboardGuide`: declared in `data/guideSections.ts`, so
 * `check:guide-boundary` walks this module transitively and fails if it ever
 * reaches a fixture or a data source. The eight stages below come from the
 * pathway-stage CodeSystem through the catalog, which is a published artifact
 * and not patient data.
 */
import { Link } from 'react-router-dom'
import { STAGES } from '@spier/core/data/catalog/stages'
import { Notice } from '@spier/ui/Notice'
import { MOCK_EHR_LABEL } from '../data/surfaces'
import { IG_HREF } from '../content/renderInline'
import '../css/SurfaceGuide.css'

// The eight stages come from the pathway-stage CodeSystem via the catalog, so
// the page cannot drift from the published artifact. It rendered on the
// Overview until the rewrite; it belongs with the paragraph that explains why
// there are two vocabularies at all.
function PathwayStages() {
  return (
    <ol className="surface-guide__pathway">
      {STAGES.map(stage => (
        <li key={stage.id} className="surface-guide__pathway-stage">
          <span className="surface-guide__pathway-index">{stage.orderIndex + 1}</span>
          <span className="surface-guide__pathway-title">{stage.title}</span>
        </li>
      ))}
    </ol>
  )
}

export function WhySpier() {
  return (
    <div className="surface-guide">
      <section className="surface-guide__intro">
        <p>
          Everything that matters in suicide prevention currently lives only in human-readable
          form &mdash; validated screeners on paper, the equivalences between different tools in
          clinicians&rsquo; heads, response protocols in plain-text guidelines.
        </p>
        <p>
          SPiER&rsquo;s work is to encode each layer so software can act on it, in three steps that
          build on each other: <strong>Capture &rarr; Translate &rarr; Act</strong>.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">1. Capture &mdash; make the tools writable</h3>
        <p>
          HL7 is the standards body that defines how healthcare data is structured and exchanged,
          and FHIR is their modern standard. National standards like <strong>US Core</strong> and{' '}
          <strong>USCDI</strong> already cover the basics &mdash; demographics, diagnoses,
          medications &mdash; but they do not yet specify <em>how</em> suicide screeners, risk
          assessments and safety plans should be captured. So today every EHR captures that
          information a little differently: same questions, different shapes, which makes the data
          hard to share, hard to measure and hard to act on. That is the gap SPiER fills.
        </p>
        <p>
          SPiER translates each tool &mdash; the <strong>ASQ</strong>, <strong>Columbia</strong>,{' '}
          <strong>Stanley-Brown</strong> and others &mdash; into a single canonical FHIR shape, so
          the same instrument is recorded identically everywhere it is used. That work is
          contributed to the HL7 workgroups already shaping clinical data standards. The path is{' '}
          <strong>draft, test with partners, contribute to HL7, influence the published
          standard</strong>, paired with a coalition of provider organizations who can collectively{' '}
          <em>demand</em> that consistency from their EHR vendors.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">
          2. Translate &mdash; make different tools mutually intelligible
        </h3>
        <p>
          Partners do not all use the same instruments. One site screens with the ASQ, another with
          the Columbia, another with PHQ-9 Item 9 &mdash; and a result is useless to a system that
          cannot read the instrument behind it. SPiER defines an instrument-agnostic{' '}
          <strong>concept layer</strong>: a single common suicide-risk tier that every tool maps{' '}
          <em>into</em>, so a receiving system can act on a result{' '}
          <strong>without having to run the same tool that produced it</strong>.
        </p>
        <p>
          This mirrors the approach HL7&rsquo;s <strong>Gravity Project</strong> took for
          social-determinants screening. The derived concept is screening-level and{' '}
          <em>unconfirmed</em> &mdash; it flags a need for follow-up, not a diagnosis &mdash; and it
          is always linked back to the full-fidelity capture layer it came from. It is also
          SPiER&rsquo;s most contributable standards artifact.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">3. Act &mdash; make the response protocols executable</h3>
        <p>
          The clinical response to a positive screen already exists as written, endorsed
          guidelines. They just cannot fire on their own. SPiER encodes them as executable logic so
          the right next step surfaces at the right moment: an acute positive ASQ prompts a safety
          evaluation and a safety plan, a transition prompts a caring-contact follow-up.
        </p>
        <p>
          This is the frontier of SPiER&rsquo;s work, and notably an <em>encoding</em> problem
          rather than a <em>consensus</em> problem, because the protocol content is already
          settled. Throughout, <strong>SPiER recommends; the clinician, or the
          institution&rsquo;s configured policy, decides.</strong>
        </p>
      </section>

      {/* Two vocabularies run through the product and they are easy to mistake
          for competing taxonomies. They are orthogonal: Capture/Translate/Act
          is the artifact axis (canonical in the IG's how-to-read page), the
          eight stages are the clinical axis (canonical in the pathway-stage
          CodeSystem, via FSH). Navigation follows the clinical axis, so say so
          once, here, rather than leaving a reader to reconcile them. */}
      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">How the three steps meet the eight stages</h3>
        <p>
          <strong>Capture &rarr; Translate &rarr; Act</strong> describes what SPiER does to the{' '}
          <em>artifacts</em>. It is not what you navigate by. Everything here is organized around
          the thing a clinician actually moves through &mdash; the{' '}
          <strong>eight-stage Suicide Safer Care Pathway</strong>, which is the common entry point
          for every partner conversation and the vocabulary the provider app, the caseload and the
          measure dashboard all use:
        </p>
        <PathwayStages />
        <p>
          Every stage is a place a patient can be, and each of the three steps cuts across all
          eight of them: a stage needs its instruments captured, its results translated and its
          next action made executable. The{' '}
          <Link to="/guide/pathway">Care Pathway</Link> renders the protocol itself, and the{' '}
          <Link to="/guide/tools">Tools</Link> catalog holds the stage-by-stage instrument detail.
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">Four surfaces, and which one to open first</h3>
        <p>
          <strong>SPiER is not one application, and the confusing part is which piece you are
          looking at.</strong> Four things, and only one of them is a place to start.
        </p>
        <p>
          <strong>The {MOCK_EHR_LABEL} holds the patient data.</strong> It is a stand-in for a
          vendor chart &mdash; fourteen synthetic patients, a real SMART on FHIR authorization
          server, and a launch button on every chart. Nothing about it is SPiER, and it says so on
          every page.
        </p>
        <p>
          <strong>This adoption guide explains the tools and hosts the apps.</strong> When you
          press <em>Launch SPiER</em> over there, the panel that docks on the right is served from
          here. The guide holds no patient data of its own: what the panel renders, it read from
          that server. What each app does once launched is described under{' '}
          <Link to="/guide/provider-app">Provider App</Link> and{' '}
          <Link to="/guide/dashboard">Population Dashboard</Link>.
        </p>
        <p>
          <strong>The CDS service is the same recommendations without an embed.</strong> An EHR
          that wants the next-step cards and nothing else registers one URL and renders what comes
          back &mdash; no panel, no iframe. Those cards come from the same builder the panel uses,
          so the two cannot disagree. See the{' '}
          <Link to="/guide/cds-service">CDS Service</Link> page.
        </p>
        <p>
          <strong>The Implementation Guide is upstream of all three, not a peer.</strong> The
          profiles, value sets and questionnaires are what an implementer builds against; the apps
          and the service read their definitions from it rather than defining anything themselves.
          It is published{' '}
          <a href={IG_HREF} target="_blank" rel="noopener noreferrer">
            here
          </a>
          .
        </p>
      </section>

      <section className="surface-guide__section">
        <h3 className="surface-guide__h3">Why it matters: portability across care transitions</h3>
        <p>
          A patient at risk of suicide moves through a lot of hands: emergency department,
          inpatient, outpatient, primary care, crisis line, community provider. Right now the
          safety plan and risk assessment too often stay behind with the system that created them.
          EHRs hold the data and <strong>health information exchanges move it between
          organizations</strong> &mdash; but exchange is only meaningful once the data is captured
          in a standard shape, translated into a concept any system can read, and tied to a clear
          next action.
        </p>
        <p>
          When all three come together,{' '}
          <strong>
            the patient&rsquo;s safety information becomes available wherever they show up next,
            not just locked in the chart that first created it.
          </strong>
        </p>
        <Notice tone="info" title="A concrete example">
          A patient is screened with the <strong>ASQ</strong> in an emergency department, assessed
          with the <strong>Columbia Scale</strong>, and discharged with a{' '}
          <strong>Stanley-Brown Safety Plan</strong>. Forty-eight hours later they are seen by an
          outpatient clinician at a different organization. Today that clinician usually starts
          from scratch: re-screens, re-asks, re-builds the plan. With SPiER&rsquo;s work in place,
          the clinician can see what has already been done &mdash; what screener, what risk level,
          what coping strategies and supports the patient already identified &mdash; and pick up
          where the emergency department left off.
        </Notice>
        <p>
          The same standardized data also gives systems a foundation for measuring whether the
          pathway is working, which is a path to quality improvement at the population level.
        </p>
      </section>
    </div>
  )
}
