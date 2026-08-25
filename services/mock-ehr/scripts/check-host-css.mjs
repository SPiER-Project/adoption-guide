#!/usr/bin/env node
/**
 * check-host-css — the mock EHR's stand-in for the app's CSS gates.
 *
 * The app gets two guarantees from tooling that cannot see this Worker: stylelint
 * rejects raw hex (`color-no-hex`) and `check:tokens` fails any `var(--token)`
 * that resolves to nothing. Neither runs here — these pages are template strings
 * inside TypeScript, with no stylesheet for a CSS linter to read.
 *
 * ⚠️ **The absence was not theoretical.** `hostChrome.ts` was extracted from
 * `controlPage.ts` specifically to give the palette one definition, and
 * `controlPage.ts` then went on hand-typing `#5c4a54`, `#f3eef1`, `#d8cdd4` and
 * `#fdf5f8` in its own hand-rolled document for as long as it existed. A comment
 * asking people not to do that had already failed; this is the version that
 * fails the build.
 *
 * Two rules:
 *
 *   A. **No hex outside the token block.** A colour has one definition, in
 *      `TOKENS`. Everything else says `var(--…)`.
 *   B. **Every `var(--…)` resolves.** stylelint's blind spot, and the app hit it
 *      for real (#280): `color: var(--made-up)` satisfies "uses a token" and
 *      ships a value the browser drops. A fallback does not excuse an undefined
 *      token — it hides it — so `var(--x, red)` is checked the same way.
 *
 * ⚠️ Both rules **fail when they read nothing** rather than passing over an
 * unread file. A gate that reports green while scanning zero bytes is the
 * failure this repo keeps catching (#232, #261), and it is especially easy here:
 * the token block is located by parsing for `export const TOKENS`, so renaming
 * that export would otherwise leave every hex in the file suddenly "outside the
 * block" — or, with the opposite bug, leave the scan with no tokens to check
 * against and every `var()` passing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const TOKEN_FILE = join(SRC, 'hostChrome.ts')

/** Files that legitimately contain no CSS; scanned anyway, since that is free. */
function sources(dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sources(full)
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : []
  })
}

/**
 * A hex colour, as opposed to the two other things that look exactly like one.
 *
 * `#/population/summary` is a route and `#404` is a GitHub issue — and this repo
 * cites issue numbers constantly, so a bare `/#[0-9a-f]{3,8}/` reported 25 false
 * positives on its first run and zero real ones. Two filters, in order:
 *
 *   1. **Comments are stripped first** (`decomment` below), which removes every
 *      `see #232` in prose — including the ones inside CSS comments, which a
 *      JS-only comment stripper would miss.
 *   2. **A survivor must look like a colour**: contain a hex *letter*, or be a
 *      full 6/8 digits. `#404` and `#12` are neither.
 *
 * ⚠️ **The stated hole: an all-decimal 3- or 4-digit colour** — `#000`, `#111`.
 * Their six-digit spellings ARE caught, and a shorthand grey is not a thing this
 * palette contains, so the trade is a gate with no false positives over one
 * nobody trusts. `check-host-css.test.ts` pins both halves.
 */
export const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/g

export function looksLikeColour(hex) {
  const digits = hex.slice(1)
  return /[a-fA-F]/.test(digits) || digits.length >= 6
}

/**
 * Blank out `//` and comment blocks, preserving offsets and newlines so the line
 * numbers this script reports still point at the real line.
 *
 * Replaces with spaces rather than deleting: a naive strip shifts every offset
 * after the first comment, and the gate then reports the wrong line — which is
 * how a correct finding gets dismissed as a bad tool.
 */
export function decomment(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length))
}

