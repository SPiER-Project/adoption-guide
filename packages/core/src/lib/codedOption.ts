/**
 * A `{ code, display }` pair as the recorders' option lists carry them, and the
 * one lookup every recorder does over such a list.
 *
 * Both were defined FOUR times — `CodedOption` in handoffs.ts and
 * riskEpisode.ts, `displayFor` byte-identical in handoffs.ts, followUp.ts,
 * riskEpisode.ts and lethalMeans.ts — because each stage's builders were
 * written in their own PR and copied the neighbour's helpers (C3 of the
 * 2026-09-20 audit). `scripts/check-duplicate-code.mjs` fails a fifth copy.
 */
/** `C` narrows `code` to a generated union where the list is one CodeSystem's. */
export interface CodedOption<C extends string = string> {
  code: C
  display: string
}

/** The display for `code` in `options`, or the code itself when the list does not know it. */
export function displayFor(options: readonly CodedOption[], code: string): string {
  return options.find(o => o.code === code)?.display ?? code
}
