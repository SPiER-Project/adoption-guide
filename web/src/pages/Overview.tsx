import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { STAGES } from '@spier/core/data/catalog/stages'
import '../css/Overview.css'

// The published HL7 IG is a sibling static site (web/dist/ig/), not a hash
// route — see the note on IG_HREF in EhrShell.tsx for how the base resolves.
const IG_HREF = `${import.meta.env.BASE_URL}ig/`

// The three steps, at a glance. Each card is deliberately one claim long: the
// numbered sections below carry the substance, and the point of the grid is
// that a reader can hold all three in their head before reading any of them.
// Wording is kept in step with `ig/input/pagecontent/how-to-read.md`, which is
// the canonical statement of this model.
const STEPS = [
  {
    key: 'capture',
    name: 'Capture',
    lead: 'Validated tools live on paper and in PDFs.',
    body: 'SPiER turns each one into a single canonical FHIR shape, so it is recorded identically in every system that uses it.',
  },
  {
    key: 'translate',
    name: 'Translate',
    lead: 'Different sites use different tools.',
    body: 'SPiER defines a shared risk concept that every tool maps into, so a receiving system can act on a result without running the same tool.',
  },
  {
    key: 'act',
    name: 'Act',
    lead: 'The response protocols already exist, but cannot fire on their own.',
    body: 'SPiER encodes them as executable logic so the right next step surfaces at the right moment. SPiER recommends; the clinician decides.',
  },
]

