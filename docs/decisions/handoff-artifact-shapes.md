# Why the Stage-5 handoff artifacts have the shapes they do

**Decided:** 2026-08 (Stage 5, [`plans/stage-5-coordinate-handoffs.md`](../plans/stage-5-coordinate-handoffs.md)).
**Artifacts:** `SPiERDischargeSafetyPacket`, `SPiERInformationSharingConsent`,
the `handoff-content-item` / `handoff-withheld-item` extensions, all in
[`handoffs.fsh`](../../ig/input/fsh/handoffs.fsh).

## The discharge safety packet is a DocumentReference, not a Communication

The packet is an **artifact** that persists and can be re-retrieved, not a
one-time transmission. `content.attachment` is the packet itself;
`context.related` points at the live resources it was assembled from (the
safety-plan CarePlan, the risk Observation, the follow-up Appointment); and the
repeating `handoff-content-item` extensions record what was included even
where no discrete resource exists. A Communication would record that something
was sent and nothing about what the receiving side can open later.

## What the packet says about what it left out

Where the patient's sharing consent excluded something, the packet says so: the
withheld item and its basis ride as `handoff-withheld-item` extensions, and the
governing Consent is itself listed in `context.related`, so a reader can see
the preference that produced the omission. The withheld-item extension is the
counterpart to the content-item extension — together they let a packet state
both what it carries and what it does not, so a reader can distinguish a
respected patient preference from a missing section. It is contexted on
DocumentReference only: the handoff Communication has no assembly step to gate.

## The sharing consent uses native Consent structures

Whether suicide-safety information may be shared — with whom, for how long — is
modelled with the resource's own structures rather than SPiER-local codes:
`provision.type` permit/deny is the grant-or-decline decision (so "patient
declined" is a deny provision, not a separate status), `provision.actor` names
the recipient, `provision.period` carries any expiry, and nested deny
provisions carry the exclusions — `provision.provision.actor` a recipient the
patient excluded, `provision.provision.code` the content categories they
excluded, from the same handoff-content vocabulary the packet uses. Only the
category is SPiER-local, marking the record as governing suicide-safety
sharing. The record is not decorative: the discharge safety packet reads it
before asserting what it carries, and records anything it withheld.

## What would reopen it

A partner that can only receive a Communication-shaped handoff (the packet
could then be referenced from one); or a consent model that needs
segmentation finer than content categories, which is the DS4P territory
[`best-practices/consent-vs-ds4p.md`](../best-practices/consent-vs-ds4p.md)
describes.
