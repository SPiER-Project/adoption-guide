# CSS, design tokens, and the page template

One page template, two width tokens, one measure. The rationale behind the
conventions `CLAUDE.md` states as rules, and the limits of the gates enforcing
them.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

- **Design tokens only.** Vanilla CSS with custom properties. stylelint (`.stylelintrc.json`) rejects raw hex (`color-no-hex`) and enforces `var(--…)` for `color`, `background-color`, `border-color`, `fill`, `font-size`, `box-shadow`, `font-family`, `letter-spacing` and every spacing property. Raw values are allowed only in `packages/ui/src/foundation.css` (token definitions). Class selectors must be kebab-case BEM.
  ⚠️ **`font-family` joined the list on 2026-09-16, and it was the one visual
  property with no owner.** Eight stylesheets each spelled a monospace stack
  their own way (`'SF Mono', 'Fira Code'` ×4, `ui-monospace, SFMono-Regular,
  Menlo` ×2, bare `monospace`, `ui-monospace, monospace`), and the body face
  was a literal on `:root`. Three tokens now — `--font-display`,
  `--font-body`, `--font-mono` — and the gate refuses a fourth spelling.
  `inherit` stays legal (it is on `ignoreValues`), which is what a control
  that adopts its parent's face wants.
  **Brand colour is role-named.** The 2026 website redesign dropped the
  raspberry accent, which the app had used for 63 unrelated jobs across 19
  stylesheets — eyebrow, link, focus ring, selected node, sidebar bar, footer
  link, pill fill, card edge. Each is now a token named for the job
  (`--brand-terracotta-text`, `--brand-link`, `--tint-peach-soft`,
  `--brand-primary`, `--gradient-brand`), so the next palette change is a
  value edit per role rather than a 63-site triage. Retiring the old name was
  the guard: `check:tokens` fails on any `var(--brand-accent)` the sweep
  missed, because the definition is gone — no allowlist to maintain.
  ⚠️ **Two brand values are deliberately not the design's.** Terracotta
  `#d0784a` measures 2.95:1 on the page ground and the sky link `#5fa9be`
  2.66:1 on white; the app sets eyebrows at 11px bold and links at 13–14px,
  so both text tokens are deepened to clear 4.5:1 and the design's values are
  kept for fills and rules only. If the agency's variables land lighter, the
  `-text` tokens stay deeper; this is a WCAG decision, not a sampling error.
  The logo's five gradient stops are tokens too (`--brand-gradient-1…5`), read
  by `SpierLogo.tsx` through inline `stop-color`, so the wordmark and every
  gradient rule share one definition.
  ⚠️ **stylelint checks that a token is *used*, never that it *exists*** — any
  `var(--…)` satisfies the rule, so `color: var(--made-up)` linted clean and
  shipped as a value the browser drops (issue #280). `npm run check:tokens`
  closes that half: every `var(--token)` under either style root (`scripts/lib/style-roots.mjs`) must resolve to a CSS
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
  The three roles were `--font-size-lg` (lede), `--font-size-md` (body) and
  `--font-size-base` (note), deliberately not three new role tokens aliasing
  them — that is two names for one number. On 2026-09-24 the scale itself took
  that shape: they are `--type-lead`, `--type-running` and `--type-caption`,
  and the size tokens are gone (see *Type is seven roles* below). RULE 5 in
  `check:prose` enforces it; the floor across every route went 38% → 47% with
  the character counts unmoved. INHERITS_TYPE stays exempt because choosing to track the page
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
  Since 2026-09-15 the ten **workflow recorders** do not render that layout at
  all: they render `<WorkflowForm>` (`components/WorkflowForm.tsx`), the one
  form view that owns the frame — header, card-beside-drawer, scratch-chart
  hint, success notice, code drawer — for all of them. The gate recognizes a
  recorder by that element and checks the mirror image of RULE 4: it must NOT
  also render `<PageHeader>` or the layout classes, or the page has two of
  each. Ten copies of the frame had drifted to nine pastes of one sentence
  (one reworded) and one view out of ten scrolling its notice into view.
  ⚠️ All four lenses had drifted off this before it was a template: the
  Population view added `padding: var(--space-6)` to its root and the guide
  padded both its header band and each sub-page container, so those two started
  24px further in than Overview and the Patient Chart, and each lens had grown
  its own eyebrow style and title color. `npm run check:template` gates it —
  including in the *reverse* direction, so a guide sub-page cannot quietly grow a
  second page header (`LENSES` in `scripts/check-page-template.mjs` is an
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
- **Routing:** `HashRouter` (see `apps/guide/src/main.tsx`) — GitHub Pages compatible.
- **Vite base path:** `/adoption-guide/` (see `vite.config.ts`). Don't hardcode absolute asset paths.
- **Never hand-edit `packages/fhir-artifacts/generated/`** — it's a gitignored build artifact regenerated by `copy-fhir.mjs`. To change FHIR shapes, edit FSH in `ig/input/fsh/`; to change a Questionnaire, edit the JSON in `ig/input/resources/questionnaires/`.



## Notes moved from `CLAUDE.md`'s conventions (2026-09-20)

### The token-definition exemption lives in the file, not in a path

⚠️ `foundation.css` carries its own `stylelint-disable` banner saying it is the
token file. That exemption used to be an `ignoreFiles` glob naming
`src/index.css`; stylelint matches it by PATH, so the move to `packages/ui`
silently un-exempted the file and it reported 85 errors for doing its job. A
path-shaped exemption is one rename from not applying.

### Type, brand, spacing, tracking, breakpoints

**Type has three families and no others** — `--font-display` (headings,
buttons; names Area Normal, renders Manrope until the licence lands — the
`@font-face` note at the top of `foundation.css` says why), `--font-body`
(Poppins) and `--font-mono`.

**Brand colour is role-named, and the raspberry is gone.** Since the 2026
website redesign there is no `--brand-accent`: an eyebrow is
`--brand-terracotta-text`, a link is `--brand-link`, a selected or active state
is `--tint-peach-soft` under plum, focus and accent bars are `--brand-primary`,
and the four tints (`--tint-peach/sand/sage/sky`, each with a `-soft`) plus
`--gradient-brand` are the rest of the palette. ⚠️ Values commented `sampled`
in `foundation.css` were read off the rendered Figma, not its variables —
replace them from the file, do not tune them by eye. Two are deliberately
deeper than the design for WCAG AA at app sizes.

**The risk ramp is four pairs, not four fills.** Each solid step `--risk-X`
has a `--risk-X-on` for the text set on it, and each soft step `--risk-X-soft`
has a `--risk-X-soft-text`; those two weights are the whole vocabulary.
⚠️ Written against two pills that shipped failing AA: white on `--risk-high`
(#ea580c) measured 3.56:1 and white on `--risk-moderate` (#ca8a04) 2.94:1, at
11px bold. The ramp named a fill and left its text to each consumer, and the
consumers reached for `--text-on-brand` because a pill is plum everywhere else.
Moderate is now the one light solid, so its `-on` is plum. The old
`-soft-bg` / `-faded` pair per step collapsed into one `-soft`, and both names
were deleted rather than aliased, so `check:tokens` failed on every use the
sweep missed. `tests/colourContrast.test.ts` holds the pairs at ≥ 4.5:1 from this
file's own values. It also holds every rule in every style root that fills with
a solid step to that step's `-on`; that half is what caught
`.cds-card-pill--warning` still putting white on the new amber. ⚠️ Planting `#ca8a04` back does **not** fail on its own:
plum on the old amber clears AA. The defect was the pairing, and the plant that
fails is the one that restores the white.
⚠️ **A fill is not a mark, and the ramp has a token for each.** A solid step
is for text on it, with its `-on`. A card's left edge, a bar segment, a swatch,
a dot or a gradient stop is a *mark*, and reads `--risk-X-edge`. Moderate is why:
its fill is light so that plum text reads on it, and as a mark it measured
1.60–1.93:1, under the 3:1 WCAG 1.4.11 asks of a graphical object. For two
days that was recorded here as a known gap. Since 2026-09-24,
`--risk-moderate-edge` is the fill's hue and saturation darkened just enough to
clear 3:1 on every ground: 3.16 on the bar track, 3.45 on the page, 3.80 on
white, 3.16 on its own soft fill. It goes no further, so it keeps some lightness
apart from high and low beside it in a stepped bar (1.31 and 1.39); past that,
only hue tells them apart. The other three steps already cleared 3:1, so their
edge is their fill. 26 rules moved, and only seven text fills still read a
solid step. The test's rule replaced the `TEXT_FREE` list of eight swatches
and segments: a solid step appears only as the background of a rule that sets
its `-on`. With a token of their own, text-free marks need no exemption.

**Status is four families of four, and a status colour means a status.**
`--status-{info,success,warning,danger}-{bg,border,edge,text}`: the tinted
ground, the 1px outline, the 3px left rule, the words. Info and success come
from the brand tints (sky, sage), and danger's edge *is* `--risk-acute`. They
replaced twenty `--accent-*` tokens in Tailwind's blue, green and amber, which
had grown one per call site (`-text`, `-text-deep`, `-mid`, `-stop`, `-light`).
The twenty were deleted, not aliased, along with the two aliases
`--accent-info-text` and `--text-error`. ⚠️ **The sweep moved each use by its
job, not its old name**, because "info blue" had come to mean five things:
- Notices and pills that *are* a status took `--status-*`.
- Links took `--brand-link`: the caseload's controls, the alert's patient name, the pager, the readiness links.
- Selections took plum on `--tint-peach-soft`: the active preset, the caseload's active view tab, the tool toggles.
- Categories took a tint under plum: resource-type badges, licensing badges and the pathway's stage chip.
- The two scale bars took the risk ramp.

Three moves go past the brief:
- **`.notice--brand` is gone.** It had no callers at all, and it was a second blue for info's job.
- **`.reassess-pill--due-soon` is info, not warning.** Due *today* is the warning; due *soon* is not one yet.
- **`.licensing-badge--registration` is sky-soft, not sand**, because `--commercial` was already sand.

The rubric's covered and checked states take success. PR 1 had had to borrow `--risk-low` for them, and they are not a risk level.
⚠️ **The scale bars are a stepped solid ramp, not the soft one.** The brief
offered either, and the measurement decided it: the four soft steps measure
1.02–1.03:1 against the bar's track (`--surface-muted`). A soft bar is
invisible. The solid steps measured 5.43 / 4.15 / 1.60 / 4.37. Moderate's 1.60 was
the edge-contrast gap recorded for the ramp above, and the old gradient's stops
were all below 3:1 too (2.30 → 1.27). The bars read the `-edge` tokens now, so
the moderate step measures 3.16.
`tests/colourContrast.test.ts` holds each family's text on its ground at
≥ 4.5:1. It checks each family has all four parts and that no `--accent-*` came
back. It also measures every rule, in every style root, that sets a status or
risk fill together with a text colour, as the pair that rule actually renders.
⚠️ **What nothing checks is a status colour doing another job.** The brief's
plant, `#2563eb` as the link colour, passed stylelint, `check:tokens` and every
test here. The rule the brief proposed (`--status-*` only inside `.notice*`,
`.pill*` or an allowlisted alert selector) was not built. On the day it would
have landed, 24 selectors outside Notice and Pill legitimately set a status
colour against 9 inside them, so the allowlist would have been longer than what
it guarded, and it still could not see a *new* token spelled in blue. A link is
`--brand-link` because this paragraph says so. Review is the gate.

**One brand, two densities.** Each app sets `data-density` once, on `<html>`
in its own `index.html`: `guide` for the Adoption Guide, `clinical` for both
SMART apps, panel and standalone alike. `foundation.css` gives each a block of
tokens: `--label-color`, `--card-pad`, `--card-radius`, `--page-rule` and
`--button-accent-allowed`. The guide sits closer to thespierproject.org, with
terracotta labels, roomier cards, the gradient rule and gradient button labels.
The clinical apps run inside someone else's chart, often in a 470px dock, and
are quieter: plum-muted labels (6.76:1 on white, 6.15:1 on the page), tighter
cards, no rule, plain labels.
⚠️ **The attribute is on `<html>`, not on the three shells the brief named.**
The clinical app's `/launch` and `/redirect` render outside both shells, and a
Card there would have resolved `--card-pad` to nothing. The HTML entry is the
one element above every route.
⚠️ **Terracotta is a guide colour.** In a clinical view a terracotta eyebrow
(#a8572d) sits beside the high-risk orange (#b8501f) and reads as a statement
about risk. `.pathway-node--attention`'s *border* was the last terracotta in
the clinical chart, and it is plum since 2026-09-24, matching the stage's own
"N due" pill. The attention rule comes after the active one, so its terracotta
used to paint over the active stage's plum border too; the stage you were on
never showed the active colour at all when it had something due.
⚠️ **Three companion tokens.** The approved set did not quite work in CSS on
its own:
- `--page-rule-display`: `--page-rule: none` still leaves the rule's 4px box and margins as a 36px gap, so the display switch takes the whole box.
- `--label-hairline` and `--label-underline`: the pill eyebrow's outline and the crumb's resting underline were terracotta too.

`--button-accent-allowed` is a number (1 or 0). Button mixes the label's
colour between transparent, which shows the gradient, and the pill's own text
colour, which paints over it. No component asks which app it is in.
`check:template` RULE 7 holds that: no `[data-density]` selector outside
`foundation.css`, no TypeScript reading the attribute, and every app's `<html>`
setting a value the file defines, with no defined value left unused.
`tests/colourContrast.test.ts` measures each density's label on the page and
on a card.
⚠️ **The panel's one-line header rules stayed in `PageHeader.css`**, all but
one: they are about the panel's *height*, not its density. The one deleted is
`.panel-shell .page-header__rule { display: none }`, which the clinical density
now does for both clinical shells. The standalone clinical tab loses the
gradient rule too; that is the brief's intent, not a side effect.

**Type is seven roles, and 11px is uppercase labels only.**
`--type-label` (11px/700), `--type-caption` (12), `--type-ui` (14),
`--type-body` (16), `--type-lead` (18), `--type-heading` (20, display face) and
`--type-title` (28, display). Each is a `font` shorthand, so a rule names one
token for size, line-height, weight and family. The density adds two:
`--type-running` (body in the guide, ui in the clinical apps) and
`--type-page-title` (title in the guide, heading in the clinical apps). They
replaced ten size-named `--font-size-*` tokens, six of them 1px apart between
10 and 15px, where authors picked by eye: `--font-size-2xs` (10px) was set 37
times and `--font-size-4xl` never. All ten were deleted, `font` joined
stylelint's strict-value list, and `tests/typeRoles.test.ts` fails a label in
a rule that doesn't set `text-transform: uppercase`.
⚠️ **The shorthand resets what the element would otherwise have inherited, and
that shipped as a regression in this PR's first draft.** The migration swapped
298 `font-size` declarations for roles, then a computed-style diff of 6,017
text elements (16 pages, two widths, `main` against the branch) found 24 kinds
of element whose weight or face had changed. There were three causes:
- **Class rules on headings** lost the display face the `h1`–`h6` element rule gives them. A class selector's `font` beats an element selector's `font-family`.
- **Classes on `<code>` and `<pre>`** lost the browser's monospace.
- **Size-only overrides** reset the weight their base rule set: `.panel-shell .pathway-node-title` lost 600, the dense identity strip's name lost 700.

The first two were swept as a class: every rule whose class appears on a
heading or code element in the TSX got its face restated, 18 rules, more
than the sample showed. The role goes first in every rule for the same
reason: a longhand after it still wins.
⚠️ **Where the brief's table was not the whole answer:**
- Prose runs follow `check:prose`'s own role names (lede → lead, body → running, note → caption). The exceptions are two instructions, the action card's and the post-submit next step, which are the thing to do, not a note.
- `.pill--sm` shares the pill's 11px, because the 10px step is gone.
- `.pill--label` is caption, because a name isn't uppercase.

There is no `--type-display`: the 44px role the brief named for the Overview
hero and the surface explainers would have been a token nothing sets. Both
take their title from PageHeader, like every page.

**Spacing is a 10-step scale**, `--space-0-5` … `--space-8`; the two half-steps
exist because the 0.25rem grid is too coarse below 0.5rem, where pill and badge
padding lives. Don't add an eleventh — a step is a decision every later author
inherits. Three things are deliberately *not* on it: `--gap-inline` (an `em`,
for an icon beside its label), a derived alignment (write the `calc()` over the
tokens it depends on rather than typing the sum — `.sidebar-link--child` and
`.stage-tools` do), and a sub-step hairline nudge (keeps its raw value behind a
`stylelint-disable` naming why it is not spacing). ⚠️ `ignoreValues` permits
any `calc(…)`, so a raw length inside one is unchecked; that is where a
deliberate derived value lives.

**Tracking has two tokens** — `--tracking-caps` for any small-caps label and
`--tracking-caps-wide` for an eyebrow — and `letter-spacing` is on the
strict-value list.

**Breakpoints are three literals, not tokens**, because `var()` cannot be read
inside `@media`: 640 / 768 / 1024, with `max-width` written as the complement
(639 / 767 / 1023) so a min and a max never overlap by a pixel; stylelint's
`media-feature-name-value-allowed-list` pins them, and a content-driven width
(a table that fits at 1100, a title that wraps at 340) is a
`stylelint-disable-next-line` naming why.

### Nine components own the surfaces below the page header

Eight live in `packages/ui` (`@spier/ui/<name>`); `WorkflowForm` stays in
`packages/tool-views` because it reads patient context. `SectionHeader` (the
`<h3>` row), `Card` (a bordered panel), `Pill` (a small inline marker),
`Notice` (a tinted message box), `Disclosure` (a labelled closed drawer),
`EmptyState` ("nothing here"), `DataTable`
(the table shell: wrapper, header type, cell padding, dividers),
`WorkflowForm` (the recorder frame) and `Button` (the plum pill: `primary` /
`secondary` / `link`, `accent` for a gradient label, `arrow` for one that
navigates; renders a Link, an anchor or a button by which of `to` / `href` /
neither it is given) each make one decision about padding, radius, type and
colour, and a page never redeclares it.

⚠️ **`Disclosure` is the ninth, added 2026-09-20 with the adoption-guide
audit's §4.4, and it is the one addition since the audit that wrote this rule.**
The case for it was measured, not stylistic: the same object had been
hand-rolled six times, and two of the six — `.ar-legend-block` on Adoption
Readiness and `.rubric-legend-criterion` on the Adoption Rubric — were
**byte-identical CSS in two stylesheets**. `check:dupes` reads functions, so
nothing was going to catch that pair; the ninth owner is what makes the next
copy unnecessary rather than merely discouraged. It has three variants
(`rule`, `boxed`, `quiet`), because three looks were already in use and a
fourth is a decision someone has to write down. Its `<summary>` stays
`display: list-item` — a summary set to `flex` loses its `::marker`, and a
drawer with no triangle does not read as one.

Three `<details>` on the clinician's surfaces deliberately did **not** adopt it,
each for a reason at its own call site and repeated in `Disclosure.tsx`:
`PopulationAlertsPanel`'s alert rows (the summary is a scannable data row, not a
label), and `InstrumentHeader`'s "About this instrument" and `PathwayStage`'s
"Use a different instrument", which carry recorded judgements about their weight
inside a clinician's form. Adopting those two is a follow-up to be judged in the
clinical chrome, not inherited from a guide copy change.

⚠️ The formbox renderer's submit is vendor DOM and copies `Button`'s decisions
by token in `App.css` — move one, move both.

A page may pass a `className` for **layout or a domain colour only** — where a
card sits, the colour of a FHIR resource type's pill — never a radius, padding,
border or background. Before these existed 76 card surfaces used 29
padding/radius combinations and ~40 pills 12 paddings; the gates check that a
value is on the token scale, not which value a role gets, so only a component
can hold that. Reach for one of the nine before writing a new class; if none
fits, `docs/plans/maintainability-audit-2026-09-15.md` §2.4 says how a variant
is added (a named prop, never a ninth look).

### Choosing a guide section's width

A new guide section chooses `prose` when unsure: `wide` on a prose page is
invisible, while `prose` on a page with a table shows up at once. The `width`
field on `GuideSection` is required with no default for that reason.
