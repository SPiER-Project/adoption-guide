/**
 * The slice of `@lhncbc/ucum-lhc` the CQL harness calls, which ships no types.
 *
 * Test-only: under vitest the import resolves to the real library. The app
 * build aliases the package to shims/ucum-lhc.ts, which this does not describe.
 */
declare module '@lhncbc/ucum-lhc' {
  interface UcumLhcUtils {
    validateUnitString(unit: string): { status: string; msg?: string[] }
    convertUnitTo(from: string, value: number, to: string): { status: string; toVal?: number; msg?: string[] }
  }
  const ucum: { UcumLhcUtils: { getInstance(): UcumLhcUtils } }
  export default ucum
}
