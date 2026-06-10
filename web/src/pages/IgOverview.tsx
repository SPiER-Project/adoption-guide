import { Link } from 'react-router-dom'
import '../css/IgOverview.css'

export function IgOverview() {
  return (
    <div className="ig-overview">
      <section className="ig-overview__intro">
        <h3 className="ig-overview__h3">What SPiER does</h3>
        <p>
          SPiER is turning research-validated suicide prevention tools &mdash; the <strong>ASQ</strong> screener,
          the <strong>Columbia Suicide Severity Rating Scale</strong>, the <strong>Stanley-Brown Safety Plan</strong>,
          and others &mdash; into structured, machine-readable forms that any EHR or health
          system can implement the same way.
        </p>
      </section>

      <section className="ig-overview__section">
        <h3 className="ig-overview__h3">1. How SPiER's work leads to HL7 standards changes</h3>
        <p>
          HL7 is the standards body that defines how healthcare data is structured and exchanged (FHIR
          is their modern standard). National standards like <strong>US Core</strong> and <strong>USCDI</strong> already
          cover the basics &mdash; demographics, diagnoses, medications &mdash; but they don&rsquo;t yet specify <em>how</em>{' '}
          suicide screeners, risk assessments, and safety plans should be captured. That&rsquo;s the gap SPiER fills.
        </p>
        <p>
          Today, every EHR captures suicide risk information a little differently &mdash; same questions,
          different shapes. That makes the data hard to share, hard to measure, and hard to act on.
        </p>
        <p>SPiER&rsquo;s work has two halves:</p>
        <ul>
          <li>
            <strong>Standards side:</strong> Translate each tool (ASQ, Columbia, Stanley-Brown, and others)
            into a single canonical FHIR shape, and contribute that work to the existing HL7 workgroups
            already shaping clinical data standards. The path is{' '}
            <strong>draft &rarr; test with partners &rarr; contribute to HL7 &rarr; influence the published standard.</strong>
          </li>
          <li>
            <strong>Provider side:</strong> Build a coalition of provider organizations who can collectively{' '}
            <em>demand</em> this consistency from their EHR vendors. Standards work alone is slow;
            standards plus a clear customer ask is what drives adoption nationwide.
          </li>
        </ul>
      </section>

      <section className="ig-overview__section">
        <h3 className="ig-overview__h3">2. How the HIE work connects to the EHR work</h3>
        <p>
          EHRs hold the data; <strong>Health Information Exchanges (HIEs) move it between organizations.</strong>{' '}
          A safety plan written in an emergency department is only useful if the patient&rsquo;s outpatient
          provider, crisis line, or next ED visit can actually see it. So the HIE work is the second half
          of the same workstream:
        </p>
        <ul>
          <li><strong>With EHR vendors:</strong> make sure suicide-safer-care data is <em>captured</em> in a standard shape.</li>
          <li><strong>With HIEs:</strong> make sure that data is <em>findable and shareable</em> across organizations.</li>
        </ul>
        <p>
          <strong>Is there a repeatable workstream across partner types?</strong> That&rsquo;s the goal, and SPiER is
          actively building toward it. The common entry point for every partner conversation is the{' '}
          <Link to="/implementation-guide/pathway">8-stage Suicide Safer Care Pathway</Link>:
        </p>
        <blockquote className="ig-overview__pathway">
          Flag Risk &rarr; Clarify Risk &rarr; Set Risk Status &rarr; Document Safety Actions &rarr;
          Coordinate Handoffs &rarr; Track Follow-Up &rarr; Manage Active Risk &rarr; Measure &amp; Share
        </blockquote>
        <p>
          Whether the partner is an EHR, an HIE, or another vendor, the opening rubric is the same:{' '}
          <em>which of these stages do you support today, and where are the gaps?</em> The specific FHIR
          artifacts SPiER produces plug in at different points depending on the partner, but the underlying
          model doesn&rsquo;t change. We&rsquo;re not yet at a turnkey playbook &mdash; each engagement still teaches
          us something &mdash; but the pattern is consolidating.
        </p>
        <p>
          To see where each instrument stands today &mdash; what&rsquo;s built, what its licensing
          requires, and how deeply it integrates &mdash; start with the{' '}
          <Link to="/implementation-guide/adoption-readiness">Adoption Readiness matrix</Link>.
        </p>
      </section>

      <section className="ig-overview__section">
        <h3 className="ig-overview__h3">3. Why this matters for suicide-safer care transitions</h3>
        <p>
          A patient at risk of suicide moves through a lot of hands: ED, inpatient, outpatient, primary
          care, crisis line, community provider. Right now, the safety plan and risk assessment too often
          stay behind with the system that created them.
        </p>
        <p>
          When SPiER&rsquo;s standards work and HIE work come together,{' '}
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
          That&rsquo;s the goal of the whole pathway: standardized capture inside the EHR, standardized
          exchange across the HIE, so the next clinician in the patient&rsquo;s life has what they need.
          The same standardized data also gives systems a foundation for measuring whether the pathway
          is working &mdash; a path to quality improvement at the population level.
        </p>
      </section>
    </div>
  )
}
