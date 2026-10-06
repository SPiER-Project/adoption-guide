#!/usr/bin/env node
/**
 * check:fhir-r5 — dropping the R5 type model is still safe.
 *
 * `@formbox/renderer` statically imports both FHIR models and selects one from
 * its `fhirVersion` prop. SPiER is R4-only, so vite.config.ts aliases
 * `fhirpath/fhir-context/r5` to an empty object (shims/fhirpath-r5-context.ts)
 * and the chunk every assessment route loads drops 575KB raw / 67KB gzip.
 *
 * That rests on two claims, one rule each:
 *
 *  RULE 1  the alias and the shim exist together, or neither does
 *  RULE 2  every `fhirVersion` in the app is the literal "r4" — an R5 render
 *          would be handed the empty model and fail in a way no type checker sees
 *  RULE 3  the renderer still imports this exact specifier. Liveness: if an
 *          upgrade renames or drops the import, the alias stops applying and the
 *          67KB comes back silently — that is the failure this rule exists for,
 *          because the app would look and behave completely normally.
 *
 * ⚠️ Plant a defect and watch it fail before trusting it: `fhirVersion="r5"`,
 * a computed `fhirVersion={version}`, a spread `{...{ fhirVersion: 'r5' }}`, a
 * `createElement(Renderer, …)`, deleting the alias while keeping the shim,
 * and a renderer that no longer imports the R5 context.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aliasedModules } from './lib/vite-alias.mjs'
import { REPO_ROOT, appRootFloors } from './lib/app-roots.mjs'
import { STYLE_ROOTS, walkExt, relRepo } from './lib/style-roots.mjs'
import { reportFloors } from './lib/floors.mjs'
import ts from 'typescript'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VITE_CONFIG = join(REPO, 'vite.config.ts')
const SHIM = join(REPO_ROOT, 'shims/fhirpath-r5-context.ts')
const SPECIFIER = 'fhirpath/fhir-context/r5'
const RENDERER_DIST = join(REPO, 'node_modules/@formbox/renderer/dist')
const SUPPORTED_VERSION = 'r4'

const errors = []
const fail = msg => errors.push(msg)

// ── RULE 1 — alias and shim travel together ───────────────────────────────────

const aliased = aliasedModules(readFileSync(VITE_CONFIG, 'utf8')).has(SPECIFIER)
const shimExists = existsSync(SHIM)

if (!aliased && !shimExists) {
  console.log(`✓ fhir-r5: ${SPECIFIER} is not stubbed — nothing to guard`)
  process.exit(0)
}
if (aliased && !shimExists) {
  fail(`vite.config.ts aliases ${SPECIFIER} but shims/fhirpath-r5-context.ts does not exist`)
}
if (!aliased && shimExists) {
  fail(
    'shims/fhirpath-r5-context.ts exists but vite.config.ts no longer aliases ' +
      `${SPECIFIER} — a dead shim, and the R5 model is back in the bundle. ` +
      'Delete the shim, or restore the alias.',
  )
}
if (errors.length > 0) report()

// ── RULE 2 — the app only ever renders R4 ─────────────────────────────────────

// ⚠️ **Every component tree, not `web/src`.** The one thing that renders a
// Questionnaire — `QuestionnaireView`, the sole bearer of a `fhirVersion` prop —
// moved to packages/tool-views, and a `web/src`-only scan found zero. The
// `versionProps === 0` guard below is what turned that into a loud failure
// instead of a shim reported safe on the strength of having checked nothing.
const sources = STYLE_ROOTS.flatMap(r => walkExt(r.dir, ['.ts', '.tsx']))

// ⚠️ **Parsed, not regexed.** Until 2026-10-06 this was a text match for
// `fhirVersion=…`, and it counted the doc comment in QuestionnaireView.tsx as
// one of its "2 props" — so replacing the real prop with a spread,
// `{...{ fhirVersion: 'r5' }}`, left the comment holding the zero-guard up and
// the gate reported "1 fhirVersion prop(s) all r4". An AST has no comments, and
// the rule is now stated over the renderer itself:
//
//   (a) every JSX element whose tag is the `Renderer` imported from
//       @formbox/renderer carries exactly one `fhirVersion` attribute whose
//       value is the literal "r4", and no spread attribute (a spread can carry a
//       version this gate cannot read);
//   (b) `Renderer` is used ONLY as a JSX tag — passing it as a value
//       (`createElement(Renderer, props)`, a wrapper map) hides its props;
//   (c) the identifier `fhirVersion` appears nowhere except as such an
//       attribute — an object key, a variable, a shorthand property would carry
//       a version to the renderer by a route (a) cannot see.
const RENDERER_PACKAGE = '@formbox/renderer'
let versionProps = 0
let rendererElements = 0
for (const path of sources) {
  const src = readFileSync(path, 'utf8')
  if (!src.includes('fhirVersion') && !src.includes(RENDERER_PACKAGE)) continue
  const rel = relRepo(path)
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const at = (node) => `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`

  // Local names the renderer component is imported under.
  const rendererNames = new Set()
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier) &&
        stmt.moduleSpecifier.text === RENDERER_PACKAGE) {
      if (stmt.importClause?.isTypeOnly) continue
      // The package's default export IS the Renderer (QuestionnaireView imports it that way).
      if (stmt.importClause?.name) rendererNames.add(stmt.importClause.name.text)
      const named = stmt.importClause?.namedBindings
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) {
          if ((el.propertyName ?? el.name).text === 'Renderer') rendererNames.add(el.name.text)
        }
      }
    }
  }

  const visit = (node) => {
    // (a) the renderer's own JSX elements
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        ts.isIdentifier(node.tagName) && rendererNames.has(node.tagName.text)) {
      rendererElements++
      const attrs = node.attributes.properties
      for (const a of attrs) {
        if (ts.isJsxSpreadAttribute(a)) {
          fail(`${at(a)}: <${node.tagName.text}> takes a spread attribute — it could carry a fhirVersion this gate cannot read. Pass the props explicitly.`)
        }
      }
      const versions = attrs.filter(a => ts.isJsxAttribute(a) && a.name.getText(sf) === 'fhirVersion')
      if (versions.length !== 1) {
        fail(`${at(node)}: <${node.tagName.text}> has ${versions.length} fhirVersion attribute(s); it needs exactly one, the literal "${SUPPORTED_VERSION}".`)
      }
    }
    // (b) the renderer used as a value
    if (ts.isIdentifier(node) && rendererNames.has(node.text) &&
        !ts.isImportSpecifier(node.parent) && !ts.isImportClause(node.parent) &&
        !((ts.isJsxOpeningElement(node.parent) || ts.isJsxSelfClosingElement(node.parent) ||
           ts.isJsxClosingElement(node.parent)) && node.parent.tagName === node)) {
      fail(`${at(node)}: ${node.text} (from ${RENDERER_PACKAGE}) is used as a value, not a JSX tag — its fhirVersion cannot be verified. Render it as <${node.text} fhirVersion="${SUPPORTED_VERSION}" …>.`)
    }
    // (c) every other mention of fhirVersion
    if (ts.isIdentifier(node) && node.text === 'fhirVersion') {
      const attr = node.parent
      if (ts.isJsxAttribute(attr) && attr.name === node) {
        versionProps++
        let init = attr.initializer
        if (init && ts.isJsxExpression(init)) init = init.expression
        if (!init || !ts.isStringLiteral(init)) {
          fail(`${at(attr)}: fhirVersion=${attr.initializer?.getText(sf) ?? '(boolean)'} is computed — the R5 model is stubbed out, so this prop has to be a literal the gate can verify. Pass "${SUPPORTED_VERSION}", or drop the alias.`)
        } else if (init.text !== SUPPORTED_VERSION) {
          fail(`${at(attr)}: fhirVersion="${init.text}" — only "${SUPPORTED_VERSION}" works while the R5 model is stubbed out (it resolves to an empty object). Drop the alias in vite.config.ts.`)
        }
      } else if (!ts.isTypeReferenceNode(attr) && !ts.isQualifiedName(attr) && !ts.isIndexedAccessTypeNode(attr)) {
        fail(`${at(node)}: \`fhirVersion\` outside a JSX attribute (${ts.SyntaxKind[attr.kind]}) — a version handed to the renderer this way cannot be verified. Pass the literal attribute fhirVersion="${SUPPORTED_VERSION}" on <Renderer>.`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

if (versionProps === 0 || rendererElements === 0) {
  fail(
    `found ${rendererElements} <Renderer> element(s) and ${versionProps} fhirVersion attribute(s) in the ` +
      'component trees — either nothing renders a Questionnaire any more (delete the shim) or this scan ' +
      'has stopped matching, in which case RULE 2 is checking nothing.',
  )
}

// ── RULE 3 — the renderer still imports the specifier we alias ────────────────

if (!existsSync(RENDERER_DIST)) {
  fail('@formbox/renderer is not installed — run npm ci; this check cannot verify the alias without it')
} else {
  const bundles = readdirSync(RENDERER_DIST).filter(f => f.endsWith('.js'))
  // The *whole* quoted specifier, closing quote included. A bare `includes()`
  // was the first version of this and it passed a planted rename to
  // `fhirpath/fhir-context/r5-renamed`, which still contains the old string —
  // exactly the case the rule is here to catch, since a renamed import means the
  // alias silently stops applying.
  const quoted = new RegExp(`['"]${SPECIFIER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)
  const importsR5 = bundles.some(f => quoted.test(readFileSync(join(RENDERER_DIST, f), 'utf8')))
  if (!importsR5) {
    fail(
      `@formbox/renderer no longer imports ${SPECIFIER}, so the alias matches nothing. ` +
        'Either the R5 model is gone from its dependency tree (delete the shim and the alias — ' +
        'the saving is already yours) or the specifier changed and the 67KB is silently back. ' +
        'Check which before touching this.',
    )
  }
}

// ⚠️ The `versionProps === 0` guard above catches a scan that matched nothing.
// This catches the tree moving out from under it — which is what the `apps/`
// split does to every gate that names an app root by path.
reportFloors(appRootFloors(), fail)

report()

function report() {
  if (errors.length > 0) {
    console.error(`\n✗ fhir-r5 shim: ${errors.length} problem${errors.length === 1 ? '' : 's'}\n`)
    for (const e of errors) console.error(`  • ${e}`)
    console.error('\n  See shims/fhirpath-r5-context.ts for what the shim is and why.\n')
    process.exit(1)
  }
  console.log(
    `✓ fhir-r5: shim active, ${rendererElements} <Renderer> element(s), ${versionProps} fhirVersion prop(s) all "${SUPPORTED_VERSION}", ` +
      'renderer still imports the aliased specifier',
  )
}
