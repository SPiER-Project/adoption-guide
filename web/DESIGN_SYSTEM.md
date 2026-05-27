# SPiER design system

The web app's visual vocabulary lives as CSS custom properties (tokens) in
[`src/index.css`](src/index.css). Component CSS references tokens via `var(--…)`
rather than hard-coding values. This keeps severity, spacing, type, and
elevation consistent across pages, and is **enforced by lint** — see
[Authoring rules](#authoring-rules).

## Token reference

All tokens are defined in the `:root` block of [`src/index.css`](src/index.css).
That file is the single source of truth; this doc summarizes the scales.

| Scale | Token prefix | What it's for | Example |
|---|---|---|---|
| **Surfaces** | `--surface-*` | Page / card / muted backgrounds | `background: var(--surface-card)` |
| **Text** | `--text-*` | Heading, body, muted, on-brand, error copy | `color: var(--text-body)` |
| **Borders** | `--border-*` | Dividers and outlines, default → emphasis | `border: 1px solid var(--border-default)` |
| **Brand** | `--brand-*` | Maroon primary + orange accent (CTAs, gradients) | `background: var(--brand-primary)` |
| **Semantic accents** | `--accent-{info,warning,success,…}-*` | Status colors for info / warning / success and the violet / magenta / orange families | `color: var(--accent-info-text)` |
| **Risk** | `--risk-{acute,high,moderate,low}{,-soft-bg,-soft-text,-faded}` | Clinical severity palette (solid, soft-bg, soft-text, faded) | `background: var(--risk-acute)` |
| **Spacing** | `--space-1 … --space-8` | 4-pt rem scale (0.25rem → 2rem) | `padding: var(--space-2) var(--space-4)` |
| **Radius** | `--radius-{xs,sm,md,lg,xl,2xl,pill,circle}` | Corner rounding | `border-radius: var(--radius-pill)` |
| **Font size** | `--font-size-{2xs,xs,sm,base,md,lg,xl,2xl,3xl,4xl}` | Type scale (0.625rem → 2rem); `base` is the most common component body size | `font-size: var(--font-size-base)` |
| **Line height** | `--line-height-{tight,normal}` | 1.2 / 1.5 | `line-height: var(--line-height-tight)` |
| **Elevation** | `--shadow-{sm,md,lg,xl}` | 4-level drop-shadow scale | `box-shadow: var(--shadow-md)` |
| **Specialty shadows** | `--shadow-{drawer,focus-ring,card-outline,brand-glow}` | Non-elevation semantic shadows (focus halo, drawer, etc.) | `box-shadow: var(--shadow-focus-ring)` |

## Components

### Risk pill — `.risk-pill`

The single canonical severity chip, defined in
[`src/css/RiskPill.css`](src/css/RiskPill.css). It replaced three divergent
per-page implementations (`.patient-banner-risk`, `.caseload-risk`,
`.risk-alert-level`) so the same severity renders identically everywhere.

Compose a **size** (optional) with a **severity** modifier:

| Class | Effect |
|---|---|
| `.risk-pill` | Default size (banner, caseload table) |
| `.risk-pill--sm` | Smaller; for dense alert lists |
| `.risk-pill--acute` / `--high` / `--moderate` | Solid severity background + white text |
| `.risk-pill--low` | Faded green background + dark green text (better low-severity contrast / WCAG AA) |
| `.risk-pill--none` / `--unknown` | Muted background + muted text (`--unknown` italic) |

```html
<span class="risk-pill risk-pill--acute">Acute</span>
<span class="risk-pill risk-pill--sm risk-pill--moderate">Moderate</span>
```

### Buttons — `.btn-*`

The canonical button family lives in [`src/App.css`](src/App.css) (search
`.btn-primary`). Do **not** redefine buttons in per-page CSS — earlier
duplicates in `Home.css` were removed so the family has one home.

- `.btn-primary` — maroon-filled primary action.
- `.btn-secondary` — bordered secondary action (icon + label).
- `.btn-icon` — leading icon inside a button.
- `.btn-meta` — trailing muted metadata text.

## Authoring rules

1. **Use tokens, not literals.** No raw hex, `font-size`, `box-shadow`, or
   color values in component CSS — reference a `var(--…)` token instead.
   [`.stylelintrc.json`](.stylelintrc.json) enforces this (`color-no-hex` +
   `declaration-strict-value`) and CI fails on drift.
2. **If you need a value that isn't tokenized, add the token first.** Add it to
   `:root` in [`src/index.css`](src/index.css) (the only file allowed to define
   raw literals), document it here, then reference it.
3. **Components own their own CSS file** in [`src/css/`](src/css/). Shared
   primitives (buttons) live in `App.css`; don't reinvent them per page.
4. **Genuinely intentional exceptions** (e.g. em-relative inline-code sizing,
   the `.sr-only` `clip` hack) carry an inline
   `/* stylelint-disable-next-line … -- reason */` so the intent is explicit.

## Adding a new token

1. Add the custom property to the appropriate group in `:root` in
   [`src/index.css`](src/index.css), with a one-line comment on its purpose.
2. Document the scale (or note the new value) in the table above.
3. Reference it via `var(--…)` from component CSS.

## Linting

```sh
npm run lint:css   # stylelint over src/**/*.css
```

Runs in CI on every PR touching `web/` (see
[`.github/workflows/web-lint.yml`](../.github/workflows/web-lint.yml)).
