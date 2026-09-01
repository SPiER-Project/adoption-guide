# Suicide Safer Care Pathway — source spec

> **Status in this repo:** This document transcribes *Suicide Safer Care
> Pathway*, a one-page clinical-protocol diagram. It is a **requirements
> source, not an implementation record** — nothing below is encoded in this
> repo yet. The implementation analysis, gap list, decisions, and phasing live
> in [`docs/plans/suicide-safer-care-pathway.md`](../plans/suicide-safer-care-pathway.md).
>
> Same role as
> [`suicide-care-dashboard-spec.md`](suicide-care-dashboard-spec.md): a
> leader-supplied spec kept verbatim enough to be citable, so later
> implementation decisions can be traced back to what was actually depicted.
> Editorial judgment (what SPiER will actually build, what's an open clinical
> question, what's a source error) belongs in the plan, not here — this doc
> stays a faithful transcription.

Source: `SPiER_Suicide_Safer_Care_Example.pdf` (one page). Text extracted via
`pdftotext -layout` and cross-checked against the rendered page.

---

## Provenance

The diagram is captioned:

> Developed by Tej Carbone and Dr. Virna Little
> NCT Consulting ©2023
> All Rights Reserved

with the disclaimer:

> This is a suggested pathway for assisting organizations in developing their
> own guidelines in congruence with local, state, and organizational policies
> and regulatory requirements.

**Ownership in this repo:** the framework is now SPiER-owned — no attribution
is required going forward — per the decision recorded 2026-09-01 in
[`docs/plans/suicide-safer-care-pathway.md`](../plans/suicide-safer-care-pathway.md)
("Requirements source" note at the top of that plan). The original document's
own disclaimer, quoted above, frames it as a *suggested* pathway for an
organization to adapt, not a fixed standard — consistent with SPiER adopting
and modifying it.

---

## Care events (entry points)

The diagram depicts three parallel entry points into the pathway, each
feeding the same gate:

1. **Suicidal thoughts/behavior identified at ANY point in care**
2. **All patients receive Universal Screening with PHQ-9 in Primary Care as
   part of Ongoing Depression Screening**
3. **Initial Contact with Patient**

All three feed a single gate:

> If YES to Q9 on PHQ-9, or if suicidal thoughts/behavior identified, or with
> clinical judgement, proceed to next step.

which leads to:

> **Administer the C-SSRS with Triage Points\***

### PHQ-9 Question 9 positivity (from the Notes)

> 1. Negative response to PHQ-9, Q9 is defined as a score of 0. Positive is
>    defined as score of 1-3.

### Exit: negative C-SSRS

The diagram shows one exit branch off the C-SSRS administration step:

> Scored NO on all Questions on C-SSRS → **Patient does not enter Suicide
> Safer Care Pathway**

---

## The four risk tiers

The diagram defines four tiers under the heading **Risk Pathway
Identification**. Question numbers and timeframes are transcribed exactly as
printed; **any correction against the published C-SSRS instrument is recorded
separately in the "Published-instrument verification" section below, and is
NOT applied here.**

### Historical Risk

> If "Yes" to Q6 (Lifetime) and "No" to Q1-5

### Low Risk

> If "Yes" to Q1 or Q2 (in the past month) and "No" to Q3-5 (in the past
> month) & 6 (in the past 3 months) (or clinical judgement) **OR** Eligible
> for reduction from MODERATE RISK level

### Moderate Risk

> If "Yes" to Q3 (in the past month) and "No" to Q4 or 5 (in the past month),
> & 6 (in the past 3 months) (or clinical judgement) **OR** Eligible for
> reduction from HIGH RISK level

### High Risk

> If "Yes" to Q4 or 5 (in the past month) **OR** 6 (in the past 3 months) (or
> clinical judgement)

Every tier definition ends in an "(or clinical judgement)" clause, and Low and
Moderate each carry an explicit "eligible for reduction from the tier above"
disjunct — i.e. a patient can land in Low or Moderate either by direct C-SSRS
response, or by having stepped down from Moderate/High respectively (see
"Criteria for risk-level reduction" below).

---

## Per-tier obligation rows

The diagram lays these out as a matrix: one row per obligation, one column per
tier (Historical / Low / Moderate / High). Several rows span multiple tier
columns where the diagram states one value across them — transcribed as such
below.

### Crisis resources (all four tiers, single spanning row)

> Provide patient with 988 Crisis Hotline and NowMattersNow.org website

### Safety planning

| Tier | Row text |
|---|---|
| Historical, Low (spanning) | Provide patient with Emotional Fire Safety Plan |
| Moderate, High (spanning) | Provide patient with Emotional Fire Safety Plan; Complete Stanley and Brown Safety Plan; review at each contact and modify (as needed) |

So Emotional Fire is given at every tier; the Stanley-Brown plan is added only
at Moderate and High, with an explicit "review at each contact and modify (as
needed)" instruction attached to that pair of tiers.

