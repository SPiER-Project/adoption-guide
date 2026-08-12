/**
 * A minimal, deterministic .xlsx writer — SpreadsheetML, no dependencies.
 *
 * ─── Why hand-rolled ────────────────────────────────────────────────────────
 *
 * The repo root has no package.json and every script under `scripts/` runs on
 * Node builtins alone (see the imports in check-fml.mjs, validate-fhir.mjs,
 * build-onepager.mjs). Adding `exceljs` for one generator would introduce a
 * root dependency tree, a lockfile, and an `npm ci` step to every workflow that
 * wants to run it. The subset of OOXML needed here — inline strings, merged
 * ranges, a handful of cell styles, column widths — is about 150 lines.
 *
 * ─── Why the output is byte-reproducible ────────────────────────────────────
 *
 * This is the property the `--check` gate rests on, and it is not free:
 *
 *   - entries are STORED, never deflated. zlib's output is stable in practice
 *     but is not a documented invariant across zlib versions, and a gate that
 *     compares bytes must not depend on one. These files are ~60KB of XML; the
 *     compression is not worth the risk.
 *   - every entry gets the same fixed DOS timestamp. The real clock would make
 *     each build differ from the last.
 *   - entries are written in a fixed order, and no part contains a generated
 *     id, GUID, or "last modified by".
 *
 * So `build === committed` is a meaningful comparison, and the gate can simply
 * regenerate and diff. That is a stronger check than build-onepager.mjs's
 * recorded-hash approach — which exists only because Chrome's PDF bytes are not
 * reproducible even between two runs of the same binary. Do not copy the hash
 * pattern here; do not break reproducibility there.
 *
 * ─── What this deliberately does not support ────────────────────────────────
 *
 * Formulas, shared strings, cell comments, drawings, charts, data validation,
 * conditional formatting, multiple fonts per cell. Every one of them is absent
 * because nothing needs it yet. Cell comments in particular were considered and
 * rejected: they live in a legacy VML drawing part that is fiddly to emit, they
 * are invisible in a CSV export, and a malformed one makes Excel show a repair
 * prompt — which for a document circulated to a working group is worse than the
 * note being somewhere else. Review notes travel in the source JSON and are
 * rendered as a visible column instead.
 */

import { crc32 } from './crc32.mjs'

const OVERRIDE = 'http://schemas.openxmlformats.org/package/2006/content-types'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const DOC_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

/** Every entry is stamped 1980-01-01 00:00:00, the earliest a DOS date can express. */
const FIXED_DOS_TIME = 0
const FIXED_DOS_DATE = 33 // (1980-1980)<<9 | 1<<5 | 1

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A -> 1, AA -> 27. Inverse of colName. */
export function colIndex(name) {
  let n = 0
  for (const ch of name) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

/** 1 -> A, 27 -> AA. */
export function colName(index) {
  let n = index
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - rem) / 26)
  }
  return out
}

/**
 * Cell styles, referenced by index from `cell.style`. The palette mirrors the
 * workbook the working group circulated (Arial 11, grey section banners, blue
 * header) so the generated file reads as the same document rather than a
 * lookalike.
 */
