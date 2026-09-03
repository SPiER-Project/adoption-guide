/**
 * hostChrome — the mock EHR's design system: its tokens, its components, and
 * its page frame.
 *
 * ── Why the host has a look of its own ──────────────────────────────────────
 *
 * ⚠️ **This file used to reason the other way, and the reasoning was wrong.**
 * It said matching SPiER's plum/raspberry palette "makes the screenshot
 * legible". What it actually did was make the host and its guest the same
 * colour — on a page whose entire claim is *"Everything below this bar is drawn
 * by SPiER, not by the host."* A raspberry **Launch SPiER** button drawn by the
 * EHR is that sentence contradicting itself in the one place a viewer looks.
 *
 * So the host is now **slate and steel** — the flat, institutional look of
 * vendor software — and SPiER's plum and raspberry appear on these pages in
 * exactly one role: labelling the frames SPiER draws inside
 * (`--guest-brand`, used by `.guest__title` and nowhere else). The boundary the
 * demo is about is now a colour boundary, which is the one a viewer reads
 * without being told.
 *
 * ── Why tokens, when the old comment said not to have a design system ───────
 *
 * The old objection was structural, and it was half right: these pages are
 * self-contained strings from a Worker with no stylesheet, no build step and no
 * token file, so they cannot use the app's design system — stylelint does not
 * see them, `check:tokens` does not see them, and pretending otherwise would be
 * claiming a rigour that is not there.
 *
 * But "cannot use *the app's* tokens" is not "cannot have tokens". Custom
 * properties need no build step. What the old arrangement actually produced was
 * three hand-copied palettes: this file exported `INK`/`RULE`/`TINT`, and
 * `controlPage.ts` — the very file the palette was extracted *from* — went on
 * typing `#5c4a54`, `#f3eef1`, `#d8cdd4` and `#fdf5f8` as literals in its own
 * hand-rolled `<!doctype>` document, along with its own `button`, `.warn`,
 * `code` and `h1` rules. The extraction had been done and then not adopted, and
 * nothing could see that, which is the hand-duplicated drift `CLAUDE.md` warns
 * about arriving inside the fix for it.
 *
 * `npm run check:host-css` is what makes that visible now: a raw hex literal
 * anywhere in `src/` outside the `TOKENS` block below is a build failure. It is
 * this file's stand-in for the app's `color-no-hex`, and it exists because the
 * comment asking people not to duplicate the palette had already failed once.
 *
 * ── The rule for adding to this file ────────────────────────────────────────
 *
 * A rule belongs here when **more than one page needs it**, or when it is part
 * of the host's identity (the app bar, the buttons, the tables). A rule belongs
 * in the page when it describes that page's one arrangement — the chart's panel
 * dock, the front door's activity frame. `page()` composes the two.
 */

/**
 * The host's tokens.
 *
 * ⚠️ **The only place in `src/` allowed to contain a hex literal**, and
 * `check-host-css.mjs` enforces exactly that by parsing for this block. Renaming
 * the export means updating the script; it fails loudly rather than scanning
 * nothing, which is the failure mode this repo keeps catching (#232, #261).
 */