### C-SSRS reassessment

| Tier | Cadence |
|---|---|
| Historical | Reassess with C-SSRS prior to discharge (or more frequently as clinical judgement dictates) |
| Low | Reassess with C-SSRS every 30 days (or more frequently as clinical judgement dictates) |
| Moderate | Reassess with C-SSRS every 14 days (or more frequently as clinical judgement dictates) |
| High | Reassess with C-SSRS every 7 days (or more frequently as clinical judgement dictates) |

### Suicide risk to problem list

| Tier | Codes as printed on the diagram |
|---|---|
| Historical | Z91.82 (History of Suicidal Behavior) or Z91.5 (History of Suicide Attempt) |
| Low, Moderate, High (spanning) | R45.851 (Suicidal Ideation) |

⚠️ Transcribed **exactly as the diagram states it**, including the code that
is wrong (`Z91.82`) — the correction is Phase 1d's job, in the section below,
not this one.

### Frequency of patient contact

| Tier | Cadence |
|---|---|
| Historical | As clinically indicated |
| Low | At least every month (or more frequently as clinical judgement dictates) |
| Moderate | At least every 14 days (or more frequently as clinical judgement dictates) |
| High | At least every 7 days (or more frequently as clinical judgement dictates) |

Note this is stated as a **separate row** from C-SSRS reassessment cadence,
with identical values at Moderate and High but a different value at Low
("every month" here vs. "every 30 days" for reassessment) and a different
framing at Historical ("as clinically indicated" vs. "prior to discharge").

### Criteria for risk-level reduction

**Historical:**
> N/A - patient remains in HISTORICAL risk tier due to LIFETIME history, as
> reported by C-SSRS

**Low:**
> - 30 days of answering "No" to Q1-5, 6 (last 3 months)
> - No milestone events for 30 days
> - Patient has been in LOW RISK tier for at least 30 days
> - Psychiatric Consultant must agree
> - If above criteria are met, patient may be moved out of pathway if Q6
>   (Lifetime is "No"), or HISTORICAL (if Q6 Lifetime is "Yes")

**Moderate:**
> - 30 days of answering "No" to Q3-5, 6 (last 3 months)
> - No milestone events for 30 days
> - Patient has been in MODERATE RISK tier for at least 30 days
> - Psychiatric Consultant must agree
> - If above criteria are met, patient may be moved to LOW RISK tier

**High:**
> - 90 days of answering "No" to Q4-5, 6 (last 3 months)
> - No milestone events for 30 days
> - Psychiatric Consultant must agree
> - If above criteria are met, patient may be moved to MODERATE RISK tier

Note the asymmetry the diagram itself states: the "No" streak required to
step down is **30 days** for Low and Moderate but **90 days** for High, while
"no milestone events" is stated as a 30-day window at every tier including
High. Psychiatric-consultant agreement is required at every tier that has a
reduction path (Low, Moderate, High); Historical has none because it is
defined as a lifetime designation.

---

## High-risk extras

Three items appear only in the High-Risk column, below the obligation matrix:

### At-every-contact question

> At EVERY CONTACT, ASK: "Are you having thoughts of killing yourself right
> now?"

### STAT safety evaluation

> - STAT Safety Evaluation
> - Counsel Patient on Lethal Means Reduction
> - Assess for immediate supports and engage if possible.
> - Alert primary care provider and/or psychiatric provider responsible for
>   patient's care

### Missed/no-show outreach protocol

> If patient misses/no-shows a scheduled appointment
> - Call immediately at time of contact
> - Consider outreach to emergency/safety plan contacts within the hour
> - Consult with supervisor if possible; consider wellness check

---

## Notes (as printed on the diagram)

> 1. Negative response to PHQ-9, Q9 is defined as a score of 0. Positive is
>    defined as score of 1-3.
> 2. Question 6 is considered positive if "in the last 3 months" is Yes.
> 3. MILESTONE EVENTS include, but are not limited to: hospitalization,
>    medication change, incarceration, geographic move, recent homelessness,
>    new DCF/CPS/APS case, impactful SDOH change, psychotic features,
>    substance reuse.
> 4. Emotional Fire Safety Plan:
>    https://www.nowmattersnow.org/wp-content/uploads/2018/10/0.-NowMattersNow.org-Safety-Plan-Website-Version.pdf
> 5. C-SSRS Initial:
>    https://www.cms.gov/files/document/cssrs-screen-version-instrument.pdf

