/**
 * Build-time replacement for `@lhncbc/ucum-lhc`, wired up by the `resolve.alias`
 * in vite.config.ts. Not imported by any app code — do not import it.
 *
 * ## Why
 *
 * UCUM is a units-of-measure library: ~557KB raw / ~117KB gzip, 30% of the chunk
 * every assessment route loads. Nothing in SPiER reaches it. Two independent
 * consumers drag it in:
 *
 * - **`fhirpath` requires it eagerly**, at module scope — `src/types.js`,
 *   `src/hash-object.js` and `src/fhirpath.js` each call
 *   `UcumLhcUtils.getInstance()` on import — but only *uses* it for Quantity
 *   arithmetic and comparison (`convertUnitTo`, `convertToBaseUnits`,
 *   `getSpecifiedUnit`). It is a plain dependency with no optional flag and no
 *   lighter entry point, so an alias is the only way out.
 * - **`@formbox/renderer`** constructs it lazily, and only on the Quantity
 *   compare and Quantity min/max bound paths.
 *
 * All 18 SPiER Questionnaires are `choice` / `group` / `string` / `text` /
 * `integer` / `display` — zero quantity items — and the only two FHIRPath
 * expressions in them are unit-free integer sums
 * (`%resource.item.where(linkId.startsWith('q')).answer.weight().sum()`).
 * Verified end to end with this shim in place: all 18 forms render, PHQ-9 scores
 * 27/27 and submits to the right risk tier, and no method below is ever called.
 *
 * ## Why these throw
 *
 * A failed UCUM conversion is a *value* — fhirpath folds `{status: 'failed'}`
 * into a result and carries on, which for an instrument score means a silently
 * wrong number. That is the one outcome this app must not produce, so the shim
 * fails loudly instead. `npm run check:ucum` is what makes reaching one of these
 * a build error rather than a runtime surprise: it fails if a Questionnaire grows
 * a quantity item or a unit-bearing expression, and it derives the method list
 * below from the installed `fhirpath` and `@formbox/renderer`, so a dependency
 * that starts calling a *new* UCUM method fails the gate instead of the page.
 */
class UcumLhcUtilsShim {
  private static instance: UcumLhcUtilsShim | undefined

  /** fhirpath calls this at module scope, so it must not throw. */
  static getInstance(): UcumLhcUtilsShim {
    return (UcumLhcUtilsShim.instance ??= new UcumLhcUtilsShim())
  }

  private unreachable(method: string): never {
    throw new Error(
      `@lhncbc/ucum-lhc is stubbed out of this build (see web/src/shims/ucum-lhc.ts), ` +
        `but ${method}() was called. Something now uses UCUM units — a quantity item in a ` +
        `Questionnaire, or a FHIRPath expression over Quantity values. Drop the resolve.alias ` +
        `in vite.config.ts to restore the real library.`,
    )
  }

  convertUnitTo(): never {
    this.unreachable('convertUnitTo')
  }

  convertToBaseUnits(): never {
    this.unreachable('convertToBaseUnits')
  }

  getSpecifiedUnit(): never {
    this.unreachable('getSpecifiedUnit')
  }

  validateUnitString(): never {
    this.unreachable('validateUnitString')
  }
}

export const UcumLhcUtils = UcumLhcUtilsShim
export default { UcumLhcUtils: UcumLhcUtilsShim }
