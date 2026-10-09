// Types for reader-jargon.mjs, so the guide's rendered-copy test reads the ONE
// rule list check:jargon uses. Keep in step with the .mjs exports.

export interface JargonRule {
  name: string
  re: RegExp
}

export const REPO_RULES: JargonRule[]
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

/** What a clinician may not be shown — the wire format. */
export const CLINICAL_RULES: JargonRule[]
/** The first clinical-or-repo rule `text` breaks, or null. */
export function clinicalJargonIn(text: string): { rule: string; match: string } | null
