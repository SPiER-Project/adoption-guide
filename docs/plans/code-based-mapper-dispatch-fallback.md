# Plan: Code-based mapper dispatch fallback for non-IG-conformant EHRs

## Problem

Observation mappers dispatch **only** on the SPiER canonical `questionnaire` URL:

```ts
// web/src/lib/observationMappers/index.ts
const MAPPER_BY_QUESTIONNAIRE_URL = {
  [`${SPIER_Q}/PHQ-9`]: mapPHQ9,
  [`${SPIER_Q}/ASQ-Screening-Tool`]: mapASQ,
  // …
}
export function mapResponseToObservations(qr) {
  const canonical = qr?.questionnaire
  if (!canonical) return null
  const mapper = MAPPER_BY_QUESTIONNAIRE_URL[stripCanonicalVersion(canonical)]
  return mapper ? mapper(qr) : null
}
```

A QuestionnaireResponse authored by a foreign EHR carries **its own** canonical
(e.g. `http://loinc.org/q/44249-1`, an Epic internal URL, or none at all). Today
these fall through to `null` → no derived Observations, no risk alert; the QR
lands in the chart's "Other activity" bucket. This is documented as a known
limitation in `web/src/lib/dataSource/smartDataSource.ts:14`.

The goal: when the canonical doesn't match, **recognize the instrument from the
data itself** (standard item codes) and route to the existing mapper.

## Key constraint

The current mappers extract answers by **linkId** (`walkItems(items, 'q1')`) and
resolve ordinal weights by joining the QR answer code back to the *SPiER*
Questionnaire's `answerOption[ordinalValue]` extension
(`ordinalForAnswer()` in `web/src/data/questionnaires.ts`). A foreign QR will
**not** have SPiER linkIds and its Questionnaire won't be in `QUESTIONNAIRE_BY_URL`.
So a fallback can't just re-point the same mapper — it needs a normalization step
that maps foreign items → SPiER linkIds/ordinals before the mapper runs.

## Approach — three-tier dispatch

Extend `mapResponseToObservations` to try, in order:

1. **Tier 1 — canonical URL** (today's behavior; highest confidence).
2. **Tier 2 — item-code recognition.** Match on standardized item `code`s
   (LOINC per-item codes) present on `QuestionnaireResponse.item[].code` or, if a
   contained/prefetched Questionnaire is available, on `Questionnaire.item.code`.
   PHQ-9 has per-item LOINC (`44250-9`…`44262-4`, panel `44249-1`); if a QR's
   items carry those, we can confidently say "this is PHQ-9" regardless of URL.
3. **Tier 3 — shape heuristic (opt-in, low confidence).** e.g. "9 ordinal items,
   each 0–3, sum 0–27" ⇒ likely PHQ-9. Emits Observations flagged
   `interpretation`-only + a provenance note that dispatch was heuristic. Gate
   behind a flag so it never silently fabricates a risk tier in production.

Tiers 2/3 route through a **normalizer** that yields a synthetic, SPiER-shaped
QR (linkIds `q1..q9`, SPiER answer codes) which the *unchanged* existing mapper
consumes. This keeps mapper logic single-sourced.

## Design

New module `web/src/lib/observationMappers/fallbackDispatch.ts`:

- `INSTRUMENT_SIGNATURES: InstrumentSignature[]` — one per supported instrument:
  ```ts
  interface InstrumentSignature {
    spierCanonical: string          // → existing mapper key
    itemCodes: { system: string; code: string; linkId: string }[]  // LOINC → SPiER linkId
    minCodeMatches: number          // Tier-2 threshold
    shape?: { itemCount: number; ordinalRange: [number, number] } // Tier-3
  }
  ```
- `recognizeInstrument(qr): { canonical; confidence: 'code' | 'shape' } | null`
- `normalizeToSpierQr(qr, signature): QuestionnaireResponseResource` — remaps
  foreign items to SPiER linkIds + SPiER answer codes so `ordinalForAnswer()`
  resolves against the bundled SPiER Questionnaire.

Wire into `index.ts`:

```ts
export function mapResponseToObservations(qr, opts = { allowHeuristic: false }) {
  const canonical = qr?.questionnaire
  const direct = canonical && MAPPER_BY_QUESTIONNAIRE_URL[stripCanonicalVersion(canonical)]
  if (direct) return direct(qr)

  const recognized = recognizeInstrument(qr)
  if (!recognized) return null
  if (recognized.confidence === 'shape' && !opts.allowHeuristic) return null

  const mapper = MAPPER_BY_QUESTIONNAIRE_URL[recognized.canonical]
  return mapper ? mapper(normalizeToSpierQr(qr, recognized)) : null
}
```

## Provenance / honesty

- Stamp fallback-derived Observations with a distinguishing marker in
  `deriveFromResponse` (`web/src/lib/deriveFromResponse.ts`) — e.g. a
  `Provenance`-style note or a `derivedFrom` display like
  "derived via code-based recognition (canonical did not match)".
- Update the "Other activity" contract note in `smartDataSource.ts:14` — foreign
  QRs that now match will produce alerts.
- Surface confidence in the risk alert `detail` when it came from Tier 2/3 so a
  clinician knows the mapping was inferred.

## Scope

- **Phase 1:** Tier 2 for the two instruments with real LOINC item codes (PHQ-9;
  check ASQ/C-SSRS coverage — ASQ has no LOINC item codes per repo notes, so it's
  Tier-3-only). Ship behind default-off `allowHeuristic` for Tier 3.
- **Phase 2:** Extend signatures to remaining instruments; consider reading a
  prefetched/contained Questionnaire for richer code matching.

## Files touched

- `web/src/lib/observationMappers/fallbackDispatch.ts` (new)
- `web/src/lib/observationMappers/index.ts` (dispatch + `opts`)
- `web/src/lib/deriveFromResponse.ts` (provenance stamping + pass `allowHeuristic`)
- `web/src/lib/dataSource/smartDataSource.ts` (update limitation comment; decide
  whether SMART path opts into heuristic)
- `services/cds-hooks/src/service.ts` — the service also calls
  `mapResponseToObservations` on prefetched QRs; decide fallback policy there too.

## Tests

- New unit tests: foreign-canonical PHQ-9 QR with LOINC item codes → same
  Observations/alert as the native SPiER PHQ-9 fixture.
- QR with no canonical + LOINC item codes → Tier 2 hit.
- Ambiguous shape without `allowHeuristic` → `null` (no fabricated tier).
- Regression: existing native fixtures unchanged.
- Add a `check:*`-style guard if signatures duplicate LOINC codes already living
  in the mappers (drift risk — see CLAUDE.md "Drift-prone hand-duplicated values").

## Risks

- **False positives** on shape heuristics fabricating a risk tier — mitigated by
  default-off gating + provenance labeling.
- **Ordinal join** assumes foreign answer *values* can be remapped to SPiER
  answer codes; if a foreign QR uses free integers instead of codings, the
  normalizer must synthesize codings (map integer → SPiER answerOption code).
- **Code drift:** LOINC item codes now live in a third place — add a drift check.
