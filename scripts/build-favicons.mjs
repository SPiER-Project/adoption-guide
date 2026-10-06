#!/usr/bin/env node
/**
 * build-favicons — the browser-tab mark, generated from the brand tokens.
 *
 * The app shipped Vite's stock `vite.svg` from scaffold until 2026-09-17, so a
 * SPiER tab was indistinguishable from any other dev server in a tab strip.
 *
 * ## Why this is generated rather than drawn once and committed
 *
 * A favicon is a **standalone document**. It is fetched on its own, outside the
 * page, so it cannot read `foundation.css` — `var(--brand-primary)` in a favicon
 * resolves to nothing and the shape renders black. Every icon format therefore
 * has to hard-code the same six colours the stylesheet already defines, which
 * is precisely the hand-duplicated value this repo keeps getting bitten by
 * (stage ids, LOINC codes, ASQ dispositions). The 2026 redesign moved the whole
 * palette once; an icon drawn by hand would have stayed raspberry and nobody
 * would have noticed, because a 16px square is the one surface no reviewer
 * looks at.
 *
 * So `packages/ui/src/foundation.css` stays the single definition, this script reads the six
 * tokens out of it, and the icons are **outputs**. `--check` re-renders into
 * memory and byte-compares, which is what makes the duplication a gate instead
 * of a hope.
 *
 * ⚠️ **Never hand-edit `public/favicon.*` or `apple-touch-icon.png`** —
 * same rule as the other generated trees (CLAUDE.md, "Never hand-edit generated
 * output"). Change the art here, or the colour in `foundation.css`, and re-run.
 *
 * ## The mark
 *
 * The wordmark in `packages/app-shell/src/components/SpierLogo.tsx` is 174×35. At 16 CSS pixels that
 * is five illegible glyphs, so the tab mark is not the wordmark: it is the
 * wordmark's one piece of colour — the gradient dot over the "i" — on a plum
 * tile. Same five stops, same 45° axis, same order.
 *
 * ## The formats, and why exactly these three
 *
 *   - `favicon.svg`        every current browser; scales to any DPI.
 *   - `favicon.ico` (32px) Safari, and the bare `GET /favicon.ico` a browser
 *                          issues anyway. PNG-in-ICO, which every engine that
 *                          still reads .ico has accepted for a decade.
 *   - `apple-touch-icon.png` (180px) iOS home screen, which ignores SVG.
 *     ⚠️ Rendered **full-bleed with no corner radius**: iOS applies its own
 *     squircle mask, and a pre-rounded tile shows as a rounded square inside a
 *     rounded square. The other two carry the radius themselves.
 *
 * No web app manifest: SPiER is not installable, and a manifest would add a
 * fourth place for `vite.config.ts`'s env-driven base path to be wrong.
 *
 * ## The rasteriser
 *
 * Pure Node — `zlib` and arithmetic, no image dependency. The art is a rounded
 * rectangle and a circle, which is about forty lines of coverage maths; pulling
 * in `sharp` (a native build) or a headless browser to draw two shapes would
 * cost every contributor and every CI job far more than it saves. 4×4
 * supersampling per pixel is enough for geometry with no thin strokes.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// ⚠️ The token sheet moved to packages/ui with the components that consume it
// (2026-09-19). This script is the SIXTH consumer of that file and the one
// nothing pointed at — it crashed with ENOENT on the move rather than
// generating a blank mark, which is the right direction, but it was found by
// running `verify` rather than by anything naming it.
const CSS = resolve(REPO_ROOT, 'packages', 'ui', 'src', 'foundation.css')
const PUBLIC = join(REPO_ROOT, 'public')

/**
 * The six tokens the mark is made of, in `foundation.css`'s own spelling.
 *
 * Read rather than allowlisted-and-copied: if one is renamed, this throws with
 * the name it could not find instead of silently rendering the old hex.
 */
const PLUM = '--brand-primary'

/**
 * The wordmark whose gradient dot the tab mark repeats.
 *
 * ⚠️ **The stops and their offsets are READ from it, not copied.** This file
 * held `OFFSETS = [0, 0.2, 0.4, 0.8, 1]` and the five token names by hand,
 * "the wordmark's own offsets" — and moving a stop in `SpierLogo.tsx` left
 * `--check` green, because the check compared the icons against this copy.
 * Reading the `<stop>` elements makes the wordmark the one definition; a stop
 * the parser cannot read throws rather than drawing a default.
 */
const LOGO = resolve(REPO_ROOT, 'packages', 'app-shell', 'src', 'components', 'SpierLogo.tsx')

