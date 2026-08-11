#!/usr/bin/env node
/**
 * Outreach one-pager — render the PDF from its HTML source, and pin the pair.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * `docs/outreach/spier-onepager-source.html` is a print-designed document (one
 * `@page` rule, fixed 8.5in x 11in pages, `pt` type) whose only real output is
 * a PDF that gets emailed to prospective sites. It was created in ee0fac8 for
 * Billings Clinic outreach and exported by hand, with no build step and no gate.
 *
 * So it drifted. PR #276 renamed the org to "The SPiER Project" and updated the
 * HTML; the committed PDF kept the retired "Suicide Prevention in Electronic
 * Records" wording on both pages for three days. Nothing caught it — it
 * surfaced only because an unrelated text search happened to run over the repo.
 * The stale file was the one an adopter would have read.
 *
 * ─── What this pins, and how ────────────────────────────────────────────────
 *
 * `--check` compares two recorded hashes in `docs/outreach/onepager.build.json`:
 *
 *   sourceSha256 → the HTML the PDF was rendered from. Edit the HTML without
 *                  re-exporting and this mismatches. This is the drift above.
 *   outputSha256 → the PDF bytes this script produced. Hand-swap, truncate, or
 *                  re-export-and-forget-to-commit the PDF and this mismatches.
 *
 * Both directions are pinned, so neither half can move without the other.
 *
 * ⚠️ `--check` deliberately does NOT re-render in CI, and that is not laziness:
 * **Chrome's PDF output is not byte-reproducible at all.** Across versions the
 * same HTML produced 196200 bytes under `Skia/PDF m150` and 196076 under
 * `m151` — and worse, two consecutive runs of the *same* Chrome on the *same*
 * HTML also differ (measured while building this script: sha 5694c1f9… then
 * 0b65984f…, both 191KB). A gate that re-rendered and compared bytes would
 * therefore fail on a runner-image bump *and* flake against itself, while
 * claiming the document had changed. That is the worst kind of false alarm,
 * because the fix (re-export and commit) makes it pass without anyone learning
 * anything. Comparing a committed artifact against its own recorded hash is
 * version-proof, needs no Chrome, and runs in well under a second.
 *
 * The same non-determinism is why you should only re-export when the HTML
 * actually changed: every run writes a fresh ~191KB blob into git history.
 *
 * What `--check` therefore does NOT cover: whether the HTML still *renders*
 * correctly. It can't — it never runs a browser. That is covered at export
 * time instead, by the structural assertions below.
 *
 * ─── The structural assertions (export time) ────────────────────────────────
 *
 * A headless render can fail while exiting 0 and writing a plausible file. The
 * one that matters here is the webfont: the HTML pulls Poppins from Google
 * Fonts over the network, and with no network Chrome silently falls back to
 * `system-ui` and produces a complete, wrong-looking PDF. So a render is only
 * accepted if it has 2 pages, a letter MediaBox, and a Poppins subset embedded
 * in all four weights the stylesheet asks for. The font assertion IS the
 * network check.
 *
 * ─── Chrome does not exit ───────────────────────────────────────────────────
 *
 * `--print-to-pdf` writes the file and then the process just sits there. Left
 * alone it hangs until whatever timeout is above it fires (a CI job timeout, or
 * three minutes of a developer's afternoon). This script polls for a complete
 * PDF — one ending in `%%EOF` at a stable size — and then kills the child. That
 * poll-then-kill is the whole reason this is a script and not a one-line npm
 * task.
 *
 * ─── Usage ──────────────────────────────────────────────────────────────────
 *
 *   node scripts/build-onepager.mjs           # render, verify, write PDF + manifest
 *   node scripts/build-onepager.mjs --check    # verify the committed pair (no Chrome)
 *
 * Both files live in `web/public/` on purpose: Vite copies that directory into
 * `web/dist/`, the Worker's `stage:assets` copies `web/dist` wholesale into
 * `web-dist/`, and `services/cds-hooks/wrangler.jsonc` serves it. So the pair is
 * published at stable URLs by both hosts with no extra deploy wiring — the HTML
 * as the responsive web version, the PDF as the handout — and, because the PDF
 * is committed rather than generated during the build, neither deploy path needs
 * a browser.
 *
 * ⚠️ The HTML's `@media screen` layer is invisible to this script by design:
 * Chrome resolves `print` media for `--print-to-pdf`. A screen-only regression
 * therefore cannot be caught here, and a print regression cannot be caught by
 * looking at the page in a browser. Check both when you touch the stylesheet.
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// The HTML lives in web/public/ beside the PDF because it is *also* a served
// page — it carries a screen layer that `print` media never sees. One file is
// therefore both the handout's source and the web version, which is the only
// arrangement where the two cannot drift apart. See docs/outreach/README.md.
const SOURCE = 'web/public/SPiER-Overview-Care-Pathway.html'
const OUTPUT = 'web/public/SPiER-Overview-Care-Pathway.pdf'
const MANIFEST = 'docs/outreach/onepager.build.json'

/** Structural shape a good render has. See the header — the fonts are the network check. */
const EXPECT = {
  pages: 2,
  mediaBox: '/MediaBox [0 0 612 792]', // US Letter at 72dpi
  fonts: ['Poppins-Bold', 'Poppins-Medium', 'Poppins-Regular', 'Poppins-SemiBold'],
}

