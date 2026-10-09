// Types for reader-jargon.mjs, so the guide's and the clinical app's rendered-copy
// tests read the ONE rule list check:jargon uses. Keep in step with the .mjs exports.

export interface JargonRule {
  name: string
  re: RegExp
}

export const REPO_RULES: JargonRule[]
/** The clinician-copy rules: wire format named as a word. */
export const CLINICAL_RULES: JargonRule[]
export interface RepoIdentifierIndex {
  camel: Set<string>
  pascal: Set<string>
  subtracted: Set<string>
  fhirTypeNames: Set<string>
  artifactNames: Set<string>
  all: Set<string>
}

export function indexRepoIdentifiers(): RepoIdentifierIndex
export function repoJargonIn(text: string, identifiers: Set<string>): { rule: string; match: string } | null
