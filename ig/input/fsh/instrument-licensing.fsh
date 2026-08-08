// =============================================================
// Instrument licensing metadata (issue #127, under the #64 audit epic)
// =============================================================
// Every SPiER ActivityDefinition carries two licensing facts:
//
//   1. `copyright` (markdown) — the human-readable notice: who holds rights
//      to the underlying instrument, what an adopting system must do before
//      deploying it, and — critically — WHERE THAT CLAIM COMES FROM. Each
//      notice ends by naming its basis: a filed licensing-audit memo under
//      FHIR-Resources/<tool>/licensing/MEMO.md, or "as recorded on the SPiER
//      Questionnaire, not verified at source", or an explicit statement that
//      the status is unknown pending the #64 audit.
//
//   2. `instrument-licensing-status` (this extension) — the same fact in one
//      machine-readable code, so a consuming system can gate on it rather
//      than parse prose. web/src/data/catalog/tools.ts derives the catalog's
//      `Tool.licensing` field from it; before #127 that field was hand-typed
//      in tool-ui-metadata.ts with no link to any FHIR artifact.
//
// WHY AN EXTENSION AND NOT `copyrightLabel`. Issue #127 asks for
// `copyright` + `copyrightLabel`. `ActivityDefinition.copyrightLabel` is an
// R5 element; this IG is R4 (fhirVersion 4.0.1 in sushi-config.yaml), so the
// element does not exist here. A short free-text label would in any case be
// weaker than a bound code — the point of the field is that an adopter can
// FILTER on it. This extension is the R4 stand-in and does the copyrightLabel
// job better; if SPiER ever moves to R5, populate `copyrightLabel` from the
// code's display and keep the extension as the machine-readable half.
//
// THE NO-GUESSING RULE. #127 is explicit: where the #64 audit has not
// confirmed a tool's status, say so rather than invent terms. Nothing below
// asserts a licensing status that is not traceable to something already in
// this repository — a filed memo, or the copyright notice the corresponding
// Questionnaire in FHIR-Resources/ already carries. Where the recorded notice
// does not actually answer "what must an adopter do?" (the SBQ-R), the status
// is `unknown` and the copyright text says so in as many words. This is the
// same discipline issue #220 had to learn the expensive way: a plausible
// assertion that nothing verified is worse than an honest gap, because it
// reads as settled.
//
// STILL OWED. Every status here traces to something in this repository — a
// filed memo or a recorded Questionnaire notice — but NONE has been checked
// against what the rights holder publishes today. Four instruments (PHQ-9,
// SBQ-R, CAMS, Stanley-Brown) have no audit memo at all. The standing list of
// what is outstanding, and how to close an item, is
// docs/best-practices/licensing-verification-backlog.md. Do not upgrade a
// status to a more permissive code without doing the source check first.
// =============================================================


// ─── CodeSystem / ValueSet ───────────────────────────────────

CodeSystem: SPiERInstrumentLicensingStatusCodes
Id: spier-instrument-licensing-status
Title: "SPiER Instrument Licensing Status Codes"
Description: "What an adopting system must do before deploying the instrument or workflow step an ActivityDefinition describes."
* ^status = #draft
* ^experimental = true
* ^caseSensitive = true
* ^content = #complete

* #public-domain "Public domain / free use" "The instrument may be used, embedded and redistributed without permission or fee. Attribution may still be expected as a courtesy or by the audit memo."
* #registration "Registration or permission required" "Free of charge, but gated: the adopter must register with the rights holder, obtain written permission, and/or complete training before deploying it. Item wording is typically fixed."
* #commercial "Commercial license required" "A paid license, a purchased instrument, or a negotiated agreement with the rights holder is required. Reproducing the item content without that agreement is not permitted."
* #spier-authored "SPiER-authored — no third-party instrument" "The activity reproduces no third-party validated instrument. It is SPiER workflow content published with this Implementation Guide under the IG's own licence. Any instrument or content a site substitutes into the step carries its own terms."
* #unknown "Unknown — pending licensing audit" "The licensing status has not been established by the issue #64 audit. Terms must be confirmed with the rights holder before deployment. This is a deliberate marker of an open question, NOT a claim that use is unrestricted."


ValueSet: SPiERInstrumentLicensingStatus
Id: spier-instrument-licensing-status-vs
Title: "SPiER Instrument Licensing Status"
Description: "Licensing states a SPiER ActivityDefinition's underlying instrument can be in."
* ^status = #draft
* ^experimental = true
* include codes from system SPiERInstrumentLicensingStatusCodes


// ─── Extension ───────────────────────────────────────────────

Extension: InstrumentLicensingStatus
Id: instrument-licensing-status
Title: "Instrument Licensing Status"
Description: "Machine-readable licensing status of the instrument or workflow an ActivityDefinition describes. The R4 stand-in for R5's `copyrightLabel`, bound to a code so adopters can filter on it; the full notice lives in `ActivityDefinition.copyright`."
* ^status = #draft
* ^experimental = true
* ^context[+].type = #element
* ^context[=].expression = "ActivityDefinition"
* value[x] only code
* valueCode from SPiERInstrumentLicensingStatus (required)


// ─── RuleSets ────────────────────────────────────────────────
// Inserted into each ActivityDefinition. One RuleSet per distinct notice:
// tools that genuinely share a licensing position (the six CAMS session
// forms, the four C-SSRS versions, the workflow-only activities) share a
// RuleSet so the notice cannot drift between them.

RuleSet: LicensingSpiERAuthored
* extension[+].url = "http://spier.org/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #spier-authored
* copyright = "SPiER-authored workflow content. This activity reproduces no third-party validated instrument: it and the SPiER profiles and code systems it references are published with the SPiER Implementation Guide under the guide's own licence (CC0-1.0). No permission or fee is required to adopt it. Any locally-chosen instrument, script, letter template or vendor content a site substitutes into this step carries its own terms, which the site must confirm separately."

RuleSet: LicensingCAMS
* extension[+].url = "http://spier.org/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #commercial
* copyright = "The Collaborative Assessment and Management of Suicidality (CAMS) framework and the Suicide Status Form (SSF) are the work of David A. Jobes, PhD, distributed by CAMS-care, LLC and Guilford Press. CAMS is a **commercial instrument**: use requires appropriate training and a license from CAMS-care, and the SSF must not be reproduced without that agreement. This ActivityDefinition describes the workflow step; the SSF item content it points at is subject to that license. Basis: the notice recorded on the SPiER CAMS Questionnaires (FHIR-Resources/CAMS/). No licensing-audit memo is on file for CAMS under issue #64, so these terms have not been verified against CAMS-care's current published terms."

RuleSet: LicensingCSSRS
* extension[+].url = "http://spier.org/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #registration
* copyright = "© 2008 The Research Foundation for Mental Hygiene, Inc. Developed by Posner, K.; Brent, D.; Lucas, C.; Gould, M.; Stanley, B.; Brown, G.; Fisher, P.; Zelazny, J.; Burke, A.; Oquendo, M.; Mann, J. The C-SSRS is free to use but is copyrighted and permission-based: an adopting system must register through the Columbia Lighthouse Project (cssrs.columbia.edu), some administration contexts require training, item wording may not be altered, and this copyright notice must be retained on every version. Basis: FHIR-Resources/C-SSRS/licensing/MEMO.md (issue #64). Open item recorded there: confirmation that a FHIR representation is covered by a site's own registration is still to be filed."


// The remaining ActivityDefinitions each carry an instrument-specific notice
// inline, in the FSH file that defines them, so the notice sits next to the
// artifact a reader is looking at.
