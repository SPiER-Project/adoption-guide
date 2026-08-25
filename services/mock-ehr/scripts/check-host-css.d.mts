/**
 * Types for `check-host-css.mjs`.
 *
 * The gate is plain ESM so it can run from `package.json` with no build step —
 * the same arrangement every check script in this repo uses. It is also imported
 * by `src/hostCss.test.ts`, and `tsconfig.json` is strict, so it needs a
 * declaration. Hand-written rather than generated: four exports, and turning on
 * `allowJs` to avoid writing them would pull every script in this folder into
 * the typecheck.
 */
export declare const HEX: RegExp
export declare function looksLikeColour(hex: string): boolean
export declare function decomment(text: string): string
/** Runs both rules. Returns a process exit code: 0 clean, 1 problems found. */
export declare function checkHostCss(): number
