# HL7 behavioral-health use cases

The HL7 BH working group collects scenarios as a spreadsheet: one row per event
step, eight fixed columns. SPiER owes them that artifact, and separately wants
the same scenario to drive a runnable demo and a FHIR mapping. This directory
keeps all three in step by making the spreadsheet a **build output**.

```
ed-scenario-11.json          ← source of truth, hand-edited
        │
        │  node scripts/build-use-case-workbook.mjs
        ▼
dist/HL7_BH_USE_CASES-ED-Scenario-11.xlsx   ← what the working group gets
dist/HL7_BH_USE_CASES-ED-Scenario-11.csv    ← same sheet, flat
ed-scenario-11.md                           ← the FHIR / functional mapping
```

⚠️ **Never hand-edit `dist/` or `ed-scenario-11.md`.** Same rule as
`web/src/data/fhir/`: the next build silently discards your change. Edit the
JSON and rebuild.

```bash
node scripts/build-use-case-workbook.mjs
```

## What the generated workbook contains

**Sheet 1 — the working group's format, verbatim.** Reproduced from the copy
they circulated rather than redesigned: `A1` is one merged full-width cell
holding the title and the 11.1 narrative, row 2 is the header, and each section
is announced by a merged full-width banner. Those seven merges are the only ones
in the document, and nothing inside the data grid is merged — which is why a CSV
export of it round-trips without losing structure.

Verified fidelity: for the 27 steps the working group circulated, the generator
reproduces every populated cell of columns A-G exactly, in the same layout.
Three deliberate differences.

1. **Column H is filled.** `HL7 EHR System Functional Model` was empty in all 27
   rows of the original — the one column that makes this an HL7 deliverable
   rather than a narrative. The references come from
   [`ed-scenario-11.md`](ed-scenario-11.md), where a complete first-pass mapping
   had been sitting unused.
2. **Punctuation is normalized to ASCII.** The original used U+2011
   NON-BREAKING HYPHEN inside `C-SSRS`, `SAFE-T` and `non-acute` — visually
   identical to `-`, and enough to defeat exact-match search and any join
   against the rest of the repo. Curly quotes likewise. En dashes and bullets
   are left alone; see `textPolicy` in the JSON.
3. **Ten SPiER-proposed steps are interleaved**, each labelled `(proposed)` in
   the Event Step cell. See below.

**Sheet 2 — SPiER's mapping.** FHIR resources, profile binding, whether a SPiER
profile exists yet, the CDS Hooks hook, the demo walkthrough step, and review
notes — joined to sheet 1 by Event Step. Deliberately a second sheet: the
working group asked for eight columns, and adding FHIR bindings to their
template would hand them a document that is no longer their template.

## Review notes do not travel as cell comments

The CSV that was circulated had silently dropped a reviewer's comment on `D7`
("storyboard - need the vendor agnostic version of this…"), because CSV has
nowhere to put one. The fix is not to re-emit cell comments — those live in a
legacy VML part, they are invisible in CSV, and a malformed one makes Excel show
a repair prompt on a document going to a working group.

Instead, notes live in the source JSON:

```json
"reviewNotes": [
  { "author": "…", "date": "2026-02-19", "column": "event", "text": "…" }
]
```

and are rendered into a visible column on sheet 2. **A comment typed into the
generated workbook is lost on the next build**, so put it in the JSON or in the
PR.

## The mapping document

[`ed-scenario-11.md`](ed-scenario-11.md) is the third output, and the one a
human reads to answer "what FHIR does step 11.3-1B need, and do we have it".

Markdown is the **authoritative** form of the mapping prose in the JSON —
`fhirText`, `profileBinding`, `cdsHook` all hold markdown — because it is the
only form that can carry a link to the artifact it describes. The spreadsheet
gets that flattened at build time. Storing the flattened text and re-adding
links for the document would lose them with nowhere to recover them from.

Three things in that document are **derived**, not restated:

- the **FHIR resource list** on the mapping sheet, picked out of `fhirText` by
  the backticks already around each type. `encounter` and `restriction.period`
  are elements, not resources, and drop out on the leading-capital test;
  `CarePlan.activity` contributes `CarePlan`. Extracted names are checked
  against `KNOWN_RESOURCES` in the script, so a typo fails instead of quietly
  becoming a resource type.