const STYLES = ['default', 'title', 'header', 'section', 'body', 'bodyMono']
export const STYLE = Object.fromEntries(STYLES.map((name, i) => [name, i]))

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${MAIN}"><fonts count="4"><font><sz val="11"/><color theme="1"/><name val="Arial"/></font><font><b/><sz val="13"/><color theme="1"/><name val="Arial"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Arial"/></font><font><sz val="10"/><color theme="1"/><name val="Courier New"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F3F3"/><bgColor rgb="FFF3F3F3"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFCFE2F3"/><bgColor rgb="FFCFE2F3"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf borderId="0" fillId="0" fontId="0" numFmtId="0"/></cellStyleXfs><cellXfs count="6"><xf borderId="0" fillId="0" fontId="0" numFmtId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf borderId="0" fillId="0" fontId="1" numFmtId="0" xfId="0" applyAlignment="1" applyFont="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf><xf borderId="0" fillId="3" fontId="2" numFmtId="0" xfId="0" applyAlignment="1" applyFill="1" applyFont="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf><xf borderId="0" fillId="2" fontId="2" numFmtId="0" xfId="0" applyAlignment="1" applyFill="1" applyFont="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf><xf borderId="0" fillId="0" fontId="0" numFmtId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf><xf borderId="0" fillId="0" fontId="3" numFmtId="0" xfId="0" applyAlignment="1" applyFont="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`
}

/**
 * Approximate the height a wrapped row needs, in points.
 *
 * ⚠️ **Excel does not auto-fit a row containing a merged cell** — it is a
 * decades-old limitation, not a setting. Leave the height off and the scenario
 * narrative in the merged A1, and each merged section banner, render as a
 * single clipped line. The workbook that was circulated worked around it with
 * hand-set heights (row 1 at 201pt, banners at 47–60pt), which is fine until
 * someone edits the text.
 *
 * So estimate instead: split on hard newlines, wrap each paragraph against the
 * cell's own width in Excel's character units, and charge ~14pt a line. It is
 * approximate — proportional fonts make exact measurement impossible without a
 * layout engine — so it deliberately errs tall. A row slightly too tall looks
 * fine; a clipped one hides content.
 *
 * @param {number} width  the cell's width in character units (summed across a merge)
 */
function estimateHeight(text, width) {
  const usable = Math.max(8, width - 1) // wrap guard for the cell's padding
  let lines = 0
  for (const paragraph of String(text).split('\n')) {
    lines += Math.max(1, Math.ceil(paragraph.length / usable))
  }
  return Math.min(400, Math.max(15, Math.round(lines * 14 + 4)))
}

/**
 * @param {{name: string, columns: number[], rows: Array<{height?: number, cells: Array<{value: string, style?: number}|null>}>, merges: string[], freezeRow?: number}} sheet
 */
function sheetXml(sheet) {
  // Merges that start at a given cell, so a merged cell is measured against
  // the total width it spans rather than its first column alone.
  const spanAt = new Map()
  for (const ref of sheet.merges) {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref)
    if (!m) throw new Error(`Unparseable merge range: ${ref}`)
    const [, c1, r1, c2] = m
    const from = colIndex(c1)
    const to = colIndex(c2)
    let width = 0
    for (let i = from; i <= to; i++) width += sheet.columns[i - 1] ?? 0
    spanAt.set(`${from}:${Number(r1)}`, width)
  }

  const cols = sheet.columns
    .map((w, i) => `<col customWidth="1" min="${i + 1}" max="${i + 1}" width="${w}"/>`)
    .join('')

  const rows = sheet.rows
    .map((row, rowIndex) => {
      const r = rowIndex + 1
      let tallest = 15
      const cells = row.cells
        .map((cell, i) => {
          if (cell === null || cell === undefined || cell.value === '') return ''
          const col = i + 1
          const ref = `${colName(col)}${r}`
          const style = cell.style ?? STYLE.default
          const width = spanAt.get(`${col}:${r}`) ?? sheet.columns[i] ?? 12
          tallest = Math.max(tallest, estimateHeight(cell.value, width))
          // Inline strings, not a shared-string table: one fewer part to keep
          // consistent, and these documents have almost no repeated text.
          return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`
        })
        .join('')
      const height = row.height ?? tallest
      return `<row r="${r}" ht="${height}" customHeight="1">${cells}</row>`
    })
    .join('')

  const merges = sheet.merges.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : ''

  const pane = sheet.freezeRow
    ? `<pane ySplit="${sheet.freezeRow}" topLeftCell="A${sheet.freezeRow + 1}" activePane="bottomLeft" state="frozen"/>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows}</sheetData>${merges}</worksheet>`
}