Note 2's "Question 6 is considered positive if 'in the last 3 months' is Yes"
is the diagram's own framing of Q6 positivity for the reduction-criteria rows
above ("No" to "...6 (last 3 months)") — it is Q6's recency answer, not
whether Q6 itself was ever endorsed, that the diagram treats as the positive
signal for those rows.

---

## Key Performance Indicators

The diagram states exactly three KPIs:

> - Percentage of patients with a positive response to Question 9 on the
>   PHQ-9 that receive C-SSRS Screen with Triage Points (C-SSRS Screen)
> - Percentage of patients with a positive C-SSRS screen that have
>   suicide-related entry added to problem list/risk flag identified in
>   chart.
> - Percentage of patients in each flag tier that were provided with
>   appropriate safety plan/resources.

---

## Published-instrument verification (Phase 1b)

**Question.** The repo's shipped C-SSRS screener mapper
([`cssrsScreener.ts`](../../packages/core/src/lib/observationMappers/cssrsScreener.ts))
derives Q3 → moderate, **Q4 → moderate**, Q5 → high, **Q6 → high regardless of
recency**. The diagram above states Q3 → moderate, **Q4 or Q5 → high**, and
**Q6 within 3 months → high; Q6 lifetime-only → Historical (not high)**. This
section checks both against the C-SSRS Screener with Triage Points as
published, rather than trusting either the diagram or the mapper.

**Sources consulted (accessed 2026-09-01):**

1. The CMS-hosted PDF the diagram itself footnotes as its C-SSRS source
   (Note 5 above): `https://www.cms.gov/files/document/cssrs-screen-version-instrument.pdf`
   — "Columbia-Suicide Severity Rating Scale, Screen Version - Recent," ©2008
   The Research Foundation for Mental Hygiene, Inc. (Kelly Posner, PhD, New
   York State Psychiatric Institute).
2. The Columbia Lighthouse Project's current published Primary Care variant:
   `https://cssrs.columbia.edu/documents/c-ssrs-screener-triage-primary-care`,
   which links a 2026-dated PDF —
   `https://cssrs.columbia.edu/wp-content/uploads/C-SSRS-Screener-with-Triage-Points-for-Primary-Care-2026.pdf`
   ("Screen with Triage Points for Primary Care").
3. The Columbia Lighthouse Project's general triage-and-risk-identification
   page: `https://cssrs.columbia.edu/the-columbia-scale-c-ssrs/risk-identification/`,
   which states triage "works the same in most settings" across the
   setting-specific screener variants (ED, primary care, law enforcement,
   corrections, schools) — "The only difference in these various screeners
   are the intervention examples" — which is why a Primary Care–labeled
   screener is treated here as authoritative for the item→tier assignment
   itself, not just for one setting's wording of the response protocol.

**What the CMS PDF (2008 "Screen Version — Recent") shows.** The document is
a color-coded table: each question's response cell is shaded, and a legend at
the bottom reads:

> - Low Risk (yellow)
> - Moderate Risk (orange)
> - High Risk (red)

The shading, read cell-by-cell:

| Item | Wording | Cell color | Tier |
|---|---|---|---|
| Q1 | "Have you wished you were dead or wished you could go to sleep and not wake up?" | yellow | Low |
| Q2 | "Have you actually had any thoughts of killing yourself?" | yellow | Low |
| Q3 | "Have you been thinking about how you might do this?" | orange | Moderate |
| Q4 | "Have you had these thoughts and had some intention of acting on them?" | **red** | **High** |
| Q5 | "Have you started to work out or worked out the details of how to kill yourself? Do you intend to carry out this plan?" | red | High |
| Q6, "Was this within the past three months?" = YES | (behavior, recent) | red | High |
| Q6, "Was this within the past three months?" = NO | (behavior, lifetime-only) | **orange** | **Moderate** |

**What the Columbia Lighthouse Project's current (2026) Primary Care variant
shows.** This document has the same color-coded item table (Q1/Q2 yellow, Q3
orange, Q4/Q5 red, Q6-lifetime orange, Q6-past-3-months red) **and**, unlike
the CMS PDF, an explicit textual "Possible Response Protocol to C-SSRS
Screening" table underneath it, removing any ambiguity in reading the colors:

> - Item 1: Behavioral Health Referral
> - Item 2: Behavioral Health Referral
> - Item 3: Behavioral Health Referral
> - Item 4: Behavioral Health Consultation and Patient Safety Precautions
> - Item 5: Behavioral Health Consultation and Patient Safety Precautions
> - Item 6: Behavioral Health Referral
> - Item 6, 3 months ago or less: Behavioral Health Consultation and Patient
>   Safety Precautions

"Behavioral Health Consultation and Patient Safety Precautions" is the action
tied to the red/High items (4, 5, and recent-6); "Behavioral Health Referral"
is the action tied to yellow/Low (1, 2) **and** orange/Moderate (3, and
lifetime-only 6) alike — the action text does not distinguish Low from
Moderate, but the color band printed beside each row does, and it is
identical to the CMS PDF's.

