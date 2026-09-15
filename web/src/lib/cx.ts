/**
 * Join class names, dropping the falsy ones.
 *
 *   cx('risk-pill', sm && 'risk-pill--sm', `risk-pill--${level}`)
 *
 * Before this existed, every conditional class was a template literal with a
 * ternary — `` `pill ${sm ? 'pill--sm' : ''}` `` — which leaves a trailing
 * space when the condition is false, and a double space when two are. Three
 * files worked around it by smuggling the space INSIDE the string
 * (`'risk-pill--sm '`), which is the kind of thing that survives a copy-paste
 * and breaks a `querySelector('.pill--sm')` in a test. Sixteen sites carried
 * the ternary form on 2026-09-15.
 *
 * Deliberately tiny: strings and falsy values only — no objects, no arrays.
 * `check:css-dead` reads class names as bounded literals or as
 * `root--…${…}` template prefixes, and both of those survive this call
 * unchanged; an object-key form would hide them from the gate.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
