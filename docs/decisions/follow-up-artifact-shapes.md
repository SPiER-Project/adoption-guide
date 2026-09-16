# Why a caring contact and an outreach attempt are two profiles

**Decided:** 2026-08 (Stage 6, [`plans/stage-6-track-follow-up.md`](../plans/stage-6-track-follow-up.md)).
**Artifacts:** `SPiEROutreachAttempt`, `SPiERCaringContact`, the
`outreach-prompt` / `outreach-outcome` / `caring-contact-opt-out` extensions,
all in [`follow-up.fsh`](../../ig/input/fsh/follow-up.fsh).

## One outreach profile for two tools

`SPiEROutreachAttempt` serves both routine follow-up outreach and
missed-appointment / no-show follow-up — the artifact is the same, and the
`outreach-prompt` extension records which prompted it. `sent` is the attempt
time, `medium` the method, and the `outreach-outcome` extension the result,
because Communication has no native outcome element. A new safety concern is
flagged separately from the outcome because the two are orthogonal: an attempt
can reach the patient and surface a concern, or fail to reach them and surface
nothing.

## A caring contact is not an outreach attempt

A caring contact is a brief, non-demanding supportive message sent on a
schedule after an episode of risk — an evidence-based intervention in its own
right. It is kept distinct from the outreach attempt because it asks nothing of
the patient and has no outcome to record: what matters is that it was sent, by
what method, and whether the patient has opted out. The opt-out lives on the
contact resource because the Stage-8 adherence measure treats an opted-out
patient as a denominator exclusion, not a numerator failure
([`measure-design.md`](measure-design.md)).

## Why the caring-contact floor is low

The profile is deliberately a low floor so that the demo recorder's plain
Communication stays conformant. Raising it — a required `sent`, a required
medium — is a decision for when a partner system needs to depend on those
elements, not before.

## What would reopen it

A caring-contact program that does record patient replies (the "no outcome"
premise would then be false); or a partner that models both as one
Communication profile and needs a mapping.
