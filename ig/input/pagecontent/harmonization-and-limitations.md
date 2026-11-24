What is settled and what is not: which crosswalks into the shared risk tier
are published, that none has clinical sign-off yet, and what the shared result
code means for anyone querying SPiER data. The rules a system conforms to are
on [Conformance](conformance.html).

### Harmonization status {#harmonization-status}

Every crosswalk is a published, machine-readable artifact; **none has clinical
sign-off yet**. Those are two different facts, and only the first is complete.

| Instrument | Tier-mapping artifact | Kind | Status |
|---|---|---|---|
| ASQ | [ConceptMap: ASQ Disposition → Risk Tier](ConceptMap-ASQDispositionToRiskTier.html) · [StructureMap: ASQ Result → Concept](StructureMap-ASQResultToSuicideRiskConcept.html) | Coded disposition | Published — pending clinical sign-off |
| PSS-3 | [ConceptMap: PSS-3 Result → Risk Tier](ConceptMap-PSS3ResultToRiskTier.html) | Coded disposition | Published — pending clinical sign-off |
| C-SSRS | [ConceptMap: C-SSRS Risk Level → Risk Tier](ConceptMap-CSSRSRiskLevelToRiskTier.html) · [StructureMap: C-SSRS Risk Level → Concept](StructureMap-CSSRSRiskLevelToSuicideRiskConcept.html) | Coded disposition | Published — pending clinical sign-off |
| BSSA | [ConceptMap: BSSA Disposition → Risk Tier](ConceptMap-BSSADispositionToRiskTier.html) | Coded disposition | Published — pending clinical sign-off |
| CAMS (SSF overall risk) | [ConceptMap: CAMS SSF Overall Risk → Risk Tier](ConceptMap-CAMSOverallRiskToRiskTier.html) | Coded disposition | Published — pending clinical sign-off; clinician-overridable |
| PHQ-9 (Item 9) | [StructureMap: PHQ-9 Item 9 → Concept](StructureMap-PHQ9Item9ToSuicideRiskConcept.html) | Ordinal threshold | Published — pending clinical sign-off |
| SBQ-R (total score) | [StructureMap: SBQ-R Total Score → Concept](StructureMap-SBQRTotalScoreToSuicideRiskConcept.html) | Numeric cutoff | Published — pending clinical sign-off |

A coded disposition maps code to code, hence a ConceptMap; an ordinal or
numeric result is keyed on the value, hence a StructureMap; the ASQ and C-SSRS
carry both because deriving the Observation also shapes the resource
(`derivedFrom`, categories, interpretation) around the `translate()` call. All
are `status = draft`, `experimental = true`.

CAMS is a collaborative therapeutic process, not a predictive screener, and no
published stratification of the SSF Overall Risk rating exists: its map is
clinician-overridable decision support, every row carries a `wider`
equivalence, and **no rating maps to `imminent`**.

**Declared transformation.**
[Stanley-Brown QuestionnaireResponse → CarePlan](StructureMap-StanleyBrownQRToCarePlan.html)
states how a completed safety-plan questionnaire becomes a safety-plan
`CarePlan`; the Document Safety Actions stage names it in
`PlanDefinition.action.transform`.

**Egress: harmonized tier → LOINC.**
[SPiER Risk Tier → LOINC LL465-6](ConceptMap-SPiERRiskTierToLOINC.html) maps
the tier onto the normative LOINC answer list for `93374-7`, so a consumer
expecting the LOINC-coded value can read a SPiER concept without the local
vocabulary. Two steps are lossy: `imminent` collapses onto LOINC `High`, so a
consumer reading only the LOINC value SHOULD read the SPiER tier alongside it
where the distinction matters; and `no-risk` is omitted, having no LOINC
equivalent.

Until sign-off by suicide-prevention subject-matter experts, every tier
assignment above is **illustrative reference logic**. Adopters SHALL validate
tier assignments against their own clinical protocols before using the
harmonized tier to drive care decisions.

### Known limitations {#known-limitations}

**Instrument results and the harmonized tier share one code.** Seven
instrument result profiles — ASQ, BSSA, C-SSRS, CAMS Outcome/Disposition,
PSS-3, PSS-Full and SAFE-T — are coded LOINC `93374-7` "Suicide risk level" and
carry the same `survey` and `suicide-risk` categories as the
[SPiER Suicide Risk Concept](StructureDefinition-spier-suicide-risk-concept.html).
A search on code and category returns all of them together, and nothing in the
resource marks which layer it belongs to except its value's code system and
its `derivedFrom` chain. A consumer SHALL NOT treat an Observation as the
harmonized tier on its code alone; it SHALL check that the value comes from
[SPiERSuicideRiskTier](CodeSystem-spier-suicide-risk-tier.html).
[Quick Starts](quick-starts.html#risk-tier) has the query. A distinguishing
code is planned and not yet published.

**Placing these results on `93374-7` is SPiER's choice, not the instrument
developers'.** LOINC publishes `93374-7` as part of its C-SSRS content. SPiER uses it for the
other instruments' results so that every result can be found and compared in
one place, but the ASQ, BSSA, CAMS, PSS-3, PSS-Full and SAFE-T developers have
not reviewed or agreed to their results being normalized onto it. Until they
have, treat the `93374-7` coding of those results, and the tier crosswalks
above, as SPiER's proposal.
