# C-SSRS — Columbia-Suicide Severity Rating Scale

## Provenance

The C-SSRS is the reference suicide-risk assessment instrument, developed at
Columbia University. It assesses suicidal ideation on a five-level severity
hierarchy plus a suicidal-behavior item, with published risk stratification.

| | |
|---|---|
| **Authors** | Posner, K.; Brent, D.; Lucas, C.; Gould, M.; Stanley, B.; Brown, G.; Fisher, P.; Zelazny, J.; Burke, A.; Oquendo, M.; Mann, J. |
| **Rights holder** | © 2008 The Research Foundation for Mental Hygiene, Inc. |
| **Registration** | [cssrs.columbia.edu](https://cssrs.columbia.edu) — free to use but copyrighted and permission-based. An adopting system registers with the Columbia Lighthouse Project; some administration contexts require training; **item wording may not be altered**; the copyright notice must be retained on every version. |
| **Licensing** | Status `registration`, with the conditions above, on each `AdministerCSSRS*` ActivityDefinition (`instrument-licensing-status` + `copyright`). The evidence and the one open item — whether a FHIR representation is covered by a site's own registration — are in [`licensing/MEMO.md`](licensing/MEMO.md). |

## What's in this folder

Four administrations of the instrument, all deriving the same
`SPiERCSSRSRiskLevel` Observation (`none` / `low` / `moderate` / `high`) so they
share one crosswalk into the common suicide-risk tier.

| File | Administration | Root panel |
|---|---|---|
| `cssrs-screener.json` | Screener with Triage Points (recent) — the 6-item set | LOINC `93373-9` |
| `cssrs-full-lifetime-recent.json` | Full scale: 5 ideation levels over a dual lifetime + past-month timeframe, 5 intensity ratings (frequency, duration, controllability, deterrents, reasons), and the full behavior section (actual, interrupted and aborted attempts, preparatory acts, lethality) | LOINC `93245-9` |
| `cssrs-since-last-contact.json` | The same 6-item set scoped to the interval since the patient's prior contact — a repeat assessment | **None.** LOINC codes C-SSRS items only for lifetime, 1-month and 3-month windows, and none of those is this reference period; a LOINC item code here would assert a window the instrument does not claim, so the items bind to the SPiER-local `cssrs-interval-item` CodeSystem. The ideation and behavior *sections* keep their LOINC codes (`93278-0`, `93304-4`) |
| `cssrs-pediatric.json` | The validated 6-item screener targeted at pediatric/adolescent settings — pediatric `useContext`, age Child, with a parent/guardian involvement instruction | LOINC `93373-9` |
| `licensing/MEMO.md` | The licensing audit and its open item | |

Two things about those administrations are worth knowing before implementing
them, because neither is visible from the file:

- The interval form's framing lives in its title, description and instruction
  only. **Item wording is unchanged**, per the registration terms, and its
  behavior item drops the "within the past 3 months" recency sub-question
  because its whole reference period is already the interval since last contact.
- The pediatric form uses the standard **adolescent**-validated wording. The
  Columbia Lighthouse Project's separate simplified wording for younger children
  is a pending licensing and verification gate (see the MEMO) — it is not
  approximated here.

Everything else is defined in the IG and rendered there:
[`ig/input/fsh/cssrs.fsh`](../../ig/input/fsh/cssrs.fsh) holds the risk-level
and interval-item CodeSystems, the `SPiERCSSRSRiskLevel` profile, the four
ActivityDefinitions with their stage membership and licensing, and the example
instances; [`ig/input/fsh/crosswalk-cssrs.fsh`](../../ig/input/fsh/crosswalk-cssrs.fsh)
holds the ConceptMap onto the common tier.

## The risk ladder, and where it is stated

The item→level ladder is **not** restated here. Each concept in
`CSSRSRiskLevelCodes` carries its own criteria — including that item 6 endorsed
*within the past three months* scores `high` while lifetime-only item 6 scores
`moderate` — so the definition renders in the IG next to the code it defines.

Two notes that the artifacts do not carry:

- **The ladder is verified against published sources.** It was checked against
  the CMS-hosted 2008 *Screen Version — Recent* PDF and the Columbia Lighthouse
  Project's 2026 *Screen with Triage Points for Primary Care*, which agree
  item-for-item. Record:
  [`docs/reference/suicide-safer-care-pathway-spec.md`](../../docs/reference/suicide-safer-care-pathway-spec.md)
  § *Published-instrument verification (Phase 1b)*.
- **The source pathway diagram's fourth tier is deliberately not implemented.**
  That diagram places lifetime-only item 6 in a separate "Historical" tier below
  Low. Neither published source defines a fourth level, and both score that
  pattern Moderate. Whether SPiER should instead carry historical risk as an
  orthogonal *flag* is an open clinical question — see
  [`docs/plans/suicide-safer-care-pathway.md`](../../docs/plans/suicide-safer-care-pathway.md),
  open question 2.