/** Where Chrome might be. `CHROME_PATH` wins, then the usual suspects per platform. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean)

const sha256 = buf => createHash('sha256').update(buf).digest('hex')

function fail (msg, hint) {
  console.error(`\n✗ ${msg}`)
  if (hint) console.error(`\n  ${hint}`)
  process.exit(1)
}

/**
 * Read the structural facts out of a PDF with plain byte matching.
 *
 * No PDF library, and none wanted: this is four regexes over uncompressed
 * object headers, which Chrome writes in the clear. It keeps the script
 * dependency-free (there is no root package.json to hang a dependency on) and
 * keeps `--check` runnable on a bare Node with no npm install.
 */
function inspectPdf (bytes) {
  const text = bytes.toString('latin1')
  return {
    bytes: bytes.length,
    // `/Type /Pages` is the page *tree* — the trailing-char guard excludes it.
    pages: (text.match(/\/Type\s*\/Page[^s]/g) || []).length,
    mediaBoxes: [...new Set(text.match(/\/MediaBox\s*\[[^\]]*\]/g) || [])],
    fonts: [...new Set((text.match(/\/BaseFont\s*\/[A-Z]+\+([A-Za-z-]+)/g) || [])
      .map(m => m.replace(/^.*\+/, '')))].sort(),
    producer: (text.match(/\/Producer\s*\(([^)]*)\)/) || [])[1] || null,
    complete: text.trimEnd().endsWith('%%EOF'),
  }
}

/** Assert a rendered PDF is the document we meant to publish. Returns the facts. */
function verifyStructure (bytes, label) {
  const info = inspectPdf(bytes)
  const problems = []

  if (!info.complete) problems.push('file does not end in %%EOF — the render was truncated')
  if (info.pages !== EXPECT.pages) problems.push(`expected ${EXPECT.pages} pages, found ${info.pages}`)
  if (info.mediaBoxes.length !== 1 || info.mediaBoxes[0] !== EXPECT.mediaBox) {
    problems.push(`expected every page to be ${EXPECT.mediaBox}, found ${info.mediaBoxes.join(', ') || 'none'}`)
  }
  const missingFonts = EXPECT.fonts.filter(f => !info.fonts.includes(f))
  if (missingFonts.length) {
    problems.push(
      `missing embedded font(s): ${missingFonts.join(', ')} — the Google Fonts ` +
      'stylesheet did not load, so Chrome fell back to system-ui. Re-run with network access.',
    )
  }

  if (problems.length) {
    fail(`${label} is not a valid one-pager render:\n    - ${problems.join('\n    - ')}`)
  }
  return info
}

/** First Chrome on disk, or a fatal error naming what to do about it. */
function findChrome () {
  const found = CHROME_CANDIDATES.find(p => existsSync(p))
  if (!found) {
    fail(
      'no Chrome or Chromium found.',
      'Set CHROME_PATH to a Chrome binary, or install Google Chrome. GitHub\'s\n' +
      '  ubuntu-latest runners ship /usr/bin/google-chrome-stable.',
    )
  }
  return found
}

/**
 * Render `htmlPath` to `pdfPath`, then kill Chrome once the PDF is complete.
 *
 * Polls rather than waiting on exit, because `--print-to-pdf` never exits. A
 * complete PDF is one that ends in `%%EOF` and has held its size across two
 * consecutive polls — the second condition avoids grabbing a file mid-flush.
 */