export function Overview() {
  return (
    <div className="overview">
      <PageHeader
        eyebrow="SPiER"
        title="Setting priorities for technology-enabled suicide-safer care"
        lede={
          <>
            A FHIR-native reference implementation of the suicide-safer care pathway. SPiER&rsquo;s mission is to
            make suicide-safer care the standard everywhere &mdash; and the tools to do it already exist.
            Validated screeners, risk assessments, safety plans, and response protocols live on paper, in PDFs,
            and in plain-text guidelines that no EHR can act on. SPiER makes each layer machine-actionable,
            shows EHR vendors and health-system admins what a configured implementation looks like, and
            provides the code to execute on it. The artifacts are free and open to adopt at no cost.
          </>
        }
      />

      <section className="overview__section overview__section--steps">
        <h3 className="overview__h3">How SPiER works</h3>
        <p className="overview__lead">
          Everything that matters in suicide prevention currently lives only in human-readable form &mdash;
          validated screeners on paper, the equivalences between different tools in clinicians&rsquo; heads,
          response protocols in plain-text guidelines. SPiER&rsquo;s work is to encode each layer so software
          can act on it, in three steps that build on each other:{' '}
          <strong>Capture &rarr; Translate &rarr; Act</strong>.
        </p>
        <ol className="overview__steps">
          {STEPS.map((step, i) => (
            <li key={step.key} className="overview__step-card">
              <span className="overview__step-index">Step {i + 1}</span>
              <h4 className="overview__step-name">{step.name}</h4>
              <p className="overview__step-body">
                {step.lead} {step.body}
              </p>
            </li>
          ))}
        </ol>
        <p className="overview__note">
          This site is the <strong>Adoption Guide</strong> &mdash; how to adopt SPiER and see it running. For
          the normative spec &mdash; profiles, value sets, and canonical Questionnaires &mdash; see the{' '}
          <a href={IG_HREF} target="_blank" rel="noopener noreferrer">
            published HL7 FHIR Implementation Guide
          </a>.
        </p>
      </section>

      <section className="overview__section">
        <h3 className="overview__h3">1. Capture &mdash; make the tools writable</h3>
        <p>
          HL7 is the standards body that defines how healthcare data is structured and exchanged (FHIR is
          their modern standard). National standards like <strong>US Core</strong> and <strong>USCDI</strong> already
          cover the basics &mdash; demographics, diagnoses, medications &mdash; but they don&rsquo;t yet specify <em>how</em>{' '}
          suicide screeners, risk assessments, and safety plans should be captured. So today every EHR captures
          that information a little differently &mdash; same questions, different shapes &mdash; which makes the
          data hard to share, hard to measure, and hard to act on. That&rsquo;s the gap SPiER fills.
        </p>
        <p>
          SPiER translates each tool (the <strong>ASQ</strong>, <strong>Columbia</strong>,{' '}
          <strong>Stanley-Brown</strong>, and others) into a single canonical FHIR shape &mdash; a{' '}
          <code>Questionnaire</code> and its <code>QuestionnaireResponse</code> &mdash; so the
          same instrument is recorded identically everywhere it&rsquo;s used, and contributes that work to the
          existing HL7 workgroups already shaping clinical data standards. The path is{' '}
          <strong>draft &rarr; test with partners &rarr; contribute to HL7 &rarr; influence the published standard</strong>,
          paired with a coalition of provider organizations who can collectively <em>demand</em> that consistency
          from their EHR vendors.
        </p>
      </section>

      <section className="overview__section">
        <h3 className="overview__h3">2. Translate &mdash; make different tools mutually intelligible</h3>
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

      <section className="overview__section">
        <h3 className="overview__h3">3. Act &mdash; make the response protocols executable</h3>
        <p>
          The clinical response to a positive screen already exists as written, endorsed guidelines &mdash; they
          just can&rsquo;t fire on their own. SPiER encodes them as executable logic (<code>PlanDefinition</code>{' '}
          plus CDS Hooks) so the right next step surfaces at the right moment: an acute positive ASQ prompts a
          safety evaluation and a safety plan, a transition prompts a caring-contact follow-up.
        </p>
        <p>
          This is the frontier of SPiER&rsquo;s work &mdash; and notably an <em>encoding</em> problem rather than a{' '}
          <em>consensus</em> problem, because the protocol content is already settled. Throughout,{' '}
          <strong>SPiER recommends; the clinician (or the institution&rsquo;s configured policy) decides.</strong>
        </p>
      </section>

      {/* Two vocabularies run through this app and they are easy to mistake for
          competing taxonomies. They are orthogonal: Capture/Translate/Act is
          the artifact axis (canonical in the IG's how-to-read page), the eight
          stages are the clinical axis (canonical in the pathway-stage
          CodeSystem, via FSH). Navigation follows the clinical axis, so say so
          once, here, rather than leaving a reader to reconcile them. */}
      <section className="overview__section">
        <h3 className="overview__h3">How that maps to what you see in this app</h3>
        <p>
          <strong>Capture &rarr; Translate &rarr; Act</strong> describes what SPiER does to the{' '}
          <em>artifacts</em>. It is not what you navigate by. The app is organized around the thing a
          clinician actually moves through &mdash; the <strong>eight-stage Suicide Safer Care Pathway</strong>,
          which is the common entry point for every partner conversation and the vocabulary used by the
          Patient View, the Population View, and the Measures dashboard:
        </p>
        <ol className="overview__pathway">
          {STAGES.map(stage => (
            <li key={stage.id} className="overview__pathway-stage">
              <span className="overview__pathway-index">{stage.orderIndex + 1}</span>
              <span className="overview__pathway-title">{stage.title}</span>
            </li>
          ))}
        </ol>
        <p>
          Every stage is a place a patient can be. Each of the three steps above cuts across all eight of
          them &mdash; a stage needs its instruments captured, its results translated, and its next action
          made executable. Start with the{' '}
          <Link to="/guide/pathway">Care Pathway</Link> for the protocol itself &mdash; rendered from the
          published PlanDefinition &mdash; the <Link to="/guide/tools">Tools</Link> catalog for the
          stage-by-stage instrument detail, or the{' '}
          <Link to="/guide/adoption-readiness">Adoption Readiness matrix</Link> to see where each instrument
          stands today &mdash; what&rsquo;s built, what its licensing requires, and how deeply it integrates.
        </p>
      </section>

      <section className="overview__section">
        <h3 className="overview__h3">Why it matters: portability across care transitions</h3>
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
        <div className="overview__vignette">
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

      <section className="overview__section">
        <h3 className="overview__h3">Where to go next</h3>
        <div className="overview__lens-grid">
          <Link to="/guide/pathway" className="overview__lens-card overview__lens-card--guide">
            <span className="overview__lens-badge">Adopt</span>
            <h4>Adoption Guide</h4>
            <p>
              How to adopt SPiER and see it running: the care pathway rendered from its published
              PlanDefinition, a tool catalog across the eight stages, a data dictionary, an
              adoption-readiness matrix and EHR adoption rubric, and a configurable Tool
              Configuration that drives the Patient View.
            </p>
            <span className="overview__lens-cta">Explore the guide &rarr;</span>
          </Link>

          <Link to="/population" className="overview__lens-card overview__lens-card--population">
            <span className="overview__lens-badge">Demo</span>
            <h4>Population View</h4>
            <p>
              A behavioral-health counselor&rsquo;s caseload &mdash; 10 sample patients spanning every
              pathway stage and risk level. Each row surfaces the recommended next step regardless
              of which specific tools an implementation has enabled.
            </p>
            <span className="overview__lens-cta">Open the caseload &rarr;</span>
          </Link>

          <Link to="/patient/chart" className="overview__lens-card overview__lens-card--patient">
            <span className="overview__lens-badge">Demo</span>
            <h4>Patient View</h4>
            <p>
              One patient&rsquo;s chart, organized around the eight-stage pathway: a visual stage tracker,
              CDS-style next-step recommendation cards, activity grouped by stage, encounter
              timeline, and a full FHIR document list.
            </p>
            <span className="overview__lens-cta">Open the chart &rarr;</span>
          </Link>

          <a
            href={IG_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="overview__lens-card overview__lens-card--ig"
          >
            <span className="overview__lens-badge">Specification</span>
            <h4>Implementation Guide&nbsp;&#8599;</h4>
            <p>
              The published HL7 FHIR Implementation Guide &mdash; the normative spec: profiles,
              value sets, code systems, and canonical Questionnaires for suicide-safer care.
            </p>
            <span className="overview__lens-cta">Open the HL7 IG &rarr;</span>
          </a>
        </div>
      </section>
    </div>
  )
}
