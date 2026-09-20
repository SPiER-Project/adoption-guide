/**
 * Which module specifiers vite.config.ts aliases away.
 *
 * Shared by check:ucum and check:fhir-r5, which each guard one shim and both need
 * the same first question: "is this module actually aliased right now?" Reading
 * the config as text keeps those gates dependency-free and offline.
 *
 * ⚠️ This is a parser for one file's conventions, and its failure mode is the
 * dangerous kind. Both callers treat "not aliased" as "nothing to guard" and pass
 * — so a parser that silently returns an empty set turns both gates green while
 * the shims sit unchecked. That already nearly happened: the first version of the
 * ucum gate matched only the object form (`'@lhncbc/ucum-lhc':`), and moving the
 * config to the array form would have quietly disabled it. So `aliasedModules`
 * throws when it sees an alias block it cannot make sense of, rather than
 * reporting an absence it has not established.
 */

/** Turn `/^fhirpath\/fhir-context\/r5$/` into `fhirpath/fhir-context/r5`. */
function specifierFromPattern(pattern) {
  const anchored = /^\/\^(.+)\$\/$/.exec(pattern.trim())
  if (!anchored) return undefined
  return anchored[1].replace(/\\(.)/g, '$1')
}

/**
 * @param {string} src contents of vite.config.ts
 * @returns {Set<string>} module specifiers that resolve to something else
 */
export function aliasedModules(src) {
  const found = new Set()

  // `alias: [ { find: …, replacement: … }, … ]`
  for (const match of src.matchAll(/find:\s*([^,\n]+)/g)) {
    const raw = match[1].trim()
    const quoted = /^['"](.+)['"]$/.exec(raw)
    if (quoted) {
      found.add(quoted[1])
      continue
    }
    const fromRegex = specifierFromPattern(raw)
    if (fromRegex) {
      found.add(fromRegex)
      continue
    }
    throw new Error(
      `vite.config.ts has an alias \`find: ${raw}\` this parser cannot read. ` +
        'Teach scripts/lib/vite-alias.mjs about it — the shim gates read this, and ' +
        'an unreadable alias would leave them guarding nothing.',
    )
  }

  // `alias: { 'spec': …, }` — the object form, still legal and still used by
  // anyone who adds a plain entry.
  const objectBlock = /alias:\s*\{([\s\S]*?)\n\s*\},/.exec(src)
  if (objectBlock) {
    for (const match of objectBlock[1].matchAll(/^\s*['"]([^'"]+)['"]\s*:/gm)) {
      found.add(match[1])
    }
  }

  return found
}
