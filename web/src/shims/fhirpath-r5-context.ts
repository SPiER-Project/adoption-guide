/**
 * Build-time replacement for `fhirpath/fhir-context/r5`, wired up by the
 * `resolve.alias` in vite.config.ts. Not imported by any app code — do not
 * import it.
 *
 * ## Why
 *
 * `@formbox/renderer` statically imports *both* FHIR models —
 *
 *     import Cr from "fhirpath/fhir-context/r4";
 *     import Tr from "fhirpath/fhir-context/r5";
 *
 * — and picks one at render time from its `fhirVersion` prop. SPiER is R4-only:
 * both call sites (QuestionnaireView, StanleyBrownView) pass the literal `"r4"`,
 * so the R5 model is loaded and never selected. It cost 575KB raw / 67KB gzip of
 * the chunk every assessment route pulls.
 *
 * ## Shape
 *
 * An empty object rather than a throwing proxy, unlike the UCUM shim next door.
 * The difference is how the value is used: UCUM is *called*, so a throw names the
 * problem at the moment it happens. This model is only ever *passed* to fhirpath
 * as a type context, so there is no call to intercept — a throwing object would
 * fire at import time, on the R4 path, breaking every form. What guards this one
 * instead is `npm run check:fhir-r5`, which fails if any `fhirVersion` in the app
 * is not the literal `"r4"`, and which also checks that the renderer still
 * imports this exact specifier — so an upgrade that renames it fails the gate
 * rather than silently restoring the 67KB.
 */
export default {}
