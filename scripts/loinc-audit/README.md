# `loinc-audit` — check every LOINC coding against Regenstrief

```bash
bash scripts/loinc-audit/loinc-audit.sh .            # every instrument
bash scripts/loinc-audit/loinc-audit.sh . C-SSRS     # one folder
python3 scripts/loinc-audit/loinc_audit.py . --dry-run   # list codings, no network, no account
```

Walks every `Questionnaire` under `FHIR-Resources/`, extracts each distinct
`http://loinc.org` coding — panel codes, item codes and `answerOption` codings —
and asks `fhir.loinc.org` whether the code exists and whether the `display` is
one LOINC publishes. 76 codings, about 20 seconds.

## Why this is not a gate

It needs a **personal Regenstrief account** (`fhir.loinc.org` 302-redirects
anonymous requests to `auth.loinc.org`; there is no token or service-account
scheme). Making it CI would mean putting one person's credential in Actions
secrets — a terms question, and a dependency on one person's account. So it is a
tool you run deliberately: when adding codes, and after a LOINC release.

The offline gates stay where they are. `npm run check:codings` (nightly, against
`tx.fhir.org`) covers codings written in TypeScript; `scripts/validate-fhir.mjs`
covers resources. This is the authority the other two approximate.

## When to run it

- **After adding or changing any LOINC coding.** This is where the value is.
  Every defect the terminology gates have ever caught in this repo was an
  authoring error at introduction, not the authority changing something later.
- **After a LOINC release** (twice a year), which is the only time drift happens.
- **When `tx.fhir.org` cannot answer.** It lags LOINC releases — it served 2.82
  for months after 2.83 shipped — which is exactly the gap `PENDING_TX` in
  `web/scripts/check-codings.mjs` exists to absorb. This tool has no such gap.

## Two traps, both of which produced false results before this was written

- **`fhir.loinc.org` is non-conformant on `$validate-code`:** it returns `result`
  as `valueString "true"` rather than the spec's `valueBoolean`. Code that
  correctly insists on a boolean — which `check-codings.mjs` does, deliberately —
  reads every response as a server error. That is the single largest obstacle to
  pointing the nightly here.
- **Do not parse this in shell.** Two bash versions of this tool reported
  confident nonsense: curl returns pretty-printed multi-line JSON, which breaks
  any line-based format; and nine codings in this repo (all the PHQ-9 items)
  carry *no* `display`, so the empty field collapses under `read`'s IFS handling
  and every column shifts left. Both produced full-looking reports that had
  checked nothing.

## The display trap this was built for

A `display` must match what LOINC publishes, byte for byte. It is **not** the
question wording. NLM's LForms conversion of a LOINC panel puts the question
wording in `display` — *"In the past few weeks, have you wished you were dead?"* —
where LOINC's own display drops the comma and the question mark. All eight ASQ
displays were taken from there and all eight were wrong, while the codes were
right: a real code carrying a string its authority does not publish, which is
issue #220's shape and invisible to any code-only check.

In a `Questionnaire`, `item.text` and `item.code[].display` therefore differ on
purpose. `item.text` is what a patient reads and keeps its punctuation;
`code[].display` is LOINC's string. Do not "fix" one to match the other.

## Credentials

Read from the tty into a `0600` netrc that is deleted on exit, including on
Ctrl-C. Never in `argv`, never in shell history, never sent anywhere but
`fhir.loinc.org`. The script does not store or cache them.

## Finding what LOINC has published — no account needed

Discovery is free; only verification needs the account. NLM's LForms server
carries LOINC-derived `Questionnaire`s for published panels:

```bash
curl -s "https://lforms-fhir.nlm.nih.gov/baseR4/Questionnaire?title:contains=suicide&_elements=id,title"
```

As of 2026-09-08 LOINC's entire suicide-instrument inventory is four panels: the
ASQ (`115564-7`, new in 2.83) and three C-SSRS forms. SBQ-R, CAMS, PSS-3, BSSA
and SAFE-T have nothing, which is what the "no LOINC exists" notes on those
instruments record. Re-check after each release rather than treating those notes
as settled — the ASQ's were true for years and then were not.
