import { Link } from 'react-router-dom'
import '../css/IgOverview.css'

export function IgOverview() {
  return (
    <div className="ig-overview">
      <section className="ig-overview__intro">
        <h3 className="ig-overview__h3">What SPiER does</h3>
        <p>
          Everything that matters in suicide prevention currently lives only in human-readable form &mdash;
          validated screeners on paper, the equivalences between different tools in clinicians&rsquo; heads,
          response protocols in plain-text guidelines. SPiER encodes each layer so an EHR can act on it, in
          three steps that build on each other:{' '}
          <strong>Capture &rarr; Translate &rarr; Act</strong>.
        </p>
        <p className="ig-overview__note">
          This <strong>Adoption Guide</strong> shows how to adopt SPiER and see it running. For the normative
          spec &mdash; profiles, value sets, and canonical Questionnaires &mdash; see the{' '}
          <a href={`${import.meta.env.BASE_URL}ig/`} target="_blank" rel="noopener noreferrer">
            published HL7 FHIR Implementation Guide
          </a>.
        </p>
      </section>

      <section className="ig-overview__section">
        <h3 className="ig-overview__h3">1. Capture &mdash; make the tools writable</h3>
        <p>
          HL7 is the standards body that defines how healthcare data is structured and exchanged (FHIR is
          their modern standard). National standards like <strong>US Core</strong> and <strong>USCDI</strong> already
          cover the basics &mdash; demographics, diagnoses, medications &mdash; but they don&rsquo;t yet specify <em>how</em>{' '}
          suicide screeners, risk assessments, and safety plans should be captured. So today every EHR captures
          that information a little differently &mdash; same questions, different shapes &mdash; which makes the
          data hard to share, hard to measure, and hard to act on. That&rsquo;s the gap SPiER fills.
        </p>
        <p>
          SPiER translates each tool (the ASQ, Columbia, Stanley-Brown, and others) into a single canonical
          FHIR shape &mdash; a <code>Questionnaire</code> and its <code>QuestionnaireResponse</code> &mdash; so the
          same instrument is recorded identically everywhere it&rsquo;s used, and contributes that work to the
          existing HL7 workgroups already shaping clinical data standards. The path is{' '}
          <strong>draft &rarr; test with partners &rarr; contribute to HL7 &rarr; influence the published standard</strong>,
          paired with a coalition of provider organizations who can collectively <em>demand</em> that consistency
          from their EHR vendors.
        </p>
      </section>

      <section className="ig-overview__section">
        <h3 className="ig-overview__h3">2. Translate &mdash; make different tools mutually intelligible</h3>
        <p>
          Partners don&rsquo;t all use the same instruments &mdash; one site screens with the ASQ, another with the
          Columbia, another with PHQ-9 Item 9 &mdash; and a result is useless to a system that can&rsquo;t read the
          instrument behind it. SPiER defines an instrument-agnostic <strong>concept layer</strong>: a single
          common suicide-risk tier (carried on a generic LOINC) that every tool maps <em>into</em>, so a receiving
          system can act on a result <strong>without having to run the same tool that produced it</strong>.
        </p>
        <p>
          This mirrors the approach HL7&rsquo;s <strong>Gravity Project</strong> took for social-determinants
          screening. The derived concept is screening-level and <em>unconfirmed</em> &mdash; it flags a need for
          follow-up, not a diagnosis &mdash; and is always linked back to the full-fidelity capture layer it came
          from. It is also SPiER&rsquo;s most contributable standards artifact.
        </p>
      </section>

      <section className="ig-overview__section">
        <h3 className="ig-overview__h3">3. Act &mdash; make the response protocols executable</h3>
        <p>
          The clinical response to a positive screen already exists as written, endorsed guidelines &mdash; they
          just can&rsquo;t fire on their own. SPiER encodes them as executable logic (<code>PlanDefinition</code>{' '}
          plus CDS Hooks) so the right next step surfaces at the right moment: an acute positive ASQ prompts a
          safety evaluation and a safety plan, a transition prompts a caring-contact follow-up.
        </p>
        <p>
          This is the frontier of SPiER&rsquo;s work &mdash; and notably an <em>encoding</em> problem rather than a{' '}
          <em>consensus</em> problem, because the protocol content is already settled. Throughout,{' '}
          <strong>SPiER recommends; the clinician (or the institution&rsquo;s configured policy) decides.</strong>{' '}
          The common entry point for every partner conversation is the{' '}
          <Link to="/guide/pathway">8-stage Suicide Safer Care Pathway</Link>:
        </p>
        <blockquote className="ig-overview__pathway">
          Flag Risk &rarr; Clarify Risk &rarr; Set Risk Status &rarr; Document Safety Actions &rarr;
          Coordinate Handoffs &rarr; Track Follow-Up &rarr; Manage Active Risk &rarr; Measure &amp; Share
        </blockquote>
        <p>
          To see where each instrument stands today &mdash; what&rsquo;s built, what its licensing requires, and how
          deeply it integrates &mdash; start with the{' '}
          <Link to="/guide/adoption-readiness">Adoption Readiness matrix</Link>.
        </p>
      </section>

      <section className="ig-overview__section">
        <h3 className="ig-overview__h3">Why it matters: portability across care transitions</h3>
        <p>
          A patient at risk of suicide moves through a lot of hands: ED, inpatient, outpatient, primary care,
          crisis line, community provider. Right now, the safety plan and risk assessment too often stay behind
          with the system that created them. EHRs hold the data; <strong>Health Information Exchanges move it
          between organizations</strong> &mdash; but exchange is only meaningful once the data is captured in a
          standard shape, translated into a concept any system can read, and tied to a clear next action.
        </p>
        <p>
          When all three come together,{' '}
          <strong>
            the patient&rsquo;s safety information becomes available wherever they show up next &mdash; not just
            locked in the chart that first created it.
          </strong>
        </p>
        <div className="ig-overview__vignette">
          <h4>A concrete example</h4>
          <p>
            A patient is screened with the <strong>ASQ</strong> in an emergency department, assessed with the{' '}
            <strong>Columbia Scale</strong>, and discharged with a <strong>Stanley-Brown Safety Plan</strong>. Forty-eight
            hours later, they&rsquo;re seen by an outpatient clinician at a different organization. Today,
            that clinician usually starts from scratch &mdash; re-screens, re-asks, re-builds the plan.
            With SPiER&rsquo;s work in place, the clinician can see what&rsquo;s already been done &mdash; what screener,
            what risk level, what coping strategies and supports the patient already identified &mdash; and
            pick up where the ED left off.
          </p>
        </div>
        <p>
          The same standardized data also gives systems a foundation for measuring whether the pathway is
          working &mdash; a path to quality improvement at the population level.
        </p>
      </section>
    </div>
  )
}
