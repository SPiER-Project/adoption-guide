# Stage 5 — Coordinate Handoffs: FHIR design

Design + encoding for the five Stage-5 tools, part of Wave 5 of the
[SSC stage-tiles rollout](ssc-stage-tiles-rollout.md).

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

**Known gap:** the demo recorder at `/patient/workflow/rapid-referral` still
emits a `Communication` (it shares the generic `WorkflowActionView`). The
catalog entry shows **both** — the ServiceRequest target and the Communication
the demo emits today — so the guide doesn't imply a capability the app lacks.
Migrating the recorder is a tracked follow-up.

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

## Scope of this PR

Definitional: profiles, terminology, ActivityDefinitions promoted out of
`pathway-tool-placeholders.fsh`, stage-PD outputs, catalog `recordingPattern`.

**Not included:** data-layer buckets and demo recorders for the four new
resource types. Stage 7 showed that adding resource types to `PatientSlice`,
the two data sources, and the registry is one shared piece of surgery — better
done once for the whole of Stages 5–6 than piecemeal per tool.

## Follow-ups

- Data layer + recorders for `DocumentReference` / `ServiceRequest` /
  `Appointment` / `Consent` (shared with Stage 6).
- Migrate the TL-017 recorder from Communication to ServiceRequest (§1).
- Stage 6 (Track Follow-Up), which reuses the Appointment above and the
  Communication/Task patterns already established.