export const TOKENS = `
  :root {
    color-scheme: light;

    /* ── Ink ──────────────────────────────────────────────────────────────
       Tinted toward slate rather than neutral grey, so the host reads cool
       against the panel's warm plum rather than merely "grey next to purple". */
    --ink: #16202b;
    --ink-soft: #47586a;
    --ink-faint: #7d8d9c;

    /* ── Action ───────────────────────────────────────────────────────────
       Steel blue. Deliberately the least fashionable choice on the page: a host
       that looked designed would compete with the thing it is framing. */
    --action: #16628f;
    --action-hover: #0e4467;
    --action-soft: #e7eff5;

    /* ── Surfaces ─────────────────────────────────────────────────────────── */
    --surface: #ffffff;
    --surface-sunken: #f1f5f8;
    --surface-header: #f7f9fb;

    /* The app bar — the single darkest element, and the thing that makes three
       loose documents read as one product. */
    --chrome: #1d2a38;
    --chrome-ink: #dfe8f0;
    --chrome-ink-dim: #94a6b6;
    --chrome-line: #33465a;

    /* ── Lines ────────────────────────────────────────────────────────────── */
    --line: #d5dee6;
    --line-strong: #b0c0cd;

    /* ── Status ───────────────────────────────────────────────────────────
       Used by CDS card severities and by the standing disclaimer. Kept away from
       the guest's raspberry on purpose: a red-ish host accent next to a
       raspberry SPiER accent is the collision this palette exists to avoid, so
       critical here is a deep brick rather than a pink-leaning red. */
    --critical: #a4102f;
    --critical-soft: #fbeaee;
    --warning: #8a5209;
    --warning-soft: #fdf4e7;
    --notice: #1f5f4a;
    --notice-soft: #e9f4f0;

    /* ── The guest ────────────────────────────────────────────────────────
       thespierproject.org's plum and raspberry (project_spier_official_brand).
       ⚠️ These are the ONLY SPiER colours on these pages, and they are permitted
       in exactly one role: naming SPiER on the chrome bar above something SPiER
       drew. A host control tinted with them is the defect described at the top
       of this file. */
    --guest-brand: #cc3366;
    --guest-ink: #341528;
    --guest-tint: #fdf5f8;

    /* ── Scale ────────────────────────────────────────────────────────────
       One spacing ramp and one radius, because a host with three radii looks
       like it was designed by three people, which is how the CSS here got into
       the state that prompted this file. */
    --s1: .25rem;
    --s2: .5rem;
    --s3: .75rem;
    --s4: 1rem;
    --s5: 1.5rem;
    --s6: 2rem;
    --radius: 4px;
    --radius-pill: 999px;

    --text-xs: .75rem;
    --text-sm: .8125rem;
    --text-base: .9375rem;
    --text-lg: 1.0625rem;
    --text-xl: 1.375rem;

    /* Vendor software is system-font software. It is also the cheapest possible
       way to not look like SPiER, which ships Poppins. */
    --font: system-ui, -apple-system, "Segoe UI", roboto, sans-serif;
    --font-mono: ui-monospace, sfmono-regular, "SF Mono", menlo, monospace;

    /* The app bar's height, and therefore the offset of everything that pins
       itself below it. FOUR rules need this number — the bar, the chart's
       min-height, and the dock's top and height — and three of them are in
       another file. One token, because a hand-copied 3rem inside a
       calc(100vh - …) is invisible when it goes wrong: the dock is simply
       short, and nothing looks broken. */
    --bar-h: 3rem;

    --shadow-bar: 0 1px 0 rgb(0 0 0 / 8%);
    --shadow-card: 0 1px 2px rgb(22 32 43 / 6%);
  }
`

/**
 * Escape text interpolated into HTML.
 *
 * Every value these pages render comes from the repo's own fixtures, so this is
 * not guarding against an attacker today. It guards against the day a scenario
 * grows a name with an apostrophe and the page silently breaks — and against
 * this file being read as an example of how to build the real thing.
 */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The host's components. Every page gets all of them; they are ~4KB of CSS and
 * the alternative is deciding per page which subset to include, which is how the
 * palette came to have three copies.
 */