/**
 * Excel truncates a sheet name at 31 characters and rejects []:*?/\ — the
 * circulated workbook's tab was literally named "FINAL Emergency Department
 * Use " (truncated, trailing space intact), which is what happens when nobody
 * checks. Fail loudly instead of shipping a mangled name.
 */
function assertSheetName(name) {
  if (name.length > 31) {
    throw new Error(`Sheet name "${name}" is ${name.length} chars; Excel truncates at 31.`)
  }
  const bad = name.match(/[[\]:*?/\\]/)
  if (bad) throw new Error(`Sheet name "${name}" contains ${bad[0]}, which Excel rejects.`)
  if (name !== name.trim()) throw new Error(`Sheet name "${name}" has leading or trailing space.`)
}

/**
 * @param {Array<{name: string, columns: number[], rows: object[], merges: string[], freezeRow?: number}>} sheets
 * @returns {Buffer} a complete .xlsx
 */
export function buildXlsx(sheets) {
  sheets.forEach(s => assertSheetName(s.name))
  const names = sheets.map(s => s.name)
  if (new Set(names).size !== names.length) {
    throw new Error(`Duplicate sheet names: ${names.join(', ')}`)
  }

  const sheetOverrides = sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')

  const parts = [
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${OVERRIDE}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${DOC_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${MAIN}" xmlns:r="${DOC_REL}"><sheets>${sheets
        .map(
          (s, i) =>
            `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
        )
        .join('')}</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL}">${sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="${DOC_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('')}<Relationship Id="rId${sheets.length + 1}" Type="${DOC_REL}/styles" Target="styles.xml"/></Relationships>`,
    ],
    ['xl/styles.xml', stylesXml()],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ]

  return zipStore(parts.map(([name, xml]) => [name, Buffer.from(xml, 'utf8')]))
}

/** A ZIP archive with every entry stored (method 0) and a fixed timestamp. */
function zipStore(entries) {
  const locals = []
  const central = []
  let offset = 0

  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data)

    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(10, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(0, 8) // method: stored
    local.writeUInt16LE(FIXED_DOS_TIME, 10)
    local.writeUInt16LE(FIXED_DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    nameBuf.copy(local, 30)
    locals.push(local, data)

    const dir = Buffer.alloc(46 + nameBuf.length)
    dir.writeUInt32LE(0x02014b50, 0)
    dir.writeUInt16LE(20, 4) // version made by
    dir.writeUInt16LE(10, 6)
    dir.writeUInt16LE(0, 8)
    dir.writeUInt16LE(0, 10)
    dir.writeUInt16LE(FIXED_DOS_TIME, 12)
    dir.writeUInt16LE(FIXED_DOS_DATE, 14)
    dir.writeUInt32LE(crc, 16)
    dir.writeUInt32LE(data.length, 20)
    dir.writeUInt32LE(data.length, 24)
    dir.writeUInt16LE(nameBuf.length, 28)
    dir.writeUInt16LE(0, 30) // extra
    dir.writeUInt16LE(0, 32) // comment
    dir.writeUInt16LE(0, 34) // disk
    dir.writeUInt16LE(0, 36) // internal attrs
    dir.writeUInt32LE(0, 38) // external attrs
    dir.writeUInt32LE(offset, 42)
    nameBuf.copy(dir, 46)
    central.push(dir)

    offset += local.length + data.length
  }

  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...locals, centralBuf, end])
}

/**
 * RFC 4180 CSV. A field is quoted when it contains a comma, quote, CR or LF —
 * the newline case matters here, because the scenario narrative and the section
 * banners are multi-paragraph single cells.
 */
export function toCsv(rows) {
  return (
    rows
      .map(row =>
        row
          .map(field => {
            const s = field == null ? '' : String(field)
            return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          })
          .join(','),
      )
      .join('\r\n') + '\r\n'
  )
}