The Columbia Lighthouse Project's general risk-identification page adds
independent, non-tabular corroboration of the same Q4/Q5 grouping in prose:
the page names the highest-concern responses as "a recent (past month) 'yes'
to question 4 or 5 on ideation severity and/or any recent (past 3 months)
behavior" — treating 4 and 5 as one group, and gating the behavior item (6) on
recency, exactly as the color table does.

**Finding.**

| Endorsed item | Published instrument (CMS 2008 + Columbia 2026, in agreement) | Diagram | Shipped mapper |
|---|---|---|---|
| Q3 | Moderate | Moderate — matches | Moderate — matches |
| **Q4** | **High** | High — matches | **Moderate — does not match** |
| Q5 | High | High — matches | High — matches |
| **Q6, past 3 months** | **High** | High — matches | High — matches (but see below) |
| **Q6, lifetime-only** | **Moderate** | **Historical (not High)** — partial match: correctly not High, but the published instrument does not have a "Historical" tier and would score this Moderate, not a separate lower tier | **High — does not match**, and does not gate on recency at all |

So: **the diagram's Q4/Q5 → High and its recency-gating of Q6 are both
confirmed against the published instrument; the shipped mapper's Q4 → moderate
and its recency-blind Q6 → high are both contradicted by it.** This is exactly
the direction the plan's Phase 1b expected (`suicide-safer-care-pathway.md`
Phase 1c is the mapper-alignment work this finding feeds, pending clinical
sign-off — not part of this PR).

**One place the diagram itself is not fully supported: the "Historical"
tier.** Both published sources define exactly **three** risk levels (Low,
Moderate, High) via color and, in the 2026 Primary Care document, via
explicit response-protocol text. Neither publishes a fourth "Historical"
category. A patient who endorses only Q6, lifetime-only (the diagram's
Historical definition) would be scored **Moderate** by the published
instrument's own color/action table — the same tier as a patient who endorses
only Q3. The diagram's placement of that response pattern below Low/Moderate
as a distinct "Historical" tier is therefore not something the published
C-SSRS Screener with Triage Points itself asserts; it is diagram-level
structure layered on top of the instrument. This is consistent with — and
does not resolve — the plan's own open question 2 ("is Historical risk an
orthogonal flag rather than a tier?"); it is recorded here as evidence for
that question, not as an answer to it.

**What was not verified.** Neither published source states an explicit
"Historical" risk definition to check the diagram's Q6-lifetime-and-No-to-Q1-5
formulation against, so that specific compound condition (as opposed to the
plain Q6-lifetime item score) is diagram-only and unverifiable against these
two sources. Both sources are screener/triage documents, not the full C-SSRS
research instrument or its scoring manual; a fuller Columbia scoring manual
was not located or checked. No ambiguity was found in what was checked — the
color coding and the 2026 document's explicit text agree with each other and
with the risk-identification page's prose — so nothing here is reported as
ambiguous.

**Confirmation channel.** Per the plan, this section is the evidence base for
a clinical-team sign-off, not the sign-off itself. The mapper change (Phase
1c) is a separate PR and requires that sign-off before merging.

---

## ICD-10 correction (Phase 1d)

The diagram's "Suicide Risk to Problem List" row (above) states, for the
Historical tier: `Z91.82 (History of Suicidal Behavior) or Z91.5 (History of
Suicide Attempt)`.

**This code is wrong, and the verification is already on record** — see the
slide-13 verification table in
[`suicide-care-dashboard-spec.md`](suicide-care-dashboard-spec.md#%EF%B8%8F-terminology-verification--one-code-on-slide-13-is-wrong):
`R45.851` is valid ("Suicidal ideations"); `Z91.82` is **not** suicide-related
— it means *personal history of military deployment* — and the intended code
is `Z91.51` (personal history of suicidal behavior), with `Z91.52` (personal
history of nonsuicidal self-harm) as its sibling; bare `Z91.5` is a valid
category but non-billable at that level of specificity.

This diagram repeats the **identical** `Z91.82` error found in the *Suicide
Care Dashboard* deck's slide 13, which confirms the two documents share one
upstream source for this problem-list guidance rather than being independent
transcription mistakes. Per the same rule stated there: **no SPiER artifact,
page, or card may ever show `Z91.82`.** Any future encoding of this diagram's
problem-list row (page copy, CDS card text, etc.) must use the corrected pair
(`Z91.51` / `Z91.52`) and cite this section plus the dashboard spec's
verification table — no gate checks ICD-10 literals (see that doc and
`suicide-safer-care-pathway.md` Phase 1d for why).
