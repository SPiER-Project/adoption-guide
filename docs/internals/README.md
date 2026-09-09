# Repo internals: why the gates exist

`CLAUDE.md` is the entry point — it holds the repo layout, every command to
run, and the conventions as rules. It is read in full at the start of every
agent session, so it stays short enough to be read.

This folder holds the other half: **why each gate exists, what its
load-bearing rule is, and what it cannot see.** Every ⚠️ in here is a defect
that shipped. The paragraphs are not background — a gate that passes while
checking nothing is the failure mode this repo keeps hitting (#232, #261), and
each of these notes is the postmortem of one instance of it.

Read the file for the area you are changing **before** you change it.
`CLAUDE.md` links to each one from the section it belongs to.

| File | Read it before |
|---|---|
| [`web-gates.md`](web-gates.md) | adding or changing anything `npm run verify` runs, or trusting a `check:*` gate's coverage |
| [`terminology.md`](terminology.md) | adding a LOINC/SNOMED coding, touching `PENDING_TX`, or reading a red nightly |
| [`ig-build.md`](ig-build.md) | changing `ig/input/`, `sushi-config.yaml`, an IG page, the CQL, or `deploy.yml` |
| [`fhir-conformance.md`](fhir-conformance.md) | editing a scenario fixture, a mapper, an `.fml` map, or a validation rule shared with the mock EHR |
| [`measures.md`](measures.md) | changing a measure criterion, a population, or the dashboard's scoring |
| [`docs-gates.md`](docs-gates.md) | editing `docs/**`, the root `README.md`, or the HL7 use-case workbook |
| [`workers.md`](workers.md) | changing `services/cds-hooks/` or `services/mock-ehr/` |
| [`css-and-page-template.md`](css-and-page-template.md) | adding a page, a width, a design token, or a run of prose |
| [`build-gotchas.md`](build-gotchas.md) | a confusing `git status`, a bundle-size question, or changing a hand-duplicated value |

## The rule that produced all of it

**Prove a gate can fail before trusting it.** Plant a deliberate defect, watch
the gate exit non-zero, then remove it. Six distinct silent-pass mechanisms are
documented across these files — an empty conformance index, a `-ig` flag that
loads zero resources, a validator warning that degrades to a pass, a floor set
below the real count, a parser that skips what it cannot read, and an alias
whose absence reads as "nothing to guard". A green gate you have never seen go
red is not evidence of anything.
