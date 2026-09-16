# ConceptMap for coded dispositions, StructureMap for values, and why CAMS never maps to `imminent`

**Decided:** 2026-07/08 (the concept-layer crosswalks;
[`concept-harmonization.md`](../best-practices/concept-harmonization.md) is the
conformance rationale for the layer itself). **Rule, as published:**
Conformance § *Harmonization status*.

## Which artifact kind, and why

A ConceptMap maps code to code. Instruments that publish a coded disposition —
ASQ, PSS-3, C-SSRS, BSSA, CAMS — therefore use one. The PHQ-9's suicide-relevant
signal is Item 9, an ordinal integer 0–3, and the SBQ-R produces a numeric total
against validated cutoffs; neither is a code-to-code mapping, so both are
expressed as StructureMaps keyed on the value.

The ASQ and C-SSRS carry a StructureMap *as well as* a ConceptMap because
deriving the harmonized Observation involves resource shaping — provenance via
`derivedFrom`, category codings, interpretation — around the ConceptMap
`translate()` call. The ConceptMap is the reviewable clinical table; the
StructureMap is the executable derivation that uses it.

## Why the CAMS map is different in kind

CAMS is a **collaborative therapeutic process, not a predictive screener**, and
no published psychometric stratification of the SSF Overall Risk rating exists.
Its tier assignment is therefore explicitly clinician-overridable decision
support: every row carries a `wider` equivalence, and **no rating maps to
`imminent`** — escalation to the imminent tier is a separate clinical triage
decision that a patient self-rating cannot make.

## The two lossy egress steps

The egress ConceptMap onto LOINC's normative answer list `LL465-6` collapses
`imminent` onto `High`, because the list has no distinct "imminent" answer, and
omits `no-risk`, which has no LOINC equivalent. Both are stated on Conformance
because a consumer reading only the LOINC value cannot see them, and both are
pending the same clinical sign-off as the crosswalks themselves.

## What would reopen it

Clinical sign-off changing any tier assignment; a published stratification of
the CAMS SSF Overall Risk rating; or LOINC extending `LL465-6`.