export const COMPONENTS = `
  * { box-sizing: border-box; }

  body {
    margin: 0;
    font: var(--text-base)/1.55 var(--font);
    color: var(--ink);
    background: var(--surface-sunken);
  }

  /* ── App bar ──────────────────────────────────────────────────────────────
     Not decoration. Three pages that each began with a bare <h1> read as three
     documents; one persistent bar across the top is what makes them read as one
     application — which matters here, because the demo's subject is what it
     looks like when an application hosts someone else's. */
  .app-bar {
    display: flex;
    align-items: center;
    gap: var(--s4);
    padding: 0 var(--s5);
    height: var(--bar-h);
    background: var(--chrome);
    color: var(--chrome-ink);
    box-shadow: var(--shadow-bar);

    /* Sticky, which is what a vendor toolbar does — and what makes the chart's
       docked panel exact rather than approximate: the dock pins to --bar-h and
       is a viewport minus --bar-h tall, so it lines up at every scroll position
       instead of only at the top of the page.

       z-index above the dock, whose own stacking context starts at 0. */
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .app-bar__mark {
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--surface);
    text-decoration: none;
    white-space: nowrap;
  }

  /* "Demo" is stated in the chrome, not only in the disclaimer at the foot: the
     bar is in every screenshot and the foot of the page is not. */
  .app-bar__tag {
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    padding: .1rem var(--s2);
    border-radius: var(--radius);
    border: 1px solid var(--chrome-line);
    color: var(--chrome-ink-dim);
    /* The bar is a fixed --bar-h tall, so anything that wraps inside it
       overflows instead of growing it. At 375px this tag wrapped to two lines
       and burst the bar. */
    white-space: nowrap;
  }

  /* Squeezes before the mark and the tag do: on a phone the nav is two short
     words and the identity of the host is the thing worth keeping legible. */
  .app-bar__nav { display: flex; gap: var(--s4); margin-left: auto; min-width: 0; }

  .app-bar__link {
    font-size: var(--text-sm);
    color: var(--chrome-ink-dim);
    text-decoration: none;
  }

  .app-bar__link:hover { color: var(--surface); }
  .app-bar__link[aria-current="page"] { color: var(--surface); font-weight: 600; }

  /* ── Page ─────────────────────────────────────────────────────────────────
     The sole owner of the page inset, the same rule \`.app-shell__body\` follows
     in the app: a page that pads its own root indents its content relative to
     every other page for a reason invisible from the page itself. */
  .page { padding: var(--s5); max-width: 68rem; }
  .page--prose { max-width: 44rem; }

  /* Wide enough that a framed activity clears 1100px of INNER width at a normal
     desktop size — 82rem less the 48px of inset is 1264px. That threshold is not
     arbitrary: it is the breakpoint inside SPiER's caseload widget, and below it
     the widget stacks and the frame has to be 21rem taller. Prose is still
     capped by the .lede rule, and a worklist table filling the width is what a
     worklist table is for. */
  .page--wide { max-width: 82rem; }

  .page--flush { padding: 0; max-width: none; }

  /* ── Typography ───────────────────────────────────────────────────────── */
  h1 { font-size: var(--text-xl); font-weight: 700; margin: 0 0 var(--s1); letter-spacing: -.01em; }

  /* Section headings are the host's structure, so they carry a rule rather than
     just size — at these sizes weight alone does not separate a section from a
     bold paragraph. */
  h2 {
    font-size: var(--text-lg);
    font-weight: 700;
    margin: var(--s6) 0 var(--s3);
    padding-bottom: var(--s2);
    border-bottom: 1px solid var(--line);
  }

  h3 { font-size: var(--text-base); font-weight: 700; margin: var(--s5) 0 var(--s2); }
  p { margin: 0 0 var(--s3); }
  .lede { color: var(--ink-soft); margin: 0 0 var(--s4); max-width: 60rem; }
  small { font-size: var(--text-xs); color: var(--ink-faint); }

  a { color: var(--action); text-underline-offset: 2px; }
  a:hover { color: var(--action-hover); }

  code {
    font: var(--text-xs)/1.4 var(--font-mono);
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    padding: .05em .3em;
    border-radius: var(--radius);
  }

  /* ── Micro-label ──────────────────────────────────────────────────────────
     The uppercase caption above a value. One definition; the banner, the guest
     bars and the field labels all use it, and before this they each had their
     own font-size/letter-spacing pair. */
  .label {
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  /* ── Breadcrumbs ──────────────────────────────────────────────────────── */
  .crumbs {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s2);
    align-items: baseline;
    font-size: var(--text-sm);
    color: var(--ink-soft);
    margin: 0 0 var(--s4);
  }

  .crumbs a { text-decoration: none; }
  .crumbs a:hover { text-decoration: underline; }
  .crumbs span[aria-hidden] { color: var(--line-strong); }

  /* ── Surface ──────────────────────────────────────────────────────────────
     One bordered white box. \`.card\` is the box; the modifiers are the accent
     stripe, which is the only variation any page here actually wanted. */
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--s3) var(--s4);
    box-shadow: var(--shadow-card);
  }

  .card--critical { border-left: 3px solid var(--critical); }
  .card--warning  { border-left: 3px solid var(--warning); }
  .card--info     { border-left: 3px solid var(--action); }

  .card__title { font-weight: 700; margin: 0; }
  .card__body { margin: var(--s2) 0 0; font-size: var(--text-sm); color: var(--ink-soft); }
  .card__meta { margin: var(--s2) 0 0; font-size: var(--text-xs); color: var(--ink-faint); }
  .card__actions { display: flex; flex-wrap: wrap; gap: var(--s2); margin-top: var(--s3); }

  /* A list of cards. The list-style reset on the <ul> and the gap in one place,
     because three pages were each declaring it. */
  .stack { display: grid; gap: var(--s3); margin: 0; padding: 0; list-style: none; }

  /* ── Buttons ──────────────────────────────────────────────────────────────
     ⚠️ Steel, never raspberry. A host control in SPiER's colour is the defect
     described at the top of this file. */
  .btn {
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    padding: .35rem var(--s3);
    border-radius: var(--radius);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
  }

  .btn:hover { border-color: var(--action); color: var(--action); }
  .btn:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }

  .btn--primary { background: var(--action); border-color: var(--action); color: var(--surface); }
  .btn--primary:hover { background: var(--action-hover); border-color: var(--action-hover); color: var(--surface); }
  .btn--lg { font-size: var(--text-base); padding: var(--s2) var(--s4); }

  /* The SMART badge. Marks a control that mints a real SMART launch, which is
     the distinction the CDS-card entry point exists to demonstrate — so it is a
     statement about the protocol, not a decoration. */
  .btn--smart::before {
    content: "SMART";
    font-size: .625rem;
    font-weight: 700;
    letter-spacing: .06em;
    margin-right: var(--s2);
    padding: .05rem .25rem;
    border-radius: 2px;
    background: var(--action-soft);
    color: var(--action);
  }

  .btn--primary.btn--smart::before { background: rgb(255 255 255 / 20%); color: var(--surface); }

  /* Option buttons — the settings page's profile and width pickers. A pressed
     one is marked with a bar rather than a fill, so the state survives being
     printed or screenshotted in greyscale. */
  .option {
    width: 100%;
    display: grid;
    gap: var(--s1);
    text-align: left;
    padding: var(--s3) var(--s4);
    box-shadow: none;
  }

  .option span { font-size: var(--text-sm); font-weight: 400; color: var(--ink-soft); }
  .option[aria-pressed="true"] {
    border-color: var(--action);
    box-shadow: inset 3px 0 0 var(--action);
    background: var(--action-soft);
  }

  /* ── Table ────────────────────────────────────────────────────────────────
     Dense, ruled, left-aligned — a worklist, not a marketing table. */
  .table { width: 100%; border-collapse: collapse; background: var(--surface); font-size: var(--text-sm); }
  .table th, .table td { text-align: left; padding: var(--s2) var(--s3); border-bottom: 1px solid var(--line); }
  .table thead th { background: var(--surface-header); border-bottom: 1px solid var(--line-strong); }
  .table tbody tr:hover { background: var(--action-soft); }
  .table td a { font-weight: 600; text-decoration: none; }
  .table td a:hover { text-decoration: underline; }
  .mono { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-soft); }

  /* ── Form controls ────────────────────────────────────────────────────── */
  .form { display: grid; gap: var(--s3); margin: 0 0 var(--s4); max-width: 34rem; }
  .field { display: grid; gap: var(--s1); }
  .field--check { grid-template-columns: auto 1fr; align-items: start; gap: var(--s2); }
  .field > span { font-size: var(--text-sm); color: var(--ink-soft); }

  select, input[type="text"] {
    font: inherit;
    font-size: var(--text-sm);
    padding: .35rem var(--s2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
  }

  select:focus-visible, input[type="text"]:focus-visible { outline: 2px solid var(--action); outline-offset: 1px; }

  /* ── Callout ──────────────────────────────────────────────────────────────
     The plain one is neutral; --warn is the standing disclaimer and the
     "this is not what it looks like" notes, which are the only two kinds of
     caveat these pages make. */
  .callout {
    padding: var(--s3) var(--s4);
    border: 1px solid var(--line);
    border-left: 3px solid var(--action);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: var(--text-sm);
    margin: var(--s4) 0 0;
  }

  .callout--warn { border-left-color: var(--warning); background: var(--warning-soft); border-color: var(--warning-soft); }
  .callout > :last-child { margin-bottom: 0; }

  /* ── The hood ─────────────────────────────────────────────────────────────
     A closed <details> holding the page's EVIDENCE and its caveats — the
     endpoint that was called, the topic that was subscribed, the write log,
     the "this is not what it looks like" notes. These used to sit inline at
     the same weight as the one thing the page asks a viewer to do, and the
     reported result was not knowing what to do. Nothing in here is deleted;
     it is one click away instead of first.

     ⚠️ The disclaimers move here too, and that is deliberate: the guardrails
     in the panel plan §1 require that the pages SAY what they do not prove,
     which a collapsed section still does. They do not require that the
     caveat be the first thing on the screen. */
  .hood {
    margin: var(--s5) 0 0;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .hood > summary {
    cursor: pointer;
    padding: var(--s3) var(--s4);
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--ink-soft);
    list-style: none;
  }

  .hood > summary::-webkit-details-marker { display: none; }
  .hood > summary::before { content: "\\25B8"; display: inline-block; width: 1.1em; color: var(--ink-faint); }
  .hood[open] > summary::before { content: "\\25BE"; }
  .hood[open] > summary { border-bottom: 1px solid var(--line); }
  .hood__body { padding: var(--s2) var(--s4) var(--s4); }
  .hood__body > h3:first-child { margin-top: var(--s2); }
  .hood__body h3 { font-size: var(--text-base); margin: var(--s4) 0 var(--s2); }
  .hood__body .callout { margin-top: var(--s3); }

  /* ── Start here ───────────────────────────────────────────────────────────
     The two or three charts a first-time viewer is told to open, each with
     what it shows and what to notice. A grid of cards rather than a list so
     the three read as alternatives, not steps. */
  .try {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--s3);
    margin: 0 0 var(--s5);
    padding: 0;
    list-style: none;
  }

  .try__card {
    display: flex;
    flex-direction: column;
    gap: var(--s2);
    padding: var(--s4);
    border: 1px solid var(--line);
    border-top: 3px solid var(--action);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }

  .try__name { margin: 0; font-size: var(--text-base); font-weight: 700; }
  .try__why { margin: 0; font-size: var(--text-sm); color: var(--ink-soft); }
  .try__watch { margin: 0; font-size: var(--text-sm); }
  .try__watch strong { color: var(--ink-soft); font-weight: 600; }
  .try__card .btn { align-self: flex-start; margin-top: auto; }

  /* The one-line story column in the patient table. */
  .story { color: var(--ink-soft); }

  /* A one-line readout beside a link — the write log, the FHIRcast status. */
  .readout {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--s3);
    font-size: var(--text-sm);
    color: var(--ink-soft);
  }

  /* ── The guest ────────────────────────────────────────────────────────────
     SPiER framed by the host: a chrome bar the host draws, above pixels it does
     not. Both places this happens — the front door's caseload activity and the
     chart's docked panel — were separately inventing \`.activity__bar\` and
     \`.panel-dock__bar\` with the same job and different type sizes. One
     component, because the point being made is one point.

     ⚠️ This is the ONLY component allowed to use --guest-brand. */
  .guest {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--surface);

    /* Named, so a page can size a framed activity against the FRAME's width
       rather than the window's. The front door needs this: its frame height
       depends on a breakpoint inside the panel, and every attempt to reach that
       number by subtracting the host's own insets from the viewport has been
       wrong — see HOME_CSS in chartPage.ts. */
    container: guest / inline-size;
  }

  .guest__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s2) var(--s3);
    padding: var(--s2) var(--s3);
    border-bottom: 1px solid var(--line);
    background: var(--surface-header);
    font-size: var(--text-xs);
    color: var(--ink-soft);
  }

  /* The wordmark, and the reason the guest palette exists at all. */
  .guest__title {
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--guest-brand);
  }

  .guest__note { margin-left: auto; color: var(--ink-faint); }
  .guest iframe { display: block; width: 100%; border: 0; background: var(--surface); }
`

