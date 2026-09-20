/**
 * Add `code` to a selection list if absent, remove it if present — the one
 * behaviour every multi-select recorder needs. Was a private `toggle` in two
 * views (C3 of the 2026-09-20 audit); `scripts/check-duplicate-code.mjs` fails
 * a third.
 */
export function toggleCode(list: readonly string[], code: string): string[] {
  return list.includes(code) ? list.filter(c => c !== code) : [...list, code]
}
