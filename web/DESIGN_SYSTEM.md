# SPiER design system

The web app's visual vocabulary lives as CSS custom properties (tokens) in
[`packages/ui/src/foundation.css`](../packages/ui/src/foundation.css). Component CSS references tokens via `var(--…)`
rather than hard-coding values. This keeps severity, spacing, type, and
elevation consistent across pages, and is **enforced by lint** — see
[Authoring rules](#authoring-rules).

## Token reference

All tokens are defined in the `:root` block of [`packages/ui/src/foundation.css`](../packages/ui/src/foundation.css).
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

Seven components own every surface below the page header; a page never
redeclares their padding, radius, type or colour. Each one's header comment
records the decision it makes and what is deliberately *not* it. A page may
pass `className` for **layout or a domain colour only**.

| Component | Owns | File |
|---|---|---|
| `SectionHeader` | the `<h3>` row: title, right-hand meta, optional title-as-toggle | [`src/components/SectionHeader.tsx`](../packages/ui/src/SectionHeader.tsx) |
| `Card` | a bordered panel: `--radius-lg`, `roomy`/`compact` padding, `card`/`muted`/`brand` tone, optional brand `accent` edge | [`src/components/Card.tsx`](../packages/ui/src/Card.tsx) |
| `Pill` | a small inline marker: `--radius-pill`, `sm`/`md`, `status`/`label`, tones incl. the risk ramp solid and soft | [`src/components/Pill.tsx`](../packages/ui/src/Pill.tsx) |
| `Notice` | a tinted message box with a 3px left edge, six tones, `role` from tone | [`src/components/Notice.tsx`](../packages/ui/src/Notice.tsx) |
| `EmptyState` | "nothing here": inline, or `panel` for an empty region | [`src/components/EmptyState.tsx`](../packages/ui/src/EmptyState.tsx) |
| `DataTable` | the table shell: scroll wrapper, optional frame, header type, `compact`/`comfortable` cells, dividers; the page writes its own `<thead>`/`<tbody>` | [`src/components/DataTable.tsx`](../packages/ui/src/DataTable.tsx) |
| `WorkflowForm` | the recorder frame: header, card-beside-drawer, hint, notice, code drawer | [`src/components/WorkflowForm.tsx`](../packages/tool-views/src/components/WorkflowForm.tsx) |

### Risk pill — `RiskPill`

[`src/components/RiskPill.tsx`](../packages/tool-views/src/components/RiskPill.tsx) is a wrapper over
`Pill` in a solid risk tone (`acute`/`high`/`moderate`/`low`/`none`/`unknown`),
led by the level's icon from `lib/statusIcons.tsx`. It replaced three
divergent per-page implementations so the same severity renders identically
everywhere; its colours now live in [`src/css/Pill.css`](../packages/ui/src/Pill.css).

```tsx
<RiskPill level="acute" label="Acute" />
<RiskPill level="moderate" label="Moderate" sm />
```

### Buttons

There is no shared button family. The `.btn-primary` / `.btn-secondary` /
`.btn-meta` rules once documented here were dead — nothing rendered them —
and were deleted by `check:css-dead` in 2026-09. `.workflow-submit-btn`
(recorders) and `.careplan-download-btn` (CarePlan) are the two live button
styles; a shared `Button` is a candidate for a later pass.

## Authoring rules

1. **Use tokens, not literals.** No raw hex, `font-size`, `box-shadow`, or
   color values in component CSS — reference a `var(--…)` token instead.
   [`.stylelintrc.json`](.stylelintrc.json) enforces this (`color-no-hex` +
   `declaration-strict-value`) and CI fails on drift.
2. **If you need a value that isn't tokenized, add the token first.** Add it to
   `:root` in [`packages/ui/src/foundation.css`](../packages/ui/src/foundation.css) (the only file allowed to define
   raw literals), document it here, then reference it.
3. **Components own their own CSS file** in their app's `src/css/` —
   [`apps/guide/src/css/`](../apps/guide/src/css/) or
   [`apps/clinical/src/css/`](../apps/clinical/src/css/). Shared primitives
   (buttons) live in [`packages/ui/src/`](../packages/ui/src/), and the chrome
   both apps mount keeps its stylesheets in
   [`packages/app-shell/src/css/`](../packages/app-shell/src/css/); don't
   reinvent them per page.
4. **Genuinely intentional exceptions** (e.g. em-relative inline-code sizing,
   the `.sr-only` `clip` hack) carry an inline
   `/* stylelint-disable-next-line … -- reason */` so the intent is explicit.

## Adding a new token

1. Add the custom property to the appropriate group in `:root` in
   [`packages/ui/src/foundation.css`](../packages/ui/src/foundation.css), with a one-line comment on its purpose.
2. Document the scale (or note the new value) in the table above.
3. Reference it via `var(--…)` from component CSS.

## Linting

```sh
npm run lint:css   # stylelint over src/**/*.css
```

Runs in CI on every PR touching `web/` (see
[`.github/workflows/web-lint.yml`](../.github/workflows/web-lint.yml)).