/** `[{ token, offset }]`, in the wordmark's own order. */
function readWordmarkStops() {
  const src = readFileSync(LOGO, 'utf8')
  const stops = [...src.matchAll(/<stop\b([^>]*)\/>/g)].map(([, attrs]) => {
    const token = /stopColor:\s*'var\((--[A-Za-z0-9-]+)\)'/.exec(attrs)?.[1]
    // An absent `offset` is 0 — the SVG default, and how the wordmark writes its first stop.
    const offset = Number(/\boffset="([0-9.]+)"/.exec(attrs)?.[1] ?? 0)
    if (!token || Number.isNaN(offset)) {
      throw new Error(`build-favicons: cannot read a <stop> in ${LOGO}: ${attrs.trim()}`)
    }
    return { token, offset }
  })
  if (stops.length < 2) {
    throw new Error(`build-favicons: found ${stops.length} gradient stop(s) in ${LOGO} — the dot's gradient is unreadable`)
  }
  return stops
}
const WORDMARK_STOPS = readWordmarkStops()

// ── Geometry, in a 64-unit square ──────────────────────────────────────────
// One coordinate space for all three outputs; the PNG rasteriser scales it and
// the SVG emits it verbatim, so the .ico and the .svg cannot disagree.
const BOX = 64
const RADIUS = 14 // tile corner
const DOT = 17 // dot radius — 53% of the tile, so the plum still reads as a tile

function readTokens() {
  // ⚠️ Comments are blanked first. A leftover `/* --brand-primary: #341528;
  // was the 2025 plum */` above the real declaration was read INSTEAD of it, so
  // changing the token left the old icons passing `--check`.
  const css = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const value = name => {
    // The token block is plain declarations; a token is defined once, and
    // `check:tokens` already guarantees every use resolves. The left boundary
    // keeps a name from matching inside a longer one.
    const m = new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(css)
    if (!m) {
      throw new Error(
        `build-favicons: ${name} is not defined as a hex literal in packages/ui/src/foundation.css.\n` +
        'The tab mark is generated from the brand tokens; it will not guess a colour.',
      )
    }
    return m[1].toLowerCase()
  }
  return { plum: value(PLUM), stops: WORDMARK_STOPS.map((s) => ({ hex: value(s.token), offset: s.offset })) }
}

// ── SVG ────────────────────────────────────────────────────────────────────

function svg({ plum, stops }) {
  const k = DOT / Math.SQRT2 // the dot's 45° diagonal, as the wordmark draws it
  const c = BOX / 2
  const gradient = stops
    .map(({ hex, offset }) => `      <stop offset="${offset}" stop-color="${hex}" />`)
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" role="img" aria-label="SPiER">
  <title>SPiER</title>
  <!--
    GENERATED by scripts/build-favicons.mjs from the brand tokens in
    packages/ui/src/foundation.css and the wordmark's gradient stops.
    Do not edit: run \`npm run build:favicons\` instead.

    A favicon is fetched as its own document, so it cannot read the stylesheet and
    these hexes cannot be var(). \`npm run check:favicons\` is what keeps them
    equal to the stylesheet's.
  -->
  <defs>
    <linearGradient id="spier-dot" x1="${(c - k).toFixed(3)}" y1="${(c + k).toFixed(3)}" x2="${(c + k).toFixed(3)}" y2="${(c - k).toFixed(3)}" gradientUnits="userSpaceOnUse">
${gradient}
    </linearGradient>
  </defs>
  <rect width="${BOX}" height="${BOX}" rx="${RADIUS}" fill="${plum}" />
  <circle cx="${c}" cy="${c}" r="${DOT}" fill="url(#spier-dot)" />
</svg>
`
}

// ── Raster ─────────────────────────────────────────────────────────────────

const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))

/** The gradient colour at axis position `t`, linear between the bracketing stops. */
function rampAt(rgbStops, t) {
  if (t <= 0) return rgbStops[0].rgb
  if (t >= 1) return rgbStops[rgbStops.length - 1].rgb
  let i = 0
  while (i < rgbStops.length - 2 && t > rgbStops[i + 1].offset) i++
  const span = rgbStops[i + 1].offset - rgbStops[i].offset
  const f = span === 0 ? 0 : (t - rgbStops[i].offset) / span
  return rgbStops[i].rgb.map((c, ch) => c + (rgbStops[i + 1].rgb[ch] - c) * f)
}

/**
 * Render the mark at `size` px, RGBA.
 *
 * `rounded: false` is the apple-touch case — a full-bleed opaque square, per
 * the note at the top about iOS masking.
 */
