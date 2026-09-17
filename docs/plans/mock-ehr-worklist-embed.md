# Plan 4 — Frame the caseload on the mock EHR's front door

**Status:** IMPLEMENTED 2026-09-17. Kept for the reasoning. Three things went
differently from the plan below:

1. **The frame is a fixed-height viewport, not a re-measured fitted box.** The
   plan said to re-measure the container query. The chart's dock had already
   settled this from the other side, with a measurement on the record: a 2073px
   chart column gave a 1961px iframe and the panel's own `position: fixed`
   chrome was stranded a thousand pixels below the fold. *An embedded activity
   gets a viewport, so the frame has to be one.* A frame sized to its content has
   no viewport for the guest's fixed chrome to pin to, so the third attempt at a
   content height would have failed the way the first two did.
2. **It frames the caseload SUMMARY, not the caseload.** `PopulationSummaryEmbed`
   exists for exactly this and its header says why: a sortable patient list
   framed above this page's own patient table is two lists on one screen, and
   the frame's rows navigate inside the frame. That needed a change in the app —
   `SmartRedirect` now lands an *embedded* worklist launch on the summary and a
   top-level one on the full caseload.
3. **A gate was checking one of three landing routes while a comment said it
   checked them all.** `check:catalog` used `.match()`, which returns the first
   match only, so it only ever saw `/patient/record`. Fixed to `matchAll`, with
   comments stripped first — the first version of that fix matched four landings
   in a file with three, because a comment quotes the shape the pattern looks
   for. Touches `services/mock-ehr/` only. Independent
of plans 1–3.

## What is wrong today

`chartPage.ts`'s `HOME_JS` ends with `window.location.href = body.launchUrl`. The
"Launch caseload" button **navigates the whole page away** to
`spier-adoption-guide.bbthorson.workers.dev`. A viewer reads that as "the demo
sent me back to the marketing site", which is the opposite of the claim the page
makes: SPiER is a guest activity running against this host's data.

The launch itself is already correct. `POST /_admin/launch` mints a real
user-scoped SMART context, and it **already accepts `embed: true`**
(`app.ts:779`), which appends `?embed=1` so the app comes up in panel chrome.
Nothing about the handshake needs changing. What needs changing is where the
result is rendered.

## What to build

Put the caseload in an `<iframe>` at the top of `/`, below the one instruction
paragraph.

### A. Mint an embedded launch on page load

`HOME_JS` currently waits for a click. For the top-of-page frame, POST on load:

```js
const res = await fetch('/_admin/launch', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ userScoped: true, embed: true }),
})
const { launchUrl } = await res.json()
document.getElementById('caseload-frame').src = launchUrl
```

⚠️ **Keep the frame's `src="about:blank"` in the markup**, as the chart's panel
does (`chartPage.ts:622`). A launch URL baked into server-rendered HTML would be
a launch context minted at cache time.

⚠️ **One topic, or none.** The chart reuses one FHIRcast topic across every
launch it makes so host and panel share a session. The front door has no chart
to sync with; let the server mint a fresh topic (omit `topic`) rather than
inventing a shared one.

Keep the **measures** button as a button. Two frames on the front door is two
dense widgets before the patient table, which is the defect below.

### B. The ordering constraint — read this before moving anything

`chartPage.ts`'s `homePage` doc comment carries three passes of history on this
exact question and ends with:

> The section is a launch, not a widget. If it ever regains an embedded frame it
> must go back below the table, because step 1's defect returns with it.

That rule was written against a real, reported failure: a first-time viewer met a
dense iframe full of registry vocabulary before being told what to do. **Do not
delete the rule. Satisfy it.** The defect it names is *density before
instruction*, not *frame before table*, and the three things it says must stay
true are:

1. The instruction comes before the disclaimer. "Open a chart and press Launch
   SPiER" stays in the first paragraph, **above the frame**.
2. The caveats stay in the `.hood` drawer, not inline. Do not re-inline them to
   balance a section that moved up.
3. The section says what it is.

So the page reads: `<h1>` → instruction paragraph → **Caseload frame** →
Start here → Patient list → About drawer. Update the doc comment with a fourth
numbered pass recording this decision and why it is not a revert of pass 2.

### C. The frame height — measure it, do not reuse the old numbers

The deleted rule was a **container query** at 1100px of *frame* width, with two
measured heights: 387px side-by-side, 717px stacked. Reinstating it is right; the
numbers are not transferable, because what goes in the frame now is different:

- The old frame rendered `#/population/summary` in **EHR chrome** with the app's
  bundled registry.
- The new frame renders it in **panel chrome** (`embed=1`) against this server's
  FHIR API, over a user-scoped token.

Panel chrome collapses the app's header and sidebar, so the content is shorter
and the breakpoint may land elsewhere. Re-measure both branches and write the
numbers into the comment with the date.

⚠️ Keep it a **container** query, not a media query. The old rule was a media
query at 1148px (1100 plus body padding), the page later grew a `max-width`, the
offset silently became wrong by far more than 48px, and the side-by-side branch
became unreachable at every window width. The measurement is about the frame, so
ask the frame.

### D. Label the frame as the guest

The host's design system has exactly one role for SPiER's plum and raspberry:
`--guest-brand`, used by `.guest__title` to name SPiER on the bar above something
SPiER drew. Use the existing guest-frame component. The boundary between host and
guest is the thing this page is about.

### E. What the section must claim, and not claim

It is a **real SMART launch**: user-scoped authorization, no patient in context,
`user/*.read`, a roster read against this server's FHIR API. That is what #401
bought and it is worth stating plainly.

What it still does not prove is interoperability — this host is written and run
by the same project as the app it launches. That paragraph already exists in the
`.hood` drawer. Leave it there and leave it unsoftened.

## Framing is already permitted

`services/cds-hooks/src/index.ts:51` sets
`frame-ancestors 'self' https://spier-mock-ehr.bbthorson.workers.dev` by default,
and the chart already frames the app from that origin. No CSP change is needed.
If the frame renders blank, the browser console names the blocked ancestor.

## Gates

```
cd services/mock-ehr && npm install && npm run verify
```

`check:host-css` will reject any hex literal outside the `TOKENS` block and any
`var(--…)` that does not resolve. `chartPage.test.ts` and `app.test.ts` assert on
the front door's markup — expect both to need updating.

## Done when

- `https://spier-mock-ehr.bbthorson.workers.dev/` shows the caseload running
  inside the host, second on the page, labelled as SPiER's.
- No button on the front door navigates the page away from the host, except the
  measures launch (which is a top-level activity by design — say so in its
  sentence).
- The frame fits its content at both breakpoint branches, measured and dated in
  the comment.