/**
 * The page frame.
 *
 * Emits the app bar itself rather than leaving it to each page: a page that can
 * forget the chrome is a page that will, and the bar is what makes these three
 * routes one application.
 *
 * `nav` marks the current tab. `wrap: false` hands the page the raw body — the
 * chart's two-column layout owns its own scaffolding and cannot sit inside a
 * padded `.page`.
 */
export function page({
  title,
  css = '',
  body,
  script = '',
  nav,
  variant = 'default',
}: {
  title: string
  css?: string
  body: string
  script?: string
  /** Which app-bar tab is current. Omit on pages that are not a tab. */
  nav?: 'chart' | 'settings'
  /**
   * `prose` narrows the column, `wide` widens it for a framed activity, and
   * `flush` hands the page its own inset to own.
   */
  variant?: 'default' | 'prose' | 'wide' | 'flush'
}): string {
  const cls = variant === 'default' ? 'page' : `page page--${variant}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${TOKENS}${COMPONENTS}${css}</style>
</head>
<body>
<header class="app-bar">
  <a class="app-bar__mark" href="/">SPiER mock EHR</a>
  <span class="app-bar__tag">Demo host</span>
  <nav class="app-bar__nav">
    <a class="app-bar__link" href="/"${nav === 'chart' ? ' aria-current="page"' : ''}>Patients</a>
    <a class="app-bar__link" href="/settings"${nav === 'settings' ? ' aria-current="page"' : ''}>Settings</a>
  </nav>
</header>
<div class="${cls}">
${body}
</div>
${script ? `<script>${script}</script>` : ''}
</body>
</html>`
}

/** A breadcrumb trail. The last entry is the current page and is not a link. */
export function crumbs(trail: Array<{ label: string; href?: string }>): string {
  return `<nav class="crumbs">${trail
    .map((c, i) => {
      const sep = i > 0 ? '<span aria-hidden="true">/</span>' : ''
      return c.href
        ? `${sep}<a href="${esc(c.href)}">${esc(c.label)}</a>`
        : `${sep}<strong>${esc(c.label)}</strong>`
    })
    .join('')}</nav>`
}

/**
 * The standing disclaimer. Every page carries it because every page of this
 * server is capable of being screenshotted on its own.
 *
 * Not boilerplate: this host is controlled by the same project it demonstrates,
 * so nothing observed here is evidence of interoperability. The panel plan's §8
 * guardrails make saying so a binding condition rather than good manners.
 */
export const DISCLAIMER = `
  <p class="callout callout--warn">
    <strong>Demonstration host only.</strong> This is not a real EHR and holds only synthetic patients.
    It is controlled by the same project it demonstrates, so nothing observed here is evidence of
    interoperability — that claim is only made against a public sandbox.
  </p>`
