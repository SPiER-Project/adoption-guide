# Plan 3 — Regroup the Adoption Guide's navigation

**Status:** IMPLEMENTED 2026-09-17. Kept for the reasoning; the sections below describe what was done. Run AFTER
[`provider-app-rename.md`](provider-app-rename.md), which renames a section this
plan moves. Independent of [`production-clinical-surface.md`](production-clinical-surface.md)
except that both add routes under `/guide/tools/`.

## Why

`GUIDE_SECTIONS` has two groups, Learn and Evaluate, and Learn holds six
sections that are not the same kind of thing. Three of them define what SPiER
*is* as a specification. Three of them are *surfaces that run it*. A reader
arriving at the sidebar cannot tell which is which, so the sidebar reads as one
undifferentiated list of six.

## Target structure

```
The standard          ← what SPiER defines, and what an implementer builds against
  Care Pathway
  Tools
    └ Adoption Readiness   (subpage, not a sidebar row)
  Data Dictionary

The applications      ← what runs the pathway
  Provider App
  Population Dashboard
  CDS Service

Evaluate              ← scoring where an adopter stands
  Adoption Rubric
```

Alternative labels if "The standard" / "The applications" read wrong in the
sidebar's 240px column: **Specification** / **Surfaces**, or **Define** / **Run**.
Pick one and use it in `GUIDE_GROUPS[].label` and nowhere else — the page header's
eyebrow derives from it via `guideGroupLabel`.

### Why Adoption Readiness is a subpage of Tools

This is not a judgement call. `pages/AdoptionReadiness.tsx` imports `TOOLS` and
`groupToolsByStage` from `@spier/core/data/catalog` and renders **one row per
catalogued instrument**. Its own header comment says "Data is reused, not
duplicated: everything here comes from the catalog." It is a second view of the
Tools catalog, scored by build status, inclusion status and target maturity. It
belongs under the thing it is a view of.

### Why Adoption Rubric stays where it is, for now

Brad's read is right and it is worth recording precisely, because it is the
argument for a future move rather than this one:

`EhrAdoptionRubric` calls `useLocalStorage('spier-ehr-rubric-v3')`. It **writes
state**. Every other guide section is read-only — that is the invariant
`guideSections.ts` encodes after Tool Configuration left for `/settings` on
2026-09-15. The rubric survived that pass because the state it writes is read by
no other surface, which satisfies the letter of the rule.

What it shares with `/settings` (`pages/ToolConfiguration.tsx`) is concrete:

- Both persist to browser storage rather than to a server.
- Both answer "what does this deployment support", per tool.
- Neither reads patient data.
- Both are a thing an adopter *fills in*, not a thing they *read*.

That is a real case for a third surface. **Do not act on it in this plan.**
Moving it needs a decision about where the answers live (browser storage does not
survive a laptop, and a readiness score is something an adopter shares with a
vendor), and that is a product question, not a navigation one. Leave it as a
one-section Evaluate group and open an issue for the spike.

## Scope

### A. `apps/guide/src/data/guideSections.ts`

- `GuideGroupId` becomes `'standard' | 'applications' | 'evaluate'` (or the
  chosen labels' ids).
- `GUIDE_GROUPS` gains the third entry, in reading order.
- `GUIDE_SECTIONS` is reordered. ⚠️ **It must stay grouped-contiguous.** The
  pager walks the list linearly, so an out-of-place section makes prev/next
  bounce between groups. The doc comment on the list says this; keep it true.
- `adoption-readiness` is removed from the list (see B).
- Rewrite the group-history comment. The existing one explains why "Configure"
  is gone; that reasoning still holds and should survive the edit.

New order:

```
pathway          standard      wide
tools            standard      wide
data-dictionary  standard      wide
provider-app     applications  prose
dashboard        applications  prose
cds-service      applications  prose
adoption-rubric  evaluate      wide
```

### B. Adoption Readiness becomes `/guide/tools/readiness`

⚠️ **This is the one risk in the plan.** `check:guide-boundary` derives the
guide's page set from `guideSections.ts`. A route under `/guide` that is not a
section is **unchecked** — CLAUDE.md names this exact failure ("A hand-rolled
route outside the list would be unchecked").

Do not accept that. Add a `subsections` field to `GuideSection`:

```ts
interface GuideSection {
  path: string
  label: string
  group: GuideGroupId
  width: 'prose' | 'wide'
  /** Pages reachable from this section but not shown in the sidebar or pager.
   *  Declared here so check:guide-boundary still derives them. */
  subsections?: { path: string; label: string }[]
}
```

Then update `scripts/check-guide-boundary.mjs` — its `guideEntryPoints()`
parses `/\{\s*path:\s*'([^']+)'/g` over the whole file, which will already pick up
a subsection's `path`. Confirm it resolves the route: the gate looks for
`<Route path="${p}" element={<Comp />}>` in `App.tsx`, and a nested path
(`tools/readiness`) must be declared in that exact shape for the regex to match.

`check:catalog` asserts `/guide/${section}` resolves for every parsed section
path. A subsection path of `tools/readiness` gives `/guide/tools/readiness`,
which resolves. A subsection path of `readiness` would give `/guide/readiness`,
which does not. **Use the full sub-path.**

Also:

- `App.tsx`: `<Route path="tools/readiness" element={<AdoptionReadiness />} />`,
  plus `<Route path="adoption-readiness" element={<Navigate to="/guide/tools/readiness" replace />} />`
  (published path, and `/guide/roadmap` already redirects to it).
- `pages/AdoptionReadiness.tsx`: it currently inherits the guide layout's header
  and width. As a subpage it still does, and per CLAUDE.md a sub-page root **may
  not declare a width**. It will render at Tools' `wide`, which is what it needs.
  But `AdoptionGuide.tsx` computes the active section from the **first** path
  segment under `/guide`, so `/guide/tools/readiness` will title itself "Tools".
  Fix that: give the layout a lookup that checks subsections before falling back
  to the section, and render the subsection's label as the title with the section
  as the second eyebrow segment (`['Adoption Guide', 'Tools']`).
- `pages/PatientJourney.tsx`: add the link into readiness, near the top where it
  describes the catalogue.
- The pager: a subsection is not a pager step. `prev`/`next` must resolve from
  the owning section, so a reader on `/guide/tools/readiness` gets Tools'
  neighbours. Confirm `activeIndex` handles this.

### C. Sidebar

`components/Sidebar.tsx` needs no structural change — it maps `GUIDE_SECTIONS`
and emits a heading when the group changes. Verify `Sidebar.test.tsx`, which
asserts on group headings and on exactly one link per label.

## Gates

```
cd web && npm run verify
node scripts/check-md-links.mjs
```

The load-bearing ones: `check:catalog` (section → route, `<Navigate>` targets),
`check:guide-boundary` (the derived page set — **run this one first**, it is what
the `subsections` field exists to keep honest), `check:template` (one owner of
the width), and `Sidebar.test.tsx`.

## Done when

- The sidebar shows three headings and the sections under each are the ones
  listed above.
- `/guide/adoption-readiness` and `/guide/roadmap` both land on
  `/guide/tools/readiness`, and that page titles itself "Adoption Readiness"
  under a "Tools" eyebrow.
- `check:guide-boundary` reports a page set that includes the readiness subpage.
- An issue is open for the Adoption Rubric standalone-surface spike.
