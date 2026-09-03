# Demo script — SPiER launched inside a (mock) EHR

A one-page walkthrough of the hosted demo: a stand-in vendor EHR at
<https://spier-mock-ehr.bbthorson.workers.dev> with SPiER launched into a
patient's chart over a real SMART on FHIR handshake. About ten minutes end to end.

This describes the pages as they read after
[#461](https://github.com/SPiER-Project/adoption-guide/pull/461) (host pages) and
[#462](https://github.com/SPiER-Project/adoption-guide/pull/462) (the panel). The
*why* behind every page is in
[`services/mock-ehr/README.md`](../services/mock-ehr/README.md); this document is
only the *what to click*.

## Who you are

A clinician in a vendor EHR who has a SPiER button on the chart. You never leave
the EHR. Everything in the **slate** chrome is the host; everything in the
**panel on the right** is SPiER. That colour boundary is the demo's subject —
which pixels belong to whom — so point at it once, early.

## Before you start

- Use a **fresh browser tab** for the front door. After a launch, the same tab's
  caseload widget is scoped to the one patient you launched (the SMART session
  lives in that tab), and it will say so; it is not broken.
- If someone ran the demo before you, open **Settings → Reset written data** so
  the write log starts at "Nothing written yet." Reset leaves the capability
  profile alone; check it reads **full**.

## The ten minutes

The workflow this demo walks is the one the Care Pathway page publishes:
**PHQ-9 → item 9 positive → C-SSRS Screener with Triage Points → the
obligations of the derived tier.** Every other instrument stays available, but
the cards lead with these two.

### 1. The front door (1 min)

Open <https://spier-mock-ehr.bbthorson.workers.dev>. Read the first paragraph
aloud if you like — it is the whole instruction: *open a chart, press Launch
SPiER.* **Start here** offers three charts. Say which you are opening and why:

| Chart | Situation | Use it to show |
|---|---|---|
| **Marcus Chen** | Nothing on file | The whole PHQ-9 → C-SSRS handoff from zero, and the write landing |
| **Sarah Patel** | PHQ-9 item 9 endorsed, risk not clarified | A patient one step in, with the C-SSRS Screener owed |
| **Maria Alvarez** | Complete ED episode | What a finished pathway looks like |

The patient table below has all fourteen, each with a one-line story. The
caseload widget under that is SPiER embedded as a hosted activity; say once
that it is **not** a SMART launch (the drawer at the bottom says why) and move on.

### 2. Marcus Chen — PHQ-9 to C-SSRS from zero (5 min)

1. Open his chart. Point at the host banner (drawn by the EHR) and the launch
   card under it. Read the card: it says what pressing the button does.
2. **Launch SPiER.** The panel docks on the right; the SPiER bar above it says
   *Everything below this bar is drawn by SPiER.* Authorization is automatic
   (a clinician launching from a chart does not re-consent per launch).
3. The panel lands on his chart: **Step 1 of 8**, one recommendation,
   *Next step: Identify Possible Risk*, with **Launch PHQ-9** first among the
   screeners. Say: *SPiER has read his chart from the EHR and found no screen.
   The pathway names the PHQ-9 as the screen it demonstrates, so it leads.*
4. Press **Launch PHQ-9**. Answer the questions; on item 9 pick anything above
   **Not at all**. **Submit.**
5. The result shows *PHQ-9 Item 9 positive* and one button: **Start C-SSRS
   Screener →**. Say: *that is the pathway's gate — a positive item 9 leads to
   the assessment, not to another screen.* Press it.
6. Answer the six C-SSRS questions (answer **Yes** to Q2 or Q3 for a moderate
   tier, Q4 or Q5 for high) and **Submit**. The result names the derived tier
   and offers **Start Safety Plan** at moderate and high — the obligation that
   tier carries.
7. Press **View in chart**. Two things to point at: the rail has moved to
   **Define the Risk Picture** with steps 1 and 2 complete, and the top of the
   chart shows **Saved to the EHR** — which of the things SPiER tried to save
   actually landed (each completed form, its scores and risk level, a readable
   copy, and the opt-in problem-list proposal, which is off by design).
8. Back on the host page, open **Under the hood → Written to this chart**. It
   lists what landed by type — two QuestionnaireResponses, their Observations
   and the DocumentReference copies — within a few seconds of the submit. Say:
   *the panel reporting on itself and the server reporting on the same event
   are two statements, and only two make it checkable.*

### 3. Sarah Patel — one step in (2 min)

Open her chart and launch. The host page already shows the card SPiER's
decision-support service returned — *Next step: Clarify Risk*, whose text names
the PHQ-9 item 9 result and whose first button is **Launch C-SSRS Screener**. In
the panel: **Step 2 of 8 — Clarify Risk**, with the PHQ-9 recorded under step 1
and the same card on step 2. Say: *the EHR and the panel got the same answer
from the same rules.* Launch the screener from either card, submit, and watch
the rail advance exactly as it did for Marcus.

### 4. The capability ladder (2 min, optional)

What SPiER does when the EHR cannot accept everything.

1. In a **second tab**, open **Settings → Capability profile → no-observation**.
2. Back on Marcus's chart, close the panel (×) and **Launch SPiER** again.
   Submit another screen.
3. **Saved to the EHR** now shows *Its scores and risk level — Not written:
   Server does not support create*, while the form and the readable copy still
   landed. Say: *an incomplete ladder is shown on purpose. It is the readiness
   signal for an adoption conversation.*
4. Put the profile back to **full**.

### 5. Maria Alvarez — a finished episode (1 min)

Open her chart and launch. **All 8 stages passed**; every stage is complete and
each opens to show what was recorded there. Two things to point at:

- Completed stages carrying a recommendation are labelled **Guidance**, not
  *Do now* — the problem-list card on *Define the Risk Picture* is an example.
  Press **Show more** on it once: SNOMED CT and ICD-10-CM codes, verified, with
  the statement that SPiER surfaces them and never writes them.
- Under the rail, **Episode record**, **Scenario walkthrough** and **Patient
  Documents** are collapsed with their counts. Open Episode record: 17
  artifacts across 4 contacts, assembled by following FHIR references.

### 6. Shared context (1 min, optional)

On any chart, **Under the hood → Shared context (FHIRcast)**. Pick another
patient and press **Announce patient-open**. The panel notices the context
change and says it *cannot* follow — its token is bound to the patient it was
launched for. That is the correct behaviour, and worth saying out loud: a
patient-scoped launch stays patient-scoped.

## What this does and does not prove

Say this before anyone asks. It is also on every page, in the drawer at the
bottom.

- **Proves:** SPiER can be launched into a chart by a host it does not share an
  origin with, over a real SMART authorization-code flow with PKCE; it reads
  the patient's data from the host's FHIR API and writes back what the host
  advertises it can accept; the host's write log corroborates the panel's
  scorecard.
- **Does not prove interoperability.** The mock EHR is controlled by the same
  project it demonstrates. The portability claim is made separately, by loading
  the same resources into a public sandbox SPiER does not control (see
  [`smart-sandbox-testing.md`](smart-sandbox-testing.md)).
- **Does not prove SMART scopes.** Scopes are echoed, not enforced. The
  patient binding *is* enforced (a token for one patient cannot read another),
  which is the one thing the FHIRcast step relies on.
- **The caseload widget on the front door is not a SMART launch** and shows
  SPiER's bundled demo registry, not the server's data.

## If something looks wrong

| Symptom | Cause | Do |
|---|---|---|
| Panel shows *Redirecting to EHR…* and stops | The panel's `frame-ancestors` does not name this host, or the redirect URI is unregistered | Both are configured on the deployed Workers; locally, see *Local dev* in the mock EHR README |
| Front-door widget shows one patient | Same tab as an earlier launch | Open the front door in a fresh tab |
| Write log says *Could not read the write log* | `DEMO_STORE` binding missing | Deployment issue, not a demo step; the panel's scorecard still works |
| Scorecard says *Could not read this server's CapabilityStatement* | `/fhir/metadata` unreachable | Reload the chart; the skipped tiers mean "not advertised", not "refused" |
