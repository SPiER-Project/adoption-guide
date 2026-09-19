# `packages/ui` — the surfaces, and the tokens they are made of

The design system: the primitives that own padding, radius, type and colour, and
the `foundation.css` that defines every token they consume.

```
Button  Card  DataTable  EmptyState  Notice  PageHeader  Pill  SectionHeader
```

⚠️ **These make the decisions so a page cannot.** Before they existed, 76 card
surfaces used 29 padding/radius combinations and ~40 pills used 12 paddings. The
CSS gates check that a value is *on the token scale*, never *which* value a role
gets — so only a component can hold that. A page may pass a `className` for
layout or a domain colour; never a radius, padding, border or background.

## What is deliberately NOT here

| | why |
|---|---|
| **`WorkflowForm`** | It reads `usePatient()`. The recorder frame is an app component that happens to look like a primitive, and moving it would have inverted the dependency — a UI package importing the app's patient context. It stays in `web/src/components`. |
| **`Shell` / `AppShell` / `PanelShell` / `LaunchShell`** | Chrome, not surfaces. They compose the app's navigation and know about routes, surfaces and SMART sessions. |
| **`SpierLogo`** | Brand, not a primitive. |

⚠️ **`WorkflowForm` being excluded is a finding, not an oversight.** CLAUDE.md
lists it among the components that "own the surfaces", and it does — but it is
the one of them that is app-coupled. If it ever needs to be shared, it takes
what it reads as props first.

## Tokens

`foundation.css` is the former `web/src/index.css`: the font imports, the
`:root` token block, and the global resets every page inherits. It moved with
the components on purpose — **a UI package whose components reference tokens it
does not define is not handable**, because an adopter gets unstyled components
and no way to tell why.

⚠️ Values commented `sampled` were read off the rendered Figma, not its
variables. Replace them from the file; do not tune them by eye. Two are
deliberately deeper than the design for WCAG AA at app sizes.

## The gates travel with it

`check:tokens`, `check:css-dead`, `check:prose` and `check:template` all read
this tree **and** `web/src` — the components live here and the pages that use
them live there, so every one of those questions spans both. They stay in
`web/scripts` and run in `web`'s `npm run verify`, the same arrangement
`packages/core` uses for its tests: **one pipeline, not a fourth.**

⚠️ Every one of them fails when it reads nothing, and each was re-proven against
planted defects after the move — a gate that silently stopped seeing half its
input is exactly the failure this repo keeps rediscovering.

## Consuming it

```ts
import { Button } from '@spier/ui/Button'
import { cx } from '@spier/ui/cx'
import '@spier/ui/foundation.css'   // once, in main.tsx
```

Resolved by declared alias rather than an npm workspace (#387), so the alias
lives in `web/vite.config.ts`, `web/vitest.config.ts` and `web/tsconfig.app.json`
— all three must agree.
