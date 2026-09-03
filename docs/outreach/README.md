# Outreach assets

Standing question lists for the two external conversations SPiER keeps open.
Both are working documents: they are meant to be taken into a call and updated
with what came back, not archived.

| File | What it is |
|---|---|
| [`2026-08-11-suicide-care-dashboard-questions.md`](2026-08-11-suicide-care-dashboard-questions.md) | Questions for the author of the suicide-care dashboard SPiER's Stage-8 work is modelled against. |
| [`zero-suicide-institute-mapping-questions.md`](zero-suicide-institute-mapping-questions.md) | Open questions behind the Zero Suicide ↔ SPiER mapping, which the IG publishes as a Guidance page. |

The **pitch** itself is not here. `README.md` at the repo root is its one home,
and the app's Overview page loads the same three-step framing from
`web/src/content/overview.ts`.

## The two-sided one-pager was removed

`web/public/SPiER-Overview-Care-Pathway.html` and its committed PDF were the
outreach handout: front page the pitch, back page the eight-stage pathway, one
file serving as both a web page and a printable PDF. It has not been distributed
for some time, so it was deleted rather than kept current — an outreach artifact
nobody sends is a claim nobody is checking, and this one carried its own build
step, a committed 197KB binary, a hash-pinning manifest and a CI workflow to
hold the two in agreement.

Removed with it: `scripts/build-onepager.mjs`, `onepager.build.json`,
`.github/workflows/onepager.yml`, and `docs/one-pager.md` (already only a
pointer). Nothing else referenced the HTML — no app route, no Worker config.

**Both published URLs now 404**, which is the one consequence worth knowing:

- `https://spier-adoption-guide.bbthorson.workers.dev/SPiER-Overview-Care-Pathway`
- `https://spier-project.github.io/adoption-guide/SPiER-Overview-Care-Pathway`

⚠️ Only on GitHub Pages will that read as a 404. The Worker sets
`not_found_handling: "single-page-application"`, so an unresolvable path returns
the SPA's `index.html` with a **200** — about 820 bytes. That behaviour predates
this removal and is documented here because it is the thing that makes "is it
still served?" an unreliable question to answer by status code.

If it is ever wanted back, `git log -- web/public/SPiER-Overview-Care-Pathway.html`
has every version, and the last one is at the commit that removed it. Two things
about that file are worth reading before reviving it rather than rediscovering:
its stylesheet had a print layer and a `@media screen` layer that could not see
each other's failures (so a browser could never show you a print regression),
and the PDF was committed rather than built because the Cloudflare deploy is
dashboard-configured and cannot be given a browser.