/** `var(--name)` or `var(--name, fallback)`. */
const VAR_USE = /var\(\s*(--[\w-]+)/g

/** `--name:` in a declaration block. */
const TOKEN_DEF = /(--[\w-]+)\s*:/g

/**
 * `setProperty('--name', …)` — a token published by the page script rather than
 * declared in `TOKENS`.
 *
 * The second legitimate source, and **scraped rather than allowlisted**, which
 * is the same choice `web/`'s `check:tokens` makes and for the same reason: an
 * allowlist outlives the code that earned it, while a scrape dies with it. One
 * today — `--panel-width`, the dock's width, which the chart script reads from
 * the operator's stored preference and which therefore cannot be a static
 * declaration. Every run prints them, so the exemption is visible rather than
 * merely permitted.
 */
const RUNTIME_DEF = /setProperty\(\s*['"](--[\w-]+)['"]/g

/**
 * Run the two rules. Returns a process exit code rather than calling
 * `process.exit` so the tests can assert on it — and so a future caller can
 * run it in-process without killing the runner.
 */
export function checkHostCss() {
  const problems = []

  // ── The token block ────────────────────────────────────────────────────────
  const tokenSource = readFileSync(TOKEN_FILE, 'utf8')
  const open = tokenSource.indexOf('export const TOKENS = `')
  if (open === -1) {
    console.error(
      'check-host-css: could not find `export const TOKENS = \\`` in src/hostChrome.ts.\n' +
      'Every colour in this service is defined in that block and located by parsing for it.\n' +
      'If it was renamed, rename it here too — this script will not guess.',
    )
    return 1
  }
  const close = tokenSource.indexOf('\n`', open)
  if (close === -1) {
    console.error('check-host-css: found `export const TOKENS` but not the end of its template literal.')
    return 1
  }
  const tokenBlock = tokenSource.slice(open, close)

  const defined = new Set()
  for (const [, name] of tokenBlock.matchAll(TOKEN_DEF)) defined.add(name)
  if (defined.size === 0) {
    console.error('check-host-css: the TOKENS block parsed to zero definitions. Refusing to check var() against nothing.')
    return 1
  }

  // ── Rule A: no hex outside the token block ─────────────────────────────────
  const files = sources(SRC)
  if (files.length === 0) {
    console.error(`check-host-css: found no .ts sources under ${SRC}.`)
    return 1
  }

  let hexOutside = 0
  let varUses = 0

  // Collected before the main pass: a token may be published in one file and used
  // in another, so every source has to be read before any var() can be judged.
  const runtime = new Map()
  for (const file of files) {
    const rel = relative(join(SRC, '..'), file)
    for (const [, name] of decomment(readFileSync(file, 'utf8')).matchAll(RUNTIME_DEF)) {
      runtime.set(name, rel)
    }
  }

  for (const file of files) {
    const raw = readFileSync(file, 'utf8')
    const rel = relative(join(SRC, '..'), file)
    // The token block is the one sanctioned home for a hex literal, so blank it
    // out of this file's text rather than skipping the file — the rest of
    // hostChrome.ts is held to the same rule as everything else.
    const text = file === TOKEN_FILE
      ? raw.slice(0, open) + ' '.repeat(tokenBlock.length) + raw.slice(open + tokenBlock.length)
      : raw

    const code = decomment(text)
    for (const match of code.matchAll(HEX)) {
      if (!looksLikeColour(match[0])) continue
      const line = code.slice(0, match.index).split('\n').length
      problems.push(`${rel}:${line}  raw hex ${match[0]} — define it in TOKENS and use var(--…)`)
      hexOutside++
    }

    for (const [, name] of text.matchAll(VAR_USE)) {
      varUses++
      if (!defined.has(name) && !runtime.has(name)) {
        problems.push(
          `${rel}  var(${name}) is defined nowhere — not in TOKENS, and not published by any ` +
          'setProperty() call. The browser drops the declaration.',
        )
      }
    }
  }

  if (varUses === 0) {
    console.error('check-host-css: scanned every source and found no var() uses at all. That is not a passing state.')
    return 1
  }

  if (problems.length > 0) {
    console.error(`check-host-css: ${problems.length} problem(s)\n`)
    for (const p of [...new Set(problems)].sort()) console.error(`  ${p}`)
    return 1
  }

  console.log(
    `check-host-css: ok — ${files.length} source(s), ${defined.size} token(s), ` +
    `${varUses} var() use(s) all resolving, ${hexOutside} hex outside TOKENS.`,
  )
  for (const [name, where] of [...runtime].sort()) {
    console.log(`  runtime-set: ${name} (${where})`)
  }
  return 0
}

// Run when invoked directly; importable from the tests otherwise.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(checkHostCss())
}
