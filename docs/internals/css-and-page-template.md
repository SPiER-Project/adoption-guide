# CSS, design tokens, and the page template

One page template, two width tokens, one measure. The rationale behind the
conventions `CLAUDE.md` states as rules, and the limits of the gates enforcing
them.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

- **Design tokens only.** Vanilla CSS with custom properties. stylelint (`.stylelintrc.json`) rejects raw hex (`color-no-hex`) and enforces `var(--…)` for `color`, `background-color`, `border-color`, `fill`, `font-size`, `box-shadow`. Raw values are allowed only in `src/index.css` (token definitions). Class selectors must be kebab-case BEM.
  ⚠️ **stylelint checks that a token is *used*, never that it *exists*** — any
  `var(--…)` satisfies the rule, so `color: var(--made-up)` linted clean and
  shipped as a value the browser drops (issue #280). `npm run check:tokens`
  closes that half: every `var(--token)` under `web/src` must resolve to a CSS
  declaration or to a `setProperty('--token'…)` call in the TypeScript (that
  second source is scraped, not allowlisted, so the exemption dies with the code
  that earns it — **one** today, `--patient-banner-height`, published by the
  component that measures it. `--ehr-header-height` and `--ehr-footer-height`
  were the other two until the shell became a fixed frame and nothing needed to
  measure the bar or the footer any more). A fallback does
  not excuse an undefined token; it just hides it. `index.css` is in stylelint's
  `ignoreFiles` but *is* read by this check.
- **Spacing is a 10-step scale, and stylelint says so.** `--space-0-5` …
  `--space-8`. The scale was used 498 times while 250 raw declarations grew up
  beside it across 26 ad-hoc values (0.4rem×45, 0.15rem×26, 0.35rem×24,
  0.6rem×22) — because `declaration-strict-value` already guarded six
  properties and `padding`/`margin`/`gap` were simply not on the list. Of 363
  individual values, 160 were already on a step and swapped invisibly, 149 moved
  0.4-0.8px, and 48 moved 1.6px where 0.6/0.65/0.85/0.9rem snapped to the 4px
  grid. That last group is the scale working, not a regression: **do not add a
  third half-step** to avoid it, because the shift is imperceptible and a step
  is a decision every later author inherits.
  ⚠️ **Three kinds of value are not spacing, and a token for them would be
  wrong.** `--gap-inline` is an `em` on purpose — it sits in runs at several
  font sizes, and the gap that reads as "these two things are one thing" is a
  fraction of the type. A *derived alignment* must be a `calc()` over the tokens
  it depends on, never the typed sum: `.sidebar-link--child`'s `3rem` was the
  link inset + icon + gap and `.stage-tools`' `2.75rem` was `.stage-number`'s
  width + the header gap, so both would have drifted the moment a gap moved
  (they still compute to exactly 48px and 44px, verified in the browser). A
  *hairline nudge* — `-1px` for half a 2px rule, or the visually-hidden recipe —
  keeps its raw value behind a `stylelint-disable` naming why.
  ⚠️ The plugin validates **per value**, so a half-token/half-raw shorthand does
  fail (that was the hole in the sweep script that wrote these, not in the
  gate). But `ignoreValues` permits any `calc(…)`, so a raw length inside one is
  unchecked — that is the intended home for a derived value, and the limit of
  the rule.
- **One page template.** Every route under the app shell renders into
  `.app-shell__body`, which is the **sole owner of the page inset** — a page
  that pads its own root indents its content relative to every other page, for a
  reason invisible from the page itself. The title block is
  `components/PageHeader.tsx` (eyebrow → title → accent rule → optional lede),
  the only definition of page-title typography in the app; a page never renders
  its own `<h2>`, so section headings start at `<h3>`. A drill-in page passes
  `up` to make the first eyebrow segment its way back out.
  ⚠️ **Width has one owner per route, and the owner is whoever owns the header.**
  A page that renders its own `<PageHeader>` declares a root width, and it is
  `--page-width-prose` or `--page-width-wide` — those two are the whole
  vocabulary. A page that *inherits* its header from a layout inherits the
  layout's width too and declares none. This line used to state only the first
  half, as intent, and the app had drifted off both: seven page roots hardcoded
  pixels, four at values that are neither token, so the Adoption Guide's seven
  sections rendered at **five different widths** (1200 / 960 / 1200 / 1040 / 820
  / 1040 / 900) while the sidebar's pager walked a reader straight through them.
  `1200px` was the most durable of those, because it *equals*
  `--page-width-wide` today — it agreed with the template by coincidence and
  would have stopped the moment the token moved. RULE 5 in
  `check-page-template.mjs` is what makes the sentence true rather than
  aspirational; five dead width rules (`.dashboard`, `.screenings-tab`,
  `.careplan-tab`, `.encounters-tab`, `.tools-reference` — four more numbers, no
  elements) went with the same pass.
  ⚠️ **One owner is not the same as one value, and conflating them cost the
  guide's prose pages half their column.** RULE 5 was written against seven
  sub-pages declaring seven widths, and the fix picked *one* width for
  `.implementation-guide` — `--page-width-wide`, because two of its seven
  sections have tables. The other five inherited 1200px with nothing to fill
  it, and the reading measure then looked broken rather than the width:
  prose capped at ~80 characters fills ~68% of a 900px column and ~48% of a
  1200px one. Measured across every guide route, the counts were 77-85
  everywhere — the measure was right and the page was wrong.
  So the layout now declares both, `.implementation-guide` and
  `.implementation-guide--wide`, chosen per section by the required `width`
  field on `GuideSection`. Ownership survives intact: both declarations are on
  the layout's own class family in the layout's own stylesheet, and RULE 5a
  still rejects any sub-page root that declares a width at all. What RULE 5b
  now forbids is a second width on the *base* class, two on one modifier, a
  modifier duplicating the base value, or a raw length on either — all four
  planted and watched to fail.
  ⚠️ **`rootClasses` was mis-identifying its subject, silently.** It read
  `/className="([^"]+)"/` against the rest of the file, so a root using the
  expression form did not fail the gate — it matched the *next* literal
  `className` further down, and AdoptionGuide's page width was being checked
  against `.ig-content`. It now fails on any className it cannot parse, and on
  a literal that is not the root's own BEM block, because a scraped class the
  CSS lookup cannot resolve is a page width the gate only appears to check.
  That second guard fired on the first attempt at this change, where an inline
  `active.width === 'wide'` put `'wide'` in the attribute as a candidate class;
  the test is hoisted out of the JSX for that reason.
  ⚠️ **`--measure-prose` is not a third page width.** It caps a *text run*, and
  the distinction is the point: the width a table wants is not the width a
  sentence wants, so a wide page keeps its tables wide and caps its prose. Put
  it on prose, never on a page root, or RULE 5 fails you.
  ⚠️ **It is `41em`, and the unit is the whole point: a measure is a character
  count, not a width.** It was `760px` — the number `.page-header__lede` had
  hardcoded — and a px measure is right only for the font size it was set
  against. That size was `--font-size-lg`; every other run reading the token is
  smaller, and each one got a *longer* measure for it. At 760px the lede itself
  ran ~103 characters a line, the 14px runs ~110 and the 12px runs ~126 — all
  past the 45–90 band the token exists to hold, while looking capped. `em`
  resolves against the run's own font-size, so one number holds the count at
  every size: 41em lands all 20 runs that read it at **77–89 characters**,
  measured in the app at 1440px across five type sizes (11–16px). **Do not
  restate it in px, and do not add a second measure token for small type** —
  `--measure-body` existed for one commit before it turned out to be this.
  ⚠️ **Cap the text, not the box, when the two are set in different type.** An
  `em` cap resolves against the element it is written on, so a callout whose own
  font-size is the inherited 16px while its paragraph is 14px measures the wrong
  thing. `.md-caveat` caps its body and keeps its band full width, because that
  band is page-level framing; `.tool-config-effect` caps both — the box at its
  16px for a callout width, the body at its 14px for the measure — because
  dropping the box cap left a wide tinted band with the sentence stopping
  halfway; `.md-gap` caps the box, because there the box *is* the run.
  ⚠️ **`check:template` RULE 5 does not cover this — `npm run check:prose`
  does.** RULE 5 owns *page-root* widths and says nothing about a text run,
  which is why the three always-wide pages sat at 145–182 characters and
  `.dd-detail` overshot to 52rem (134 characters on 13px type) under a comment
  claiming it was the prose cap. `check:prose` is the gate for the measure
  itself; its four rules and the one thing it cannot see are described in
  [`web-gates.md`](web-gates.md). `.dd-detail` keeps 52rem for the data lines that really do
  need it, classified as NON_PROSE, and `.dd-detail-desc` caps itself.
  ⚠️ **The measure being right at every size is exactly what hid seven sizes.**
  53 declared prose runs were set at 10px, 11px, 12px, 13px, 14px and 15px, plus
  six inheriting — for one job, reading a paragraph — and every one measured
  77-85 characters, because an `em` cap holds the count at any size. Nothing
  looked wrong from the CSS and nothing looked wrong from the character count.
  It was visible only as width: 41em on 11px type is 451px, which on a 1200px
  page is a paragraph filling 38% of its own column, and nine of the eighteen
  sub-13px runs were on the Care Pathway page — the worst-measuring page in the
  app, worse than the ones that prompted the question. `--font-size-2xs`, whose
  own definition in `index.css` says it is for micro labels, was carrying one.
  The three roles are `--font-size-lg` (lede), `--font-size-md` (body) and
  `--font-size-base` (note), and deliberately not three new role tokens
  aliasing them — that is two names for one number. RULE 5 in `check:prose`
  enforces it; the floor across every route went 38% → 47% with the character
  counts unmoved. INHERITS_TYPE stays exempt because choosing to track the page
  body size is a different act from picking a size outside the three.
  ⚠️ **What it cannot see is a run with no cap at all**, so a new paragraph on a
  wide page still wants measuring by hand. RULE 5 inherits that blind spot
  exactly: a run with no cap has no font-size for it to check either. A green `check:prose` says every
  cap that exists is a character count rather than a width; it does not say
  every run that needs one has one.
  Two families are templated, found in different ways. The **lenses**
  (`src/pages`) are a declared allowlist, because which pages own a header is a
  decision. The **form views** (`src/components` — every assessment and workflow
  recorder, reached directly by route) are *derived* from the form layout they
  render (`.form-wrapper`), so a thirteenth view is covered the day it is
  written. A form view's root is `.form-view`, which exists so the header can sit
  above the layout instead of becoming a third flex item inside it — which is
  what the old `.breadcrumb` trail was, `width: 100%` and all.
  ⚠️ All four lenses had drifted off this before it was a template: the
  Population view added `padding: var(--space-6)` to its root and the guide
  padded both its header band and each sub-page container, so those two started
  24px further in than Overview and the Patient Chart, and each lens had grown
  its own eyebrow style and title color. `npm run check:template` gates it —
  including in the *reverse* direction, so a guide sub-page cannot quietly grow a
  second page header (`LENSES` in `web/scripts/check-page-template.mjs` is an
  allowlist with reasons). It reads source text, so it cannot see padding added
  to an intermediate wrapper *inside* a page; that limit is stated on the rule.
  RULE 5 (width) carries the same limit plus one of its own: it reads
  **unconditional** rules only, so a `max-width` inside a media query is
  invisible to it — verified by planting one and watching the gate stay green.
  There are none on a page root today, and RULE 4a ignores nested rules for the
  same reason.
  Two of its rules were written wrong and passed planted defects before being
  fixed — both worth knowing if you extend it. `/\bpage-header\b/` never matches
  `page-header__title`, because `_` is a word character (so the class rules carry
  no trailing `\b`); and the CSS walk read `src/css/*.css` only, leaving
  `App.css` and `index.css` — where `.form-view` and the tokens live —
  **entirely unread**. It now walks all of `src/`.
- **`ehr-` no longer names the app's own chrome.** The standalone browsing
  chrome is `AppShell` / `.app-shell__*` (`__header`, `__header-content`,
  `__brand`, `__nav-toggle`, `__hamburger`, `__content`, `__body`, `__footer`).
  It was `EhrShell` / `.ehr-*`, from when looking like an EHR was the point;
  now a real mock EHR exists at its own origin and wears slate chrome, so
  `.ehr-header` named the *SPiER* bar sitting inside a page whose actual EHR
  header is something else. The old names were also not BEM, which the
  convention above requires.
  ⚠️ **`.ehr-rubric` deliberately keeps its name** — `EhrAdoptionRubric` really
  is about EHR vendors, so there the prefix means what it says. The same goes
  for `context-ehr-patient` and the other `ehr` strings under
  `services/mock-ehr/`, which are SMART scopes and host internals rather than
  SPiER classes.
- **Routing:** `HashRouter` (see `web/src/main.tsx`) — GitHub Pages compatible.
- **Vite base path:** `/adoption-guide/` (see `web/vite.config.ts`). Don't hardcode absolute asset paths.
- **Never hand-edit `packages/fhir-artifacts/generated/`** — it's a gitignored build artifact regenerated by `copy-fhir.mjs`. To change FHIR shapes, edit FSH in `ig/input/fsh/`; to change a Questionnaire, edit the JSON in `FHIR-Resources/`.

