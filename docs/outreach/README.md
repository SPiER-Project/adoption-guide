# Outreach assets

## The two-sided one-pager

Front page is the pitch, back page is the eight-stage care pathway. It exists in
two forms from **one file**: a web page to link, and a PDF to attach.

| | |
|---|---|
| **Source** | `../../web/public/SPiER-Overview-Care-Pathway.html` (edit this) |
| **PDF** | `../../web/public/SPiER-Overview-Care-Pathway.pdf` (generated — don't edit) |
| **Pin** | `onepager.build.json` (generated — don't edit) |
| **Rebuild** | `node scripts/build-onepager.mjs` from the repo root |
| **Gate** | `node scripts/build-onepager.mjs --check`, in `.github/workflows/onepager.yml` |

Published by both hosts:

- `https://spier-adoption-guide.bbthorson.workers.dev/SPiER-Overview-Care-Pathway.html`
- `<GitHub Pages host>/adoption-guide/SPiER-Overview-Care-Pathway.html`

…and the same paths with `.pdf`. The page carries a "Download PDF" link, so a
recipient of either form can get to the other.

### Editing it

Edit the HTML, then re-export and commit all three files together:

```bash
node scripts/build-onepager.mjs
```

CI fails if you commit an HTML change without the re-exported PDF, or a PDF this
script didn't produce. That gate exists because the PDF silently drifted once
already: PR #276 reworded both pages and the committed PDF kept the retired
"Suicide Prevention in Electronic Records" wording for three days, surfacing only
because an unrelated text search ran over the repo.

You need Chrome to re-export (`CHROME_PATH` overrides discovery). The script
kills it once the PDF is complete — `--print-to-pdf` writes the file and then
never exits on its own.

### ⚠️ One file, two media — check both

The stylesheet is in two halves, and **neither half can see the other's
failures**:

| | Print layer (top of the `<style>`) | Screen layer (below the banner comment) |
|---|---|---|
| Governs | the PDF, and the desktop preview | the web page below 900px |
| Seen by | `--print-to-pdf`, which resolves `print` media | browsers only |
| Verified by | `build-onepager.mjs` (2 pages, letter MediaBox, Poppins ×4) | looking at it |

So: editing the screen layer can never fix the PDF, and a browser can never show
you a print regression. If you touch shared rules — anything above the banner —
re-export **and** open the page at a narrow width.

The one trap this has already sprung: the footer URLs are real `<a>` elements so
they work on the web and stay clickable in the PDF. Their `color: inherit;
text-decoration: none` reset **must** live in the print layer. Put it in the
screen layer and the printed pages get the browser's default underline.

### Why these files live under `web/public/`

So they get stable URLs for free. Vite copies `web/public/` into `web/dist/`, the
Worker's `stage:assets` copies that wholesale into `web-dist/`, and
`services/cds-hooks/wrangler.jsonc` serves it.

Keeping the HTML there — rather than authoring it in `docs/` and copying — means
the served page and the PDF's source are literally the same bytes, so there is no
second copy to drift.

The PDF stays **committed** rather than generated during the build on purpose.
The Cloudflare deployment is configured in the Cloudflare dashboard (Workers
Builds), not in this repo, so a build-time render would need Chrome in a
container we don't control — and if only GitHub Actions generated it, the
Cloudflare host would 404 the path. Committing the artifact and pinning it by
hash gets the same anti-drift guarantee with no browser in either deploy path.

### Layout notes

The print layer is absolute by necessity: fixed 8.5in × 11in pages, `pt` type,
`overflow: hidden`. The screen layer keeps exactly that geometry above 900px — a
wide screen shows the real sheet, centred and shadowed — and below it drops the
pretence: page heights go `auto`, every multi-column arrangement stacks, and the
7–10pt print sizes are restated in px, because 7.8pt is ~10px on a phone.
Between 620px and 900px the pathway grid stays two-up, since one column of stage
cards leaves too long a measure.
