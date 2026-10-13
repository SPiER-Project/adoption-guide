# CAMS drivers are resolved at the Outcome/Disposition session

> ⚠️ **Not clinically reviewed. A clinician must review this rule before it is
> made available externally.** It was merged live by decision on 2026-10-12,
> so the hosted demo applies it in the meantime. That
> availability is a demo of the mechanism. It is not a claim that the rule is
> clinically right, and this record must not be cited as if it were.
>
> The review is tracked as
> [SPiER-Project/adoption-guide#675](https://github.com/SPiER-Project/adoption-guide/issues/675).

## The rule

CAMS Section B records up to three **suicide drivers**: the problems the
patient and clinician name as driving the suicidal thinking. Each is written to
the problem list as a `SPiERCAMSSuicideDriver` Condition, which the profile
says is tracked "until resolved at CAMS disposition".

When a **CAMS SSF-5 Outcome/Disposition** form is saved with disposition
**`resolved`** ("CAMS resolved — episode complete"), every **active** CAMS
driver on the patient's chart is updated in place:

- `clinicalStatus` becomes `resolved`;
- `abatementDateTime` is the disposition form's completion time;
- a note is appended saying the change was applied automatically and has not
  been clinically reviewed.

Any other disposition (`continue-cams`, `refer-adjunctive`,
`higher-level-care`) leaves the drivers active. Problems that are not CAMS
drivers, such as anything else on the EHR's problem list, are never touched.

The builder is `packages/core/src/lib/camsDriverResolution.ts`; the save hook in
`packages/app-shell` applies it after the disposition form is saved.

## Why it is shaped this way

- **Nothing resolved a driver before.** Once recorded, a driver read as active
  forever, so the problem list only grew.
- **The trigger is the clinician's own disposition.** The form asks whether
  resolution criteria are met (three consecutive sessions of overall risk ≤ 2,
  managing thoughts and feelings, behaviourally stable) and records the
  disposition. The app does not infer resolution from scores. That is the line
  #639 drew when it retired the Tier-3 proposal: a screen never becomes a
  Condition, and here a score never closes one.
- **All drivers at once, because the form records resolution for the
  episode.** It has no per-driver item.

## Open questions for the clinical reviewer

1. **Is resolving every driver at an episode's resolution right?** A clinician
   may judge one driver still live (for example chronic pain) when the episode
   meets resolution criteria. The alternative is per-driver items on the
   Outcome/Disposition form, which changes a published instrument form.
2. **Should other dispositions change a driver's status?** A step-up to a
   higher level of care, or an adjunctive referral, currently leaves drivers
   active. Should a step-up carry them to the receiving service unchanged, and
   should anything mark a driver `inactive` rather than `resolved`?
3. **Should the app write the status change at all, or only propose it?** Today
   the change follows from the clinician's disposition with no per-driver
   confirmation. A confirmation step ("these three drivers will be marked
   resolved") would make each resolution the clinician's explicit act.
4. **`resolved` versus `remission`.** FHIR offers both. CAMS speaks of
   resolution, but a suicide driver may be better described as in remission.

## What would reopen it

A clinical review that answers the questions above
([#675](https://github.com/SPiER-Project/adoption-guide/issues/675)). If the rule changes, add a
dated note at the top of this record rather than rewriting it (see the
[README](README.md)).