async function renderPdf (chrome, htmlPath, pdfPath, profileDir) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDir}`,
    '--no-pdf-header-footer',
    // Lets webfont + layout work settle before the print snapshot is taken.
    '--virtual-time-budget=20000',
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ]

  const child = spawn(chrome, args, { stdio: 'ignore' })
  let exitedEarly = null
  child.on('exit', code => { exitedEarly = code })

  const deadline = Date.now() + 120_000
  let lastSize = -1

  try {
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 500))

      if (existsSync(pdfPath)) {
        const size = statSync(pdfPath).size
        if (size > 1024 && size === lastSize) {
          const bytes = readFileSync(pdfPath)
          if (inspectPdf(bytes).complete) return bytes
        }
        lastSize = size
      }

      // Chrome quitting before a complete PDF appeared means the render failed.
      if (exitedEarly !== null && !existsSync(pdfPath)) {
        fail(`Chrome exited with code ${exitedEarly} without writing a PDF.`)
      }
    }
    fail('Chrome did not produce a complete PDF within 120s.')
  } finally {
    // It will not leave on its own. See the header.
    if (exitedEarly === null) {
      child.kill('SIGTERM')
      await new Promise(r => setTimeout(r, 300))
      if (exitedEarly === null) child.kill('SIGKILL')
    }
  }
}

// ── --check: verify the committed pair against the manifest ──────────────────

function check () {
  const manifestPath = join(ROOT, MANIFEST)
  if (!existsSync(manifestPath)) {
    fail(`${MANIFEST} is missing.`, 'Run `node scripts/build-onepager.mjs` to create it.')
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  for (const rel of [SOURCE, OUTPUT]) {
    if (!existsSync(join(ROOT, rel))) fail(`${rel} is missing.`)
  }

  const sourceSha = sha256(readFileSync(join(ROOT, SOURCE)))
  const outputBytes = readFileSync(join(ROOT, OUTPUT))
  const outputSha = sha256(outputBytes)

  if (sourceSha !== manifest.sourceSha256) {
    fail(
      `${SOURCE} has changed since the PDF was exported.\n` +
      `    recorded ${manifest.sourceSha256}\n` +
      `    actual   ${sourceSha}`,
      'Re-export the PDF and commit both it and the manifest:\n\n' +
      '    node scripts/build-onepager.mjs',
    )
  }

  if (outputSha !== manifest.outputSha256) {
    fail(
      `${OUTPUT} is not the file this script produced from ${SOURCE}.\n` +
      `    recorded ${manifest.outputSha256}\n` +
      `    actual   ${outputSha}`,
      'If you edited the PDF by hand, do not — edit the HTML and re-export:\n\n' +
      '    node scripts/build-onepager.mjs',
    )
  }

  // Cheap belt-and-braces: a hand-written manifest could record the hash of a
  // structurally broken PDF, and the hashes above would agree with each other.
  const info = verifyStructure(outputBytes, OUTPUT)

  console.log(`✓ one-pager is current with its HTML source`)
  console.log(`  source  ${SOURCE}`)
  console.log(`          sha256 ${sourceSha.slice(0, 16)}…`)
  console.log(`  output  ${OUTPUT}`)
  console.log(`          sha256 ${outputSha.slice(0, 16)}… · ${info.pages} pages · ${(info.bytes / 1024).toFixed(0)}KB · ${info.producer}`)
}

// ── default: render, verify, write ───────────────────────────────────────────

async function build () {
  const htmlPath = join(ROOT, SOURCE)
  if (!existsSync(htmlPath)) fail(`${SOURCE} is missing.`)

  const chrome = findChrome()
  const tmp = mkdtempSync(join(tmpdir(), 'spier-onepager-'))
  const stagedPdf = join(tmp, 'onepager.pdf')

  console.log(`rendering ${SOURCE}`)
  console.log(`  chrome  ${chrome}`)

  try {
    const bytes = await renderPdf(chrome, htmlPath, stagedPdf, join(tmp, 'profile'))
    const info = verifyStructure(bytes, 'the render')

    renameSync(stagedPdf, join(ROOT, OUTPUT))

    const sourceSha = sha256(readFileSync(htmlPath))
    const outputSha = sha256(bytes)

    // No timestamp: it would churn the manifest on every re-export and tempt a
    // reader into treating "recently built" as "current", which is the exact
    // confusion the hashes exist to remove.
    writeFileSync(join(ROOT, MANIFEST), `${JSON.stringify({
      _comment: `Generated by scripts/build-onepager.mjs — do not edit by hand. Pins ${OUTPUT} to the ${SOURCE} it was rendered from; checked in CI by .github/workflows/onepager.yml.`,
      source: SOURCE,
      sourceSha256: sourceSha,
      output: OUTPUT,
      outputSha256: outputSha,
      pages: info.pages,
      producer: info.producer,
    }, null, 2)}\n`)

    console.log(`\n✓ wrote ${OUTPUT}`)
    console.log(`  ${info.pages} pages · ${(info.bytes / 1024).toFixed(0)}KB · ${info.producer}`)
    console.log(`  fonts: ${info.fonts.join(', ')}`)
    console.log(`✓ wrote ${MANIFEST}`)
    console.log('\nCommit both. `--check` will hold them together from here.')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

const isCheck = process.argv.includes('--check')
await (isCheck ? Promise.resolve(check()) : build())
