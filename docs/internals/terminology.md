# External terminology: LOINC, SNOMED, and the nightly

The one gate that needs a terminology server, its expiring allowlist, and why
its floors are per source *and* per vocabulary family.

Moved out of `CLAUDE.md`, which keeps the commands and the rules and links
here for the reasoning. Every ⚠️ below is a defect that shipped: the paragraph
exists because something passed while checking nothing, or read correct-looking
and was false. See [`docs/internals/README.md`](README.md).

`check:codings` is deliberately **not** in `verify`, because it needs a
terminology server and so cannot be offline-reproducible — it runs nightly
instead:
```
npm run check:codings    # every LOINC / SNOMED / terminology.hl7.org code+display
                         # literal in web/src and services/, checked against tx.fhir.org
```

⚠️ **`PENDING_TX` is its one tolerated failure, and it is built to expire.**
tx.fhir.org lags LOINC releases, so a code SPiER adopts from a new edition can be
correct and still not resolve — the eight ASQ codes from LOINC 2.83 against the
server's 2.82 are the case it was written for. An entry (keyed `system|code`,
valued with the edition and date) lets that code pass. **Two of its three rules
FAIL rather than warn:** an entry the server *does* resolve fails the run, so a
caught-up server forces the line's deletion instead of leaving a permanent hole;
and an entry naming a code the scan no longer finds fails too, so a removed
literal takes its exemption with it. That second rule caught its author on the
first run — three of the eight ASQ codes live only in the Questionnaire JSON,
which this script does not scan, so those exemptions could never have expired.
Resource-side codes are `validate-fhir.mjs --tx`'s, and it has **no** allowlist
by design; that lag is recorded in `docs/scheduled-checks-triage.md` § *Cause 1b*
instead. A code that fails because it is *wrong* is #220 and belongs in a fix,
never here.

⚠️ **`tx.fhir.org` is not the authority — Regenstrief is, and there is a tool for
asking it.** `bash scripts/loinc-audit/loinc-audit.sh .` checks every LOINC coding
in every Questionnaire (76 today, ~20s) against `fhir.loinc.org`, which never lags
a release. It is deliberately **not** a gate: it needs a personal Regenstrief
account, so CI would mean one person's credential in Actions secrets. Run it when
you add codings and after a LOINC release. Its README carries the two traps that
made three earlier versions of it report confident nonsense, and the display trap
it exists for — a `display` must be LOINC's string, not the question wording, and
`item.text` deliberately differs from `item.code[].display` on every ASQ item.

Its floors are per source **and** per vocabulary family, and the guard loop reads
the declared floors rather than the family list — see the comment on `SCAN`. Both
directions of that contract are now enforced rather than requested: deleting a
family from `EXTERNAL_FAMILIES` leaves its floor behind and starves, and *adding*
one without a floor in every `SCAN` entry fails at startup. Declare a real zero
as `0`; never leave it out.

A floor asserts **liveness, not completeness** — "did this scan still look at
this vocabulary in this source" — so the convention is roughly half the real
count. That needs a deliberate re-check whenever a source grows, because nothing
re-checks it on its own: #43 doubled the manifest's SNOMED inventory from 10
codings to 20 while its floor sat at 5, dropping it to a quarter of the real
count with nothing going red (#232). Every run prints the live count beside each
floor, so any recent nightly log tells you where the ratios stand.

⚠️ **A floor only protects the source as a whole, so `SCAN` entries deliberately
overlap.** When one path holds two independent contributors, a whole-path floor
cannot tell them apart and losing either one stays green. #261 measured this:
reverting the data dictionary to its old un-gated shape dropped `web/src` LOINC
from 69 to 41, still clearing a floor of 34, while ~28 codings silently left the
scan. The fix is a second, narrower `SCAN` entry (`web/src/data/catalog`) that
overlaps the first — safe, because `found` is keyed by system|code|display and
`perSource` is tallied per entry. **When you add a substantial new source of
codings inside an already-scanned tree, give it its own entry** rather than
assuming the parent floor covers it.

⚠️ **The nightly has a named reader and a written triage path —
`docs/scheduled-checks-triage.md`.** A red run has two causes needing opposite
responses (real drift → fix the code; `tx.fhir.org` down → re-run), and it links
that doc from every issue it files. Note also that `schedule` runs only from the
default branch, and GitHub disables scheduled workflows after 60 days of repo
inactivity.

⚠️ **It is the only timer-driven workflow now.** `roadmap-snapshot.yml` was the
second, and it was deleted with the Roadmap page — the roadmap lives in GitHub
Issues, and mirroring it into a committed snapshot meant shipping 356KB of issue
bodies to the browser. If you are re-adding scheduled automation, its `ROADMAP_PR_TOKEN`
history is the thing worth reading first: the org forbids Actions from opening
PRs, so a workflow that opens one needs a PAT, and an expired PAT falls back to
`GITHUB_TOKEN` and silently returns to the hand-opened path.

