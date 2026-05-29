# SPiER Engagement Strategy

> **Public draft.** Named partner organizations, vendors, individuals, and grants are referenced abstractly; the named version of this strategy lives outside the repository.

SPiER pursues adoption of its FHIR artifacts and the Suicide Safer Care pathway through three structurally distinct engagement tiers. Each tier has a different decision-making locus, a different proof point, and a different time-to-yes. Treating them as one undifferentiated "stakeholder list" loses the point.

---

## Tier 1 — Health Information Exchanges

**What they are.** State-level or multi-state organizations operating the data-movement plumbing between EHRs. Their adoption decision is about transport-layer support for discrete data elements: can their interface engine ingest, store, and emit a discrete ASQ Observation as easily as it ingests a CCDA section?

**Decision-making locus.** HIE governance — typically an executive director plus a member-driven board representing participating health systems. Decisions cascade through HIE governance rather than through any single member.

**Proof point we need.** A working pilot demonstrating that discrete behavioral-health observations can move across the HIE and land as actionable data on the receiving side. This is the anchor pilot tracked in [#60](https://github.com/bbthorson/SPiER/issues/60). The two-phase design (document-based transport in Phase 1; FHIR API in Phase 2) produces the comparative evidence.

**Why this tier is hard.** HIEs are mostly under-resourced relative to scope. Many have inherited federation infrastructure that was never designed for discrete clinical data; many are mid-transition between document-based and API-based exchange paradigms. The good news is that the ones that *are* well-resourced have strong incentive to be reference implementations and tend to be open about how their plumbing works.

**Reusability across the tier.** High. HIEs talk to each other. A working pattern at one HIE on a given interoperability platform is repeatable across others on the same platform. The "we built it once, here's how to run it" playbook is the path to scale.

**Initial targets.** One anchor HIE (pilot underway). Subsequent HIEs prioritized by interoperability-platform overlap with the anchor.

---

## Tier 2 — Mid-range EHR aggregators and academic health systems

**What they are.** Organizations that operate a shared EHR tenancy across many member care-delivery sites — federally-funded EHR-as-a-service networks for low-income-serving care, peer aggregator networks on other EHR bases, and large academic health systems with multi-instance EHR footprints. This tier sits structurally between an HIE (which doesn't run an EHR) and an individual EHR vendor (which doesn't run care sites).

**Decision-making locus.** A central informatics function inside the aggregator. One yes propagates across all member sites at once because the technical change happens at the shared tenancy layer.

**Proof point we need.** A demonstration that a SPiER configuration can be applied at the tenancy level without disrupting site-specific configuration. The pitch leans heavily on cost-of-adoption per member site — small, because the change happens once at the center.

**Why this tier matters.** High leverage per yes. Modest decision-maker count. Members are typically already aligned around a shared standard of care, which means clinical resistance is lower than at a vendor-driven engagement.

**Reusability across the tier.** Medium. Different aggregators use different EHR bases, so the technical configuration doesn't transfer directly. The pitch and the value framing do.

**Initial targets.** One federally-funded multi-site aggregator running on one EHR base; one peer aggregator on a different EHR base; one large academic health system with an existing data informatics relationship. Tracked in [#63](https://github.com/bbthorson/SPiER/issues/63).

---

## Tier 3 — Direct EHR vendor engagement

**What they are.** The EHR vendors themselves — the small number of products that together cover most of the US care-delivery footprint.

**Decision-making locus.** Internal product roadmap committees, downstream-influenced by named customer demand. Vendors do not typically prioritize standards adoption on the strength of an idea alone; they prioritize it when several large customers ask for the same thing.

**Proof point we need.** Customer pressure — typically aggregated across multiple large health systems — combined with a regulator signal (Tier 4, below) that the requested adoption is moving from optional to expected. Working artifacts and a reference implementation lower the marginal cost for the vendor to say yes.

**Why this tier is hardest.** Long timelines, opaque decision-making, low responsiveness to direct outreach unless it's anchored by a customer name. The leverage point is almost always elsewhere — at customers (who can ask), at aggregators (who *are* the customer for many sites), or at the regulator (who can require).

**Reusability across the tier.** Vendor-specific. No carryover.

**Initial targets.** Engagement is largely a function of which customers we have aligned via Tier 1 and Tier 2 work. Tracked under the EHR-engagement workstream (existing project framing; not yet bound to a single epic).

---

## Tier 4 — Standards bodies and federal regulators (cross-cutting)

This isn't an adoption tier in the same sense as 1–3, but it shapes the others, so it's named here for completeness.

**What they are.** The relevant standards-development organization (HL7 working groups) and the federal regulator with authority over interoperability requirements and certified EHR functionality.

**Why they matter.** The regulator can push standards-development working groups toward including suicide-care discrete elements as required (not example-only) in interoperability datasets. The standards body produces the functional profile the project intends to publish. Together they convert SPiER artifacts from "interesting reference" to "expected behavior."

**SPiER's approach to this tier** is a "show up done" posture: build the artifact bundle, walk it in to the relevant working group meeting, and ask whether they would adopt it as written rather than asking what "done" looks like. Workflow-specific scoping (ED first, then inpatient) is the operational principle. Tracked across [#61](https://github.com/bbthorson/SPiER/issues/61), [#62](https://github.com/bbthorson/SPiER/issues/62), and [#65](https://github.com/bbthorson/SPiER/issues/65).

---

## How the tiers interact

The tiers are not pursued in sequence. They feed each other.

- **Tier 1 (HIE pilot) → Tier 4 (regulator briefing):** The pilot produces empirical evidence that discrete data outperforms document-based exchange in actionability. That evidence is the centerpiece of the regulator pitch.
- **Tier 4 (regulator push) → Tier 3 (EHR vendor adoption):** A regulator signal that discrete behavioral-health elements are expected is the lever that moves vendor roadmaps.
- **Tier 2 (aggregator adoption) → Tier 3 (vendor pressure):** An aggregator that adopts SPiER becomes a named-customer voice asking its EHR vendor for native support.
- **Tier 1 (HIE pattern) → Tier 1 (HIE replication):** A pattern proven at one HIE is exported to peer HIEs running similar interoperability platforms.

---

## Anti-patterns

- **Treating all "stakeholders" as one list.** Each tier has its own pitch, its own proof point, and its own time-to-yes. A pitch tuned for an HIE will not move an EHR vendor and vice versa.
- **Pursuing Tier 3 without Tier 2 / Tier 4 leverage.** Direct vendor outreach without a customer voice or a regulator signal is, in expectation, unproductive.
- **Treating Tier 4 as a publication channel.** The regulator and the standards body are participants in the adoption story, not the destination. The destination is patient-chart actionability at the bedside.
- **Letting tier-cross-talk slip.** The product of the Tier 1 pilot is also the evidence for the Tier 4 briefing is also the demo for Tier 2 conversations. Lose track of the cross-talk and the work duplicates.

---

## Tracking

- [#60](https://github.com/bbthorson/SPiER/issues/60) — Tier 1 anchor pilot.
- [#61](https://github.com/bbthorson/SPiER/issues/61), [#62](https://github.com/bbthorson/SPiER/issues/62) — Tier 4 functional profile artifacts (ED, inpatient).
- [#63](https://github.com/bbthorson/SPiER/issues/63) — Tier 2 engagement track.
- [#65](https://github.com/bbthorson/SPiER/issues/65) — Tier 4 regulator briefing prep.
- [#64](https://github.com/bbthorson/SPiER/issues/64) — Tool licensing audit (gates all four tiers via repository transfer to the SPiER organization).
