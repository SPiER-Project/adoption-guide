# The two Workers

`web/`'s `npm run verify` covers neither. Both have their own CI-gated verify,
and the mock EHR has a CSS gate no CSS linter could provide.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

In `services/cds-hooks/` — **easy to forget, and CI gates it:**
```
npm install && npm run verify   # typecheck + eslint + vitest for the Worker
```
`web/`'s `npm run verify` does NOT cover this package, but the `cds-hooks` CI job
does. It imports the web catalog, so a change to `tool-ui-metadata.ts` (launch
actions especially) or to the population scenarios can break its tests without
anything in `web/` failing.

In `services/mock-ehr/` — **the same deal, and it has a CSS gate of its own:**
```
npm install && npm run verify   # copy-fhir + typecheck + eslint + check:host-css + vitest
```
`npm run check:host-css` is this Worker's stand-in for stylelint's
`color-no-hex` and `web/`'s `check:tokens`, neither of which can see it — its
pages are template strings inside TypeScript, with no stylesheet for a CSS
linter to read. Two rules: **no hex outside the `TOKENS` block** in
`src/hostChrome.ts`, and **every `var(--…)` resolves**. Both fail when they read
nothing, and the whole thing exists because the comment version had already
failed once: `hostChrome.ts` was extracted *from* `controlPage.ts` to give the
palette one definition, and `controlPage.ts` then hand-typed four of those hexes
in its own `<!doctype>` document for as long as it existed.

⚠️ **The mock EHR is deliberately NOT styled like SPiER**, and that is a demo
claim rather than a preference. Its pages say *"Everything below this bar is
drawn by SPiER, not by the host"*, so the host is slate and steel and SPiER's
raspberry appears in exactly one role — `--guest-brand`, on the `.guest__title`
wordmark above a frame SPiER drew. A host control tinted with it puts the guest's
colour on the host's button, on the page whose whole subject is which pixels
belong to whom. `services/mock-ehr/README.md` § *The look of the host* has the
reasoning, including why `hostChrome.ts`'s original argument for matching the app
was reversed.

