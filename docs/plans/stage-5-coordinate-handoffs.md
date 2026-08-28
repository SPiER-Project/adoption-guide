# Stage 5 — Coordinate Handoffs: FHIR design

Design + encoding for the five Stage-5 tools, part of Wave 5 of the
[SSC stage-tiles rollout](archive/ssc-stage-tiles-rollout.md).

Artifacts: [`ig/input/fsh/handoffs.fsh`](../../ig/input/fsh/handoffs.fsh).
Requirements source:
[`docs/reference/ssc-stage-tiles-question-set.md`](../reference/ssc-stage-tiles-question-set.md),
Stage Tile 5.

---

## Shape

Unlike Stage 7 — one episode with work hanging off it — these are genuinely
**distinct artifacts**. What unites them is one question: *when this patient
moves to the next provider, does the suicide-safety context move with them?*

| Tool | Resource | Why |
|---|---|---|
| **TL-009** Safety Handoff / Transition Checklist | `Communication` → `SPiERSafetyHandoff` | A transmission event: who received it, when, what travelled |
| **TL-030** Discharge Safety Packet | `DocumentReference` → `SPiERDischargeSafetyPacket` | A retrievable *artifact*, not a transmission |
| **TL-017** Referral / Next Provider Handoff | `ServiceRequest` → `SPiERSafetyReferral` | Must be trackable past "sent" to accepted/completed |
| **TL-031** Next Appointment | `Appointment` → `SPiERFollowUpAppointment` | Native scheduling + status lifecycle |
| **TL-032** Consent / Sharing Status | `Consent` → `SPiERInformationSharingConsent` | Native permit/deny provisions |

## Decisions worth reviewing

### 1. ServiceRequest for the referral, not Communication

The SSC asks whether the EHR can track that a referral was **"accepted or
completed"** (tool 3, question 5 — "Full status tracking" scores highest).
`ServiceRequest.status` models `draft → active → completed` (or `revoked`)
natively. A `Communication` only records that something was *sent*, so it
cannot answer the question the tile is scored on.

**Resolved.** The recorder now emits the ServiceRequest. It lives at
`/patient/workflow/referral` (`SafetyReferralView`) instead of sharing the
generic `WorkflowActionView`, and `/patient/workflow/rapid-referral` redirects
there so existing links keep working. Advancing a referral to `completed` or
`revoked` is an update to the **same** resource — the recorder reuses its id and
the store upserts — so a closed referral cannot still read as outstanding. That
round trip is the capability the SSC scores, and it is now demonstrable in the
app rather than described in the IG.

### 2. DocumentReference for the packet, not another Communication

TL-009 and TL-030 look similar but differ in kind. The handoff is an *event*
(it happened, at a time, to a recipient). The packet is an *object* that
persists and can be re-retrieved later — by the patient, or by the receiving
provider a week afterwards. `DocumentReference.content.attachment` is the
packet; `context.related` points at the live resources it was assembled from
(safety-plan CarePlan, risk Observation, follow-up Appointment), so the packet
doesn't become a stale copy divorced from the record.

### 3. One content vocabulary shared by TL-009 and TL-030

The SSC asks a near-identical "what is included?" multiselect for both tools.
Rather than two overlapping code sets that would drift, there is one
`spier-handoff-content` CodeSystem and one repeating `handoff-content-item`
extension, contexted on both `Communication` and `DocumentReference` (neither
has a native coded slot for "what was included").

### 4. The handoff profile is a deliberately low floor

`SPiERSafetyHandoff` requires only `status` / `subject` / `sent`, with the
content checklist optional. The existing demo recorder emits a plain
stage-tagged Communication; profiling it tightly would have made the app's own
output non-conformant to the IG it ships. The profile describes the floor and
leaves room for richer coded capture.

### 5. Consent uses native provisions — "declined" is not a status

The SSC lists "patient declined" among the capturable details. That is not a
separate status: it is a **deny provision**. So `provision.type` permit/deny is
the decision, `provision.actor` the recipient, `provision.period` the expiry —
and a nested deny provision expresses "share with the clinic, but not with this
named support person". Only `category` is SPiER-local, marking the record as
governing suicide-safety sharing. This keeps the resource interpretable by any
consent engine rather than only by SPiER.

### 6. Appointment status is what makes Stage 6 possible

`Appointment.status` already carries `booked → fulfilled | noshow | cancelled`.
That is precisely the signal the Stage-6 no-show follow-up (TL-035) needs, so
tracking appointments (TL-034) needs **no second resource type** — it reads the
same Appointment. Worth keeping in mind when Stage 6 is encoded.

## Implementation status

