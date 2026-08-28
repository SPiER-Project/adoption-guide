# Stage 6 — Track Follow-Up: FHIR design

Design + encoding for the five Stage-6 tools, completing Wave 5 of the
[SSC stage-tiles rollout](archive/ssc-stage-tiles-rollout.md).

Artifacts: [`ig/input/fsh/follow-up.fsh`](../../ig/input/fsh/follow-up.fsh).
Requirements source:
[`docs/reference/ssc-stage-tiles-question-set.md`](../reference/ssc-stage-tiles-question-set.md),
Stage Tile 6.

---

## Five tools, two new profiles

Stage 6 is where the earlier stages pay off. Three of its five tools need **no
new resource type** — and the restraint is the design, not a shortcut.

| Tool | Resource | New? |
|---|---|---|
| **TL-033** Follow-Up Outreach / Contact Attempts | `SPiEROutreachAttempt` (Communication) | ✅ new |
| **TL-010** Caring Contacts | `SPiERCaringContact` (Communication) | ✅ new |
| **TL-034** Follow-Up Appointment Tracking | `SPiERFollowUpAppointment` | ♻️ reuses TL-031 |
| **TL-035** Missed Appointment / No-Show Follow-Up | `SPiEROutreachAttempt` | ♻️ reuses TL-033 |
| **TL-036** Follow-Up Escalation | `SPiERSafetyTask` | ♻️ reuses TL-041 |

### Why each reuse is real

**TL-034 — tracking is a read, not a write.** Every detail the SSC asks for
(scheduled, date/time, attended, cancelled, no-show, rescheduled, completed
within 7 / 30 days) is already carried by `Appointment.status` and
`Appointment.start` on the appointment TL-031 created at handoff. Minting a
parallel "appointment tracking" resource would create a second copy to keep in
sync with the first — a guaranteed drift source. The 7-/30-day figures are
Stage-8 measures computed over these appointments.

**TL-035 — a no-show follow-up *is* an outreach attempt.** Same artifact, same
outcome vocabulary; the only difference is what prompted it, which the
`outreach-prompt` extension records. The SSC's remaining no-show details
compose from resources that already exist: "follow-up rescheduled" is a new
Appointment, "escalation needed" is a SafetyTask.

**TL-036 — escalation should converge, not fork.** Stage 7 already models
escalation as a `SPiERSafetyTask` with repeating triggers, and its vocabulary
already covered missed-follow-up, missed-appointment, unable-to-reach,
high-risk-status, and manual escalation. Stage 6 needed three more (new safety
concern, missed outreach window, failed contact sequence), so those were added
to the **same** CodeSystem. The payoff: a case escalated because follow-up
failed and one escalated from the risk registry land in the **same work queue**,
which is the whole point of having a work queue.

## Decisions worth reviewing

### 1. Caring contacts are not outreach attempts

Both are Communications, so collapsing them is tempting — and wrong. An
outreach attempt *asks something* of the patient, so "did we reach them?" is
its defining field. A caring contact is a brief, non-demanding supportive
message that asks nothing; it has no reached/unreached outcome, and recording
one would invite staff to treat a caring contact as a failed contact. Their SSC
detail lists differ accordingly: outreach captures outcomes, caring contacts
capture enrollment, schedule, and **opt-out**.

The pre-existing catalog entry for TL-010 described it as "each outreach
attempt (caring contact)" — that conflation is corrected here.

### 2. Outcome is an extension, because Communication has none

`Communication.status` says whether a message was *sent*. It cannot say whether
anyone answered. The `outreach-outcome` extension carries that, and is `1..1`
on the profile — an outreach attempt with no recorded outcome is not useful
data.

### 3. "Safety concern identified" is a separate axis from outcome

The SSC lists it alongside the outcomes, but folding it in would lose
information: a concern can surface on a *successfully reached* call, and
"unable to reach" can itself *be* the concern. So it is its own boolean
extension rather than an outcome code.

### 4. Both new profiles are low floors

`SPiERCaringContact` requires only `status` / `subject` / `sent`. The existing
recorder at `/patient/workflow/caring-contact` emits a plain stage-tagged
Communication, and profiling tightly would make the app non-conformant to its
own IG — the same call made for the Stage-5 handoff.

