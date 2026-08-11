# Outreach assets

## The two-sided one-pager

The handout that goes to prospective sites — front page is the pitch, back page
is the eight-stage care pathway. It exists because sites want something they can
skim in an inbox, print for a meeting table, and forward internally without
asking a colleague to trust an unfamiliar URL.

| | |
|---|---|
| **Source** | `spier-onepager-source.html` (edit this) |
| **Output** | `../../web/public/SPiER-Overview-Care-Pathway.pdf` (generated — don't edit) |
| **Pin** | `onepager.build.json` (generated — don't edit) |
| **Rebuild** | `node scripts/build-onepager.mjs` from the repo root |
| **Gate** | `node scripts/build-onepager.mjs --check`, in `.github/workflows/onepager.yml` |

### Editing it

Edit the HTML, then re-export and commit all three files together:

```bash
node scripts/build-onepager.mjs
```

CI fails if you commit an HTML change without the re-exported PDF, or a PDF that
this script didn't produce. That gate exists because the PDF silently drifted
once already: PR #276 reworded both pages and the committed PDF kept the retired
"Suicide Prevention in Electronic Records" wording for three days, surfacing only
because an unrelated text search ran over the repo.

You need Chrome to re-export (`CHROME_PATH` overrides discovery). The script
kills it once the PDF is complete — `--print-to-pdf` writes the file and then
never exits on its own.

### Why the PDF lives under `web/public/`

So it gets a stable URL for free. Vite copies `web/public/` into `web/dist/`, the
Worker's `stage:assets` copies that wholesale into `web-dist/`, and
`services/cds-hooks/wrangler.jsonc` serves it — so both hosts publish it:

- `https://spier-adoption-guide.bbthorson.workers.dev/SPiER-Overview-Care-Pathway.pdf`
- `<GitHub Pages host>/adoption-guide/SPiER-Overview-Care-Pathway.pdf`

It stays **committed** rather than generated during the build on purpose. The
Cloudflare deployment is configured in the Cloudflare dashboard (Workers Builds),
not in this repo, so a build-time render would need Chrome in a container we
don't control — and if only GitHub Actions generated it, the Cloudflare host
would 404 the path. Committing the artifact and pinning it by hash gets the same
anti-drift guarantee with no browser in either deploy path.

### Known limitation: it is not a web page

The HTML is print-only — one `@page` rule, no `@media` at all, and every `.page`
is a hard `width: 8.5in; height: 11in` with `pt` type. Open it in a phone
browser and it does not reflow. Serving it as a responsive page would need an
`@media screen` pass with the `@page` rules left intact, and was scoped out of
issue #283 deliberately. Until then, the PDF is the deliverable and the
[adoption guide](https://spier-adoption-guide.bbthorson.workers.dev) is the web
experience it points at.