| Step | State |
|---|---|
| Profiles + terminology + ADs + stage-PD outputs + catalog | ✅ merged (#199) |
| Shared data layer + recorders (with Stage 6) | ✅ this PR |

The data layer was deliberately deferred out of #199 and #200 and done once
here, because adding resource types to `PatientSlice`, both data sources, and
the registry is one shared piece of surgery rather than four per-tool changes.

Delivered:

- **Data layer** — `documentReferences` / `serviceRequests` / `appointments` /
  `consents` buckets on `PatientSlice` (optional, like `communications`, so
  persisted slices and scenario JSON stay valid), routing in `localDataSource`
  and `smartDataSource`, activity-feed labels and date resolution in
  `registry.ts`.
- **`lib/handoffs.ts`** — the shared domain module (builders, lifecycle
  transitions, predicates) with 24 unit tests, so the rules are not
  re-implemented per view.
- **Four recorders** — discharge packet (TL-030), referral (TL-017), follow-up
  appointment (TL-031), sharing consent (TL-032). All reuse the existing
  `workflow-*` classes, so no new CSS.
- **Chart + registry surfacing** — the four types render as stage-grouped
  artifact cards, and the Population view gains a Follow-Up column.

### Three things the implementation forced

1. **`Appointment` has no patient element at all.** Not `subject`, not
   `patient` — the patient is a `participant.actor`. This is the same class of
   bug Stage 7 hit with `EpisodeOfCare.patient` / `Task.for`, but worse: there
   is no single field to substitute, so `smartDataSource` needed a
   `withPatientLink()` helper that rewrites the participant instead of setting a
   top-level element. `Consent` also uses `patient`, not `subject`.
2. **All four types are lifecycle resources, so writes upsert by id.** The
   Stage-7 finding generalizes further than expected: a referral moves to
   completed, an appointment to fulfilled/noshow, a consent is superseded. Only
   the *point-in-time* artifacts (Observation, CarePlan, Communication) append.
3. **A booked appointment is dated in the future.** `Appointment.start` for a
   follow-up is days ahead, and the registry's newest-wins "last activity" rule
   would have reported a visit that hadn't happened yet as the patient's most
   recent activity, pushing every real event off the row. A still-upcoming
   appointment is now dated by when it was *booked*.
4. **The consent recorder needed a `policyRule`.** The base Consent invariant
   `ppc-1` requires either a Policy or a PolicyRule, so without one every Consent
   the recorder wrote was invalid — a strict server would reject it. This only
   came to light because the IG Publisher run in #201 caught the *example*
   shipping invalid for the same reason. Worth remembering as a class of gap:
   SUSHI does not evaluate FHIRPath invariants, so `npm run verify` is green on
   resources that fail conformance. See
   [the publish-gate note](archive/ssc-stage-tiles-rollout.md) — the app-side builders
   have no invariant check at all, only the unit test added here.

## Follow-ups

- Stage 8 (Measure and Share) — the 7-/30-day follow-up measures compute over
  exactly these appointments. `attendedWithinDays()` in `lib/followUp.ts` is
  the definition they should reuse rather than restate.
- **TL-009 content checklist.** The handoff recorder still emits a plain
  stage-tagged Communication with no `handoff-content-item` extensions. That is
  conformant (the profile is a low floor by design) but under-uses the shared
  vocabulary the discharge packet now populates.
- ~~**Consent is recorded, not enforced.**~~ **Done** — issue #227, see below.

## The consent gate (issue #227)

The packet recorder now reads the TL-032 consent before asserting what the
packet carries. `applySharingConsent()` in `web/src/lib/handoffs.ts` is the
whole rule set; `DischargePacketView` only renders its answer.

**What made this more than plumbing** is that the TL-032 recorder could express
*who* was excluded but not *what*. A consent that can only say "deny everything"
gates nothing interesting — the demonstration worth having is a packet that
carries the safety plan and the crisis numbers while leaving out the assessment
detail the patient did not want forwarded. So the recorder gained
`deniedContentCodes`, written as a **second nested deny provision** carrying
`provision.code` from the same `spier-handoff-content` vocabulary the packet
uses. Two provisions rather than one combined: criteria within a provision are
ANDed, so actor + code together would say "deny this category *to this person*",
which is narrower than what the patient stated.

Three findings worth carrying forward:

1. **`Consent.provision.provision` cannot be profiled.** It is a
   `contentReference` back to `Consent.provision`, and a contentReference takes
   no constraints — so the nested slice where every exclusion actually lives is
   unbindable. The profile binds the root `provision.code` to document the
   vocabulary; what enforces it on nested provisions is TypeScript and its unit
   tests. Same shape of gap as the FHIRPath invariants above: the artifact
   cannot state the rule, so the rule has to be tested somewhere else.
2. **A permit naming one recipient is not a permit naming any recipient.** This
   surfaced only while exercising the finished UI: a consent permitting release
   to the receiving clinic was authorising release to a clinic nobody had
   mentioned, because the code checked deny provisions and stopped there. In
   FHIR, `provision.actor` *narrows* a provision. The `recipient-not-authorised`
   basis code exists because of that bug.
3. **Two defaults are choices, not consequences**, and both are visible in the
   UI rather than buried:
   - *No recipient ⇒ no gate.* A sharing consent governs disclosure to a third
     party. Withholding patients' own safety material because they declined to
     have it forwarded would invert what they asked for.
   - *No consent on file ⇒ withhold from a third party.* Silence is not
     permission. `no-consent-recorded` is a real basis code so an adopting site
     can see the default fired, rather than inferring permission from an empty
     result.

The `handoff-withheld-item` extension pairs the withheld content code with its
basis, and the governing Consent joins the packet's `context.related`.
DocumentReference has no element for "the authority this was released under",
and inventing one would claim more than the resource can back — so the recipient
stays an assembly-time input, and the Consent reference is what makes an
omission traceable.

`web/scripts/check-scenario-resources.mjs` learned to look *inside* complex
extensions for this (sub-extension cardinality and bindings); before that, a
withheld item with no basis, or a basis outside the vocabulary, passed the
offline gate. Both defects were planted and confirmed failing before the change
was trusted. Mei Lin (`patient-009`) carries the worked example in scenario
data: a consent permitting Harbor IOP while excluding the assessment detail, and
a packet that withheld it and says so.
