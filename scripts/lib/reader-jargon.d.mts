// Types for reader-jargon.mjs, so the guide's rendered-copy test reads the ONE
// rule list check:jargon uses. Keep in step with the .mjs exports.

export interface JargonRule {
  name: string
  re: RegExp
}

export const REPO_RULES: JargonRule[]
export function repoJargonIn(text: string): { rule: string; match: string } | null
