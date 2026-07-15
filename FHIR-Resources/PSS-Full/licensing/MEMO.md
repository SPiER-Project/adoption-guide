# PSS Full — Licensing Audit Memo

> **Status: GO.** The universal-screen portion uses the free, public ED-SAFE PSS-3 items (SAMHSA/SPRC; no permission required — see the PSS-3 memo). The risk-stratification step is **site-defined** (local protocol/clinician judgment), not a reproduced proprietary instrument. Used under the license/permission held by the SPiER project (maintainer-confirmed 2026-07-15). Template: [`docs/best-practices/licensing-audit-template.md`](../../../docs/best-practices/licensing-audit-template.md). Tracking epic: [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).

---

## Tool

**Name:** Patient Safety Screener / Suicide Risk Screener (Full)
**Short name:** PSS Full
**SPiER tool ID:** TL-014
**SPiER pathway stage(s):** clarify-risk (Clarify Risk)
**Repository location:** `FHIR-Resources/PSS-Full/`

## Composition & provenance

TL-014 is a **combined** acute-care instrument, not a single fixed proprietary questionnaire:

1. **Universal screen** — the three ED-SAFE **PSS-3** items (depression, active ideation, lifetime attempt + recency). Public / free (see `FHIR-Resources/PSS-3/licensing/MEMO.md`; distributed by SAMHSA and SPRC, no permission required).
2. **Risk stratification** — a **site-defined** step: the clinician assigns a common risk tier (low/moderate/high) per the local protocol. SPiER does **not** embed the wording of any proprietary secondary stratification instrument.

## Licensing status

**Underlying license:** The PSS-3 items are free public-domain-style ED-SAFE materials. The stratification is site-defined and produces a value on the SPiER shared suicide-risk tier. There is no reproduced proprietary item content.
**Source of license claim:** PSS-3 free ED-SAFE distribution + **maintainer confirmation (2026-07-15)** that SPiER holds the necessary license/permission for the Wave 3 gated tools.
**Sign-off required:** Covered by the above; no separate instrument permission is reproduced.

## Conditions on redistribution

**Attribution required?** Attribute the PSS-3 screen to the ED-SAFE study / SAMHSA / SPRC (as in the PSS-3 encoding).
**Modifications permitted?** The PSS-3 item wording is preserved verbatim; the stratification step is explicitly site-defined.
**Commercial use permitted?** Yes for the PSS-3 (free public tool); the stratification is local.

## FHIR artifact metadata reflection

- `Questionnaire.copyright`: attributes the PSS-3 items to ED-SAFE/SAMHSA/SPRC; notes the stratification is site-defined and use under the SPiER project's license.
- Output: `SPiERPSSFullRiskLevel` Observation, value bound to `spier-suicide-risk-tier-vs` (lands on the concept layer; no crosswalk).
- FSH: `ig/input/fsh/pss-full.fsh` header documents composition and licensing basis.

## Open questions

- If the site intends to use a specific *named* secondary stratification instrument (rather than a local protocol), audit that instrument's licensing separately before embedding its wording.

## Audit log

| Date | Reviewer (role) | Action / change |
|---|---|---|
| 2026-07-15 | AI agent (assessment-to-ig) | Encoded TL-014 as a combined public PSS-3 screen + site-defined stratification (value on the shared tier). GO on the basis of the free PSS-3 materials plus maintainer confirmation; no proprietary secondary-instrument wording reproduced. |
