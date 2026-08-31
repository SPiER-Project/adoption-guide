/**
 * The pinned `fsh-sushi` version, shared by every SUSHI invocation.
 *
 * `fsh-sushi` used to be reproducible only by accident: it was a
 * `web/package.json` devDependency, so `npx` found the locked local copy in
 * `web/node_modules/.bin` before ever considering the registry. It no longer
 * is one (E2b, docs/plans/repo-and-package-boundaries.md §9.7), so the version
 * has to be named explicitly wherever sushi is invoked — `web/scripts/copy-fhir.mjs`
 * and `scripts/check-sushi-output.mjs` import this constant directly; the five
 * CI workflows that `npm install -g fsh-sushi` sed-scrape this file's source
 * (same mechanism as VALIDATOR_VERSION in validator-jar.mjs). One place decides
 * the sushi version for the whole repo, so a local `npm run copy-fhir` and a CI
 * compile can never quietly disagree.
 *
 * Bump it in its own PR.
 */
export const SUSHI_VERSION = '3.19.0'
