// Instrument licensing metadata
//
// Every SPiER ActivityDefinition carries two licensing facts: a `copyright`
// notice in prose, and this extension carrying the same fact as one filterable
// code. The catalog's licensing field is DERIVED from the extension, so the
// guide cannot state a position no artifact backs.
//
// design-decisions.md carries the reasoning — why an extension rather than R5's
// `copyrightLabel`, why #unknown is a positive statement rather than a synonym
// for unrestricted, and the limits an adopter must work within.
//
// ⚠️ TWO RULES, here because this is the file where they would be broken:
//   1. A status must trace to something already in this repo — a filed
//      FHIR-Resources/<tool>/licensing/MEMO.md, or the notice the Questionnaire
//      carries. If the notice does not answer "what must an adopter do?" (the
//      SBQ-R), the status is #unknown and the copyright says so. A plausible
//      assertion nothing verified reads as settled — what issue #220 cost.
//   2. Never upgrade to a more permissive code without checking the rights
//      holder's CURRENT terms. None here has been.
//      docs/best-practices/licensing-verification-backlog.md is the standing list.

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


// One RuleSet per distinct notice, so tools that genuinely share a licensing
// position (the CAMS session forms, the C-SSRS versions, the workflow-only
// activities) cannot drift apart. Instrument-specific notices sit inline in the
// FSH file defining that ActivityDefinition, next to the artifact.

RuleSet: LicensingSpiERAuthored
* extension[+].url = "http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #spier-authored
* copyright = "SPiER-authored workflow content. This activity reproduces no third-party validated instrument: it and the SPiER profiles and code systems it references are published with the SPiER Implementation Guide under the guide's own licence (CC0-1.0). No permission or fee is required to adopt it. Any locally-chosen instrument, script, letter template or vendor content a site substitutes into this step carries its own terms, which the site must confirm separately."

RuleSet: LicensingCAMS
* extension[+].url = "http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #commercial
* copyright = "The Collaborative Assessment and Management of Suicidality (CAMS) framework and the Suicide Status Form (SSF) are the work of David A. Jobes, PhD, distributed by CAMS-care, LLC and Guilford Press. CAMS is a **commercial instrument**: use requires appropriate training and a license from CAMS-care, and the SSF must not be reproduced without that agreement. This ActivityDefinition describes the workflow step; the SSF item content it points at is subject to that license. Basis: the notice recorded on the SPiER CAMS Questionnaires (FHIR-Resources/CAMS/). No licensing-audit memo is on file for CAMS under issue #64, so these terms have not been verified against CAMS-care's current published terms."

RuleSet: LicensingCSSRS
* extension[+].url = "http://thespierproject.org/fhir/StructureDefinition/instrument-licensing-status"
* extension[=].valueCode = #registration
* copyright = "© 2008 The Research Foundation for Mental Hygiene, Inc. Developed by Posner, K.; Brent, D.; Lucas, C.; Gould, M.; Stanley, B.; Brown, G.; Fisher, P.; Zelazny, J.; Burke, A.; Oquendo, M.; Mann, J. The C-SSRS is free to use but is copyrighted and permission-based: an adopting system must register through the Columbia Lighthouse Project (cssrs.columbia.edu), some administration contexts require training, item wording may not be altered, and this copyright notice must be retained on every version. Basis: FHIR-Resources/C-SSRS/licensing/MEMO.md (issue #64). Open item recorded there: confirmation that a FHIR representation is covered by a site's own registration is still to be filed."