- the **consolidated profile-gap list**, concatenated from each step's
  `profileGaps` in step order — so it renumbers itself when a step is added.
- the **gating tool promotions**, de-duplicated from each step's `gatingIssues`.

Those last two used to be hand-maintained tallies of the tables above them.
`--check` now also asserts they stay honest: a step whose binding says `**gap**`
must name either a `profileGaps` entry or a `gatingIssues` entry, and a step
that names `profileGaps` must actually be marked as a gap.

One deliberate change when this document became generated: the old single
`Actor / Role` column is now two columns matching the workbook. It had been a
third hand-written variant of the same fact and had drifted from both others —
`ED Provider / Orderer` for what the scenario calls `ED Provider (MD/APP)` /
`Orderer / Authorizer`, `EHR System / Transmitter` for `Transmitter / Care
Transition Packager`, and four more like them.

## The demo linkage

`ed-scenario-11.json` declares, per step, which walkthrough step in
[`patient-011.json`](../../web/src/data/population/scenarios/patient-011.json)
narrates it. `--check` asserts that declaration in both directions:

- a step naming a walkthrough id must find it, under the same step label;
- a step declaring `"walkthrough": null` must give a `walkthroughGapReason`, and
  must **not** turn out to be narrated after all;
- a walkthrough step matching no scenario step must be listed in
  `extraWalkthroughSteps` with a reason.

It is an allowlist with reasons, not a coverage count — a pinned number churns
and trains people to bump it, which is what a stale `check:codings` floor
already did in #232. Declared un-narrated today: the four original steps 11.2-1B,
11.3-1E, 11.4-0B and 11.5-1C, plus every proposed step (the demo cannot narrate
a step the scenario has not adopted). Each carries its reason in the JSON.
Closing one means deleting its `walkthroughGapReason` and adding the narration;
the gate then requires the two to move together.

This drift was real and invisible before the gate existed: 24 of 27 steps were
narrated, and one walkthrough step (`11.7-1A-confirm`) belonged to no scenario.

## Proposed steps

The circulated scenario has 27 steps. SPiER proposes 10 more, closing three gaps
in the original: **the patient is never an actor** (self-report screening,
co-authoring the safety plan, committing to means-safety actions, responding to
outreach); **there are no alternate or exception flows** (declined screen,
negative screen, psychiatric admission or transfer, elopement); and **consent
appears as an input but never as a step** (disclosure authorization before the
transition packet, release rules before portal delivery).

They are marked `origin: "spier-proposed"` in the JSON and rendered
`11.2-1C (proposed)` wherever the id appears, so a reviewer can accept or reject
each one. Every proposal owes a `rationale`, and `--check` enforces that in both
directions. **Do not drop the marker to tidy the table** — presenting a SPiER
proposal unmarked inside the working group's own document would misrepresent
what they authored.

Nothing renumbers. A proposal takes the next free letter in its group
(`11.2-1C`, `11.5-1E`), because the original ids are already referenced by the
demo walkthrough, by this repo's docs, and by whoever holds the circulated copy.
That is why `11.7-0A` uses a `0` group, following the `11.4-0A` precedent.

The EHR-S FM references on proposed steps are drafts and need checking against
the published function list — as, in fairness, does every other reference in
that document, which still describes itself as a first-pass skeleton.

## Adding the next scenario

1. Write `docs/use-cases/<id>.json` in the same shape.
2. Add an entry to `SCENARIOS` in `scripts/build-use-case-workbook.mjs`.
3. Build, and commit the JSON alongside its `dist/` outputs.

Sheet names are capped at 31 characters and may not contain `[]:*?/\` — the
circulated workbook's tab was literally named `FINAL Emergency Department Use `,
truncated with the trailing space intact, which is what happens when nothing
checks. The writer now fails loudly instead.

## Related

- [`ed-scenario-11.md`](ed-scenario-11.md) — the narrative FHIR/profile mapping
  and the consolidated list of 22 missing profiles.
- CI: [`.github/workflows/use-case-workbook.yml`](../../.github/workflows/use-case-workbook.yml)
