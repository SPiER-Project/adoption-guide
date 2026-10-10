/**
 * The markdown a tool's description may carry, and the one construct the guide
 * renders from it.
 *
 * `ActivityDefinition.description` is FHIR `markdown`, and the IG renders it as
 * such. The guide printed it as plain text, so a reader of TL-037 met
 * `` `EpisodeOfCare?type=suicide-safer-care&status=active&_revinclude=Task:based-on` ``
 * with its backticks. Every description published today uses ONE construct —
 * the inline code span (five tools) — so that is what `splitCodeSpans` renders,
 * and `unsupportedMarkdown` is what a test holds every description to: a
 * description that starts using bold, a link or a list fails there, by tool,
 * rather than reaching a reader as asterisks and brackets.
 *
 * ⚠️ Not a markdown parser, on purpose. `react-markdown` is in package.json but
 * imported nowhere (its one caller went with the pilot-plan page); a parser
 * and its micromark tree to render five code spans is the wrong trade while
 * the test above keeps the input to what this handles.
 */

export type InlinePart = { kind: 'text'; text: string } | { kind: 'code'; text: string }

/** A description as text and code-span runs, backticks removed. */
export function splitCodeSpans(text: string): InlinePart[] {
  return text
    .split(/(`[^`\n]+`)/)
    .filter(part => part.length > 0)
    .map(part =>
      part.length > 1 && part.startsWith('`') && part.endsWith('`')
        ? { kind: 'code', text: part.slice(1, -1) }
        : { kind: 'text', text: part },
    )
}

/** Markdown constructs the guide does NOT render, and how each is recognised. */
const UNSUPPORTED: Array<{ name: string; re: RegExp }> = [
  { name: 'bold', re: /\*\*[^*]+\*\*|__[^_]+__/ },
  { name: 'emphasis', re: /(?<![*\w])\*[^*\s][^*]*\*(?![*\w])/ },
  { name: 'a link', re: /\[[^\]]+\]\([^)]+\)/ },
  { name: 'a list', re: /(?:^|\n)\s*(?:[-*+]|\d+\.)\s/ },
  { name: 'a heading', re: /(?:^|\n)#{1,6}\s/ },
  { name: 'a paragraph break', re: /\n\s*\n/ },
  { name: 'an unclosed code span', re: /^[^`]*(?:`[^`\n]+`[^`]*)*`[^`]*$/ },
]

/** The names of the constructs in `text` that the guide would show as raw syntax. */
export function unsupportedMarkdown(text: string): string[] {
  return UNSUPPORTED.filter(rule => rule.re.test(text)).map(rule => rule.name)
}
