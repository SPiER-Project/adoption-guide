# Draft email — Suicide Care Dashboard questions

> **Status: DRAFT, not sent.** Outbound message to the SPiER project lead
> following the *Suicide Care Dashboard* deck (received 2026-08-11). Review and
> send from a real mail client — this file is the wording, not a record of
> anything sent.
>
> Context: [`docs/reference/suicide-care-dashboard-spec.md`](../reference/suicide-care-dashboard-spec.md)
> (the deck transcribed, including all 8 open questions) and
> [`docs/plans/suicide-care-dashboard.md`](../plans/suicide-care-dashboard.md)
> (gap analysis and phasing). Tracked as epic
> [#277](https://github.com/SPiER-Project/adoption-guide/issues/277).
>
> **Update this file if the questions are answered another way** (call, Slack) —
> a stale draft asking questions that have since been settled is worse than no
> draft. The answers themselves belong in the spec doc, not here.

---

**Subject:** Suicide Care Dashboard — one code to fix, and a few questions before we build

Hi Kelly,

I worked through the Suicide Care Dashboard deck in detail and mapped it against
what SPiER has encoded today. Short version: it lines up better than I expected.
Most of the twelve panels turn out to be different views of data the registry
already computes, so a good share of this is a presentation problem rather than
new modeling. I've written it up as a spec plus an implementation plan, and the
first two phases are queued.

**One correction to the deck**

Slide 13 cites `Z91.82` among the suicide-related diagnosis codes. In ICD-10-CM
that code is "personal history of military deployment" — I think the one you want
is `Z91.51`, "personal history of suicidal behavior." Worth noting too that
`Z91.5` on its own isn't billable; it splits into `Z91.51` for suicidal behavior
and `Z91.52` for nonsuicidal self-harm. `R45.851` is correct as written.

I'm flagging it because slide 13 is the slide vendors will build from, and this is
the kind of error nothing catches automatically — the code is real and validates
cleanly, it just means something else. We hit the same pattern earlier this year
with a LOINC code that passed every check while pointing at the wrong concept.
Nothing on our side needs to change, since we code these in SNOMED CT, but worth
fixing in the deck before it travels further.

**Three questions only you can answer**

These are about the care model itself, not implementation preference:

1. Slide 4 lists "Safety Plan Completed" and "Stanley Brown Safety Plan
   Completed" as separate gauges. What's the first one — a site-specific safety
   plan document, or something like a Crisis Response Plan?
2. What is the "Emotional Fire Safety Plan" (slide 4, and data element 8)? I
   couldn't match it to an instrument I know.
3. The deck gives reassessment intervals by tier (7 / 14 / 30 days) but no
   interval for safety-plan review — even though "Safety Plans Needing Update,"
   "Safety Plan due for review," and "review dates" all depend on one. Same
   cadence as reassessment, one fixed interval, or reviewed whenever the tier
   changes?

**Four more that are probably better on a call**

These are judgment calls where your read matters more than mine:

- Is "Historical Risk" a fifth tier, or a separate lifetime-history flag? My
  instinct is the latter — someone with a past attempt and no current ideation is
  genuinely low current risk, and collapsing the two into one scale loses exactly
  what makes them worth an annual review.
- Your tiers stop at High; we carry a level above it for imminent risk. Does that
  route out of the registry to the ED in this model, or fold into High?
- How hard is the consultant approval before a risk reduction — something the
  dashboard reports on, or a hard stop that prevents the step-down from being
  recorded at all?
- Slides 5 and 6 give slightly different cadences for low-risk patients (every 30
  days vs monthly). One schedule or two?

None of this is blocking — I scoped the first two phases specifically so they
don't depend on any of these answers. What the answers unblock is the
pathway-compliance panel and the two phases after that.

One thing worth saying: the role structure in the deck — care manager,
psychiatric consultant, PCP — is something SPiER hasn't modeled at all, and after
going through this it's the clearest gap on our side. Three of your twelve panels
can't really exist without it. That's now the largest single item on our list.

Thanks — this was a genuinely useful document to work from.

Brad

---

## Notes on the draft

Kept deliberately short, and structured so the three factual questions are
answerable in a two-line reply. Seven questions in one email usually gets zero
answers, which is why the four design calls are offered as a conversation
instead.

The correction leads but stays blame-free: "nothing catches this automatically"
is both true and the reason this isn't carelessness. The
[#220](https://github.com/SPiER-Project/adoption-guide/issues/220) precedent is
referenced without issue numbers, since the recipient reads decks, not the repo.

Repo links are omitted on purpose — add them only if the recipient reads GitHub;
otherwise the two docs are more useful as an attachment or a summary.

The closing paragraph concedes the role-model gap on purpose. It is the most
substantive thing to say back to someone who sent a spec: naming what their
document surfaced that we had missed.