## Scope

Definitional: profiles, terminology, ADs promoted out of
`pathway-tool-placeholders.fsh`, stage-PD outputs, catalog `recordingPattern`.

With this, the placeholders for **Stages 5, 6, and 7 are fully drained**. What
remains in `pathway-tool-placeholders.fsh` is TL-026 (generalized workflow
trigger), TL-028 (CARS-S — licensing NO-GO), TL-029 (site-defined local tool),
and the four Stage-8 tools of Wave 6 — *since drained too, see
[stage-8-measure-and-share.md](archive/stage-8-measure-and-share.md).*

## Implementation status

| Step | State |
|---|---|
| Profiles + terminology + ADs + stage-PD outputs + catalog | ✅ merged (#200) |
| Recorders + tracking, on the shared Stage-5/6 data layer | ✅ this PR |

The reuse claimed above held up in code — the implementation added **one**
builder, not five:

- **TL-033 / TL-035 — one recorder** at `/patient/workflow/outreach`
  (`OutreachAttemptView`). The outcome is a required extension because
  `Communication.status` only says a message was sent; "safety concern
  identified" stays a separate boolean axis. When the patient's latest
  appointment was a no-show the prompt pre-sets to `no-show`, which is the whole
  of the TL-035 difference.
- **TL-034 — no new resource, as designed.** `deriveAppointmentTracking()` reads
  the Stage-5 Appointments; attended / no-show / cancelled / next-visit all come
  off `Appointment.status` and `.start`. It shares a page with TL-031, where the
  status buttons resolve the *same* appointment in place.
- **TL-036 — the Stage-7 recorder, unchanged.** Escalations from failing
  follow-up land in the existing `SafetyTaskView` and so in the same work queue.
  This surfaced real drift: the three triggers Stage 6 added to the
  `spier-escalation-trigger` CodeSystem (new safety concern, missed outreach
  window, failed contact sequence) were missing from the app's copy of the code
  list, so they were unreachable in the UI. Added, and the outreach recorder now
  points at escalation once two consecutive attempts fail to reach the patient —
  the `failed-contact-sequence` trigger, computed rather than left to staff to
  count.

`lib/followUp.ts` holds the shared logic with 22 unit tests. See the
[Stage 5 doc](stage-5-coordinate-handoffs.md) for the data-layer surgery and the
three FHIR gotchas it turned up.

## Follow-ups

- ~~Shared data layer + recorders for the Stage-5/6 resource types~~ and
  ~~migrate the TL-017 referral recorder to ServiceRequest~~ — **done**; see the
  [Stage 5 doc](stage-5-coordinate-handoffs.md) for the surgery and the three
  FHIR gotchas it turned up.
- **Caring contacts (TL-010) still use the generic recorder**, so the
  `caring-contact-opt-out` extension is never written — and opt-out is what
  stops the schedule. Conformant (the profile is a low floor) but incomplete,
  and now load-bearing: the Stage-8 measures rely on that extension to treat an
  opt-out as a denominator *exclusion* rather than a scored failure, so until a
  recorder writes it the exclusion can never fire.
- **Nothing schedules the cadence.** Outreach and caring contacts are recorded
  when a human opens the form; the 24–48h / 7-day / 30-day schedule that should
  *generate* due work isn't modelled. TL-039's Task cadence is the closest
  existing machinery.
- ~~Wave 6 — Measure and Share: `Measure` / `MeasureReport` over exactly the
  appointments, outreach attempts, and episodes these stages produce.~~ **Done**
  (definitional layer) — see [stage-8-measure-and-share.md](archive/stage-8-measure-and-share.md).
  Two Stage-6 calls got tested there and held: the 7-/30-day measures read
  `Appointment.status = fulfilled`, vindicating TL-034 producing no resource of
  its own; and the caring-contact opt-out extension is what lets an opt-out be a
  denominator *exclusion* rather than a scored failure. When the measure engine
  is built, reuse `attendedWithinDays()` in `lib/followUp.ts` — it already
  defines that 7-/30-day window shape rather than restating it.