function raster({ plum, stops }, size, rounded) {
  const bg = hexToRgb(plum)
  const rgbStops = stops.map(({ hex, offset }) => ({ rgb: hexToRgb(hex), offset }))
  const s = size / BOX
  const r = rounded ? RADIUS * s : 0
  const cx = size / 2
  const dot = DOT * s
  const k = dot / Math.SQRT2
  // The gradient axis, as a unit vector and a length, so a sample's position is
  // one dot product rather than a per-pixel solve.
  const ax = cx - k
  const ay = cx + k
  const dx = 2 * k
  const dy = -2 * k
  const len2 = dx * dx + dy * dy

  const SS = 4 // samples per axis
  const px = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px0 = x + (sx + 0.5) / SS
          const py0 = y + (sy + 0.5) / SS
          if (!insideRoundedSquare(px0, py0, size, r)) continue
          aSum++
          const ddx = px0 - cx
          const ddy = py0 - cx
          if (ddx * ddx + ddy * ddy <= dot * dot) {
            const t = ((px0 - ax) * dx + (py0 - ay) * dy) / len2
            const [cr, cg, cb] = rampAt(rgbStops, t)
            rSum += cr; gSum += cg; bSum += cb
          } else {
            rSum += bg[0]; gSum += bg[1]; bSum += bg[2]
          }
        }
      }
      const i = (y * size + x) * 4
      if (aSum === 0) continue
      // Un-premultiply: the averaged colour is over the covered samples only, so
      // an edge pixel keeps its true hue and only its alpha falls off.
      px[i] = Math.round(rSum / aSum)
      px[i + 1] = Math.round(gSum / aSum)
      px[i + 2] = Math.round(bSum / aSum)
      px[i + 3] = Math.round((aSum / (SS * SS)) * 255)
    }
  }
  return px
}

/** Point-in-rounded-square, with `r === 0` degenerating to the plain square. */
function insideRoundedSquare(x, y, size, r) {
  if (x < 0 || y < 0 || x > size || y > size) return false
  if (r <= 0) return true
  const qx = Math.min(x, size - x)
  const qy = Math.min(y, size - y)
  if (qx >= r || qy >= r) return true
  const dx = r - qx
  const dy = r - qy
  return dx * dx + dy * dy <= r * r
}

// ── PNG ────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(pixels, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  // 10..12 = compression, filter, interlace — all 0.

  // One filter byte per scanline. Filter 0 (None) throughout: the art is two
  // flat-ish regions, so deflate already finds the runs, and a filter search
  // would buy a few hundred bytes on a 180px image for real complexity.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** A single-image .ico wrapping the 32px PNG. */
function ico(pngBuf, size) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // one image
  const entry = Buffer.alloc(16)
  entry[0] = size === 256 ? 0 : size // 0 means 256 in this field
  entry[1] = size === 256 ? 0 : size
  entry[2] = 0 // palette size — none, it is truecolour
  entry[3] = 0 // reserved
  entry.writeUInt16LE(1, 4) // colour planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(pngBuf.length, 8)
  entry.writeUInt32LE(6 + 16, 12) // offset of the image data
  return Buffer.concat([header, entry, pngBuf])
}

// ── Drive ──────────────────────────────────────────────────────────────────

function outputs() {
  const tokens = readTokens()
  const ico32 = png(raster(tokens, 32, true), 32)
  return [
    { name: 'favicon.svg', bytes: Buffer.from(svg(tokens), 'utf8') },
    { name: 'favicon.ico', bytes: ico(ico32, 32) },
    { name: 'apple-touch-icon.png', bytes: png(raster(tokens, 180, false), 180) },
  ]
}

const check = process.argv.includes('--check')
const files = outputs()

if (check) {
  const stale = []
  for (const { name, bytes } of files) {
    let current
    try {
      current = readFileSync(join(PUBLIC, name))
    } catch {
      stale.push(`${name} — missing`)
      continue
    }
    if (!current.equals(bytes)) stale.push(`${name} — differs from what the brand tokens render`)
  }
  if (stale.length > 0) {
    console.error('check:favicons — the tab mark no longer matches the brand tokens:\n')
    for (const s of stale) console.error(`  public/${s}`)
    console.error('\nRun `npm run build:favicons` and commit the result. Do not hand-edit the icons.')
    process.exit(1)
  }
  console.log(`check:favicons — ${files.length} icons match the brand tokens in packages/ui/src/foundation.css and the wordmark gradient.`)
} else {
  for (const { name, bytes } of files) {
    writeFileSync(join(PUBLIC, name), bytes)
    console.log(`  wrote public/${name}  (${bytes.length.toLocaleString()} bytes)`)
  }
}
