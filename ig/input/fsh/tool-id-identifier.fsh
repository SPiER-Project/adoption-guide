// SPiER tool ids, published as ActivityDefinition.identifier.
//
// ─── What this is ────────────────────────────────────────────────────────────
//
// `TL-0NN` is SPiER's own id for a catalogued *tool* — one entry on a Suicide
// Safer Care stage tile. Every catalogued ActivityDefinition carries its tool
// id as an identifier in the system this file declares:
//
//     * identifier[+].system = "http://thespierproject.org/fhir/identifier/tool-id"
//     * identifier[=].value  = "TL-0NN"
//
// A tool id is NOT an ActivityDefinition id. The mapping is many-to-one on
// purpose: the CAMS SSF-5 is one catalogued tool (TL-020) whose four session
// forms are four ActivityDefinitions, all carrying the same identifier. That
// many-to-one shape is the existing catalog semantics, not something this
// identifier introduces.
//
// ─── Why the ids are published at all ────────────────────────────────────────
//
// They existed before this file, in two places that could not check each
// other: a hand-written `AD_TO_TOOL_ID` map in
// `packages/core/src/data/catalog/tools.ts`, and ~80 FSH comment lines. The IG
// published none of them, with two consequences. The IG narrative could not
// name a tool — an IG page saying "TL-017" named something no reader could
// resolve to an artifact, which is why those ids were stripped out of the
// rendered pages entirely. And the app's mapping was unchecked against the
// FSH: an ActivityDefinition could be renamed, or a tool id reassigned, and
// nothing compared the two.
//
// The identifier makes the id part of the artifact. `tools.ts` now derives it
// rather than restating it, and `npm run check:catalog` asserts the contract
// (exactly one tool-id identifier per catalogued AD, one tool id per tool, and
// every id in `tool-ui-metadata.ts` backed by an AD). The hand map is deleted
// rather than kept as a fallback — a fallback would hide the drift this closes.
//
// ─── Decision: yes, a NamingSystem ───────────────────────────────────────────
//
// The plan for this change (`docs/plans/docs-and-ig-content-consolidation.md`,
// task C2) asked whether the id system should itself be published as a
// NamingSystem, and to record the decision either way here. It is published,
// below, for two reasons:
//
//   1. Without it the system URL is a bare string appearing only inside
//      instances. A reader who finds `http://thespierproject.org/fhir/identifier/tool-id`
//      in an ActivityDefinition has nothing in the IG to resolve it against,
//      which is the same "names something unresolvable" problem the identifier
//      was added to fix, one level up.
//   2. It is where the *scope* of the id space belongs: that tool ids are
//      SPiER-local and non-clinical, that they are not stable across a
//      renumbering of the stage tiles, and that no external system should key
//      on them. Those are statements about the identifier system, and a
//      NamingSystem is the resource FHIR provides for making them.
//
// The system URL uses the IG's canonical base (`http://thespierproject.org/fhir`,
// settled in #425). The plan text proposed `http://spier.org/identifier/tool-id`,
// which predates that change and would have introduced a second base.
//
// ⚠️ `identifier` is NOT a `useContext` or a code — it is an id, so it gets no
// binding and no ValueSet. If you are looking for the pathway *stage* a tool
// belongs to, that is `PlanDefinition.useContext` inverted; see
// `pathway-stages.fsh`.

Instance: SPiERToolIdNamingSystem
InstanceOf: NamingSystem
Title: "SPiER Tool Id"
Description: "Identifier system for SPiER tool ids (TL-0NN) — SPiER's own id for one catalogued entry on a Suicide Safer Care stage tile, carried as an ActivityDefinition.identifier."
Usage: #definition
* name = "SPiERToolId"
* status = #draft
* kind = #identifier
* date = "2026-09-03"
* publisher = "SPiER"
* responsible = "SPiER"
* description = "Identifier system for SPiER tool ids. A tool id (`TL-0NN`) names one catalogued entry on a Suicide Safer Care stage tile, and is carried as an `identifier` on every ActivityDefinition that realises that tool. The mapping is many-to-one: a tool whose workflow spans several activities (the CAMS SSF-5, whose four session forms are four ActivityDefinitions) carries the same tool id on each. Tool ids are SPiER-local and non-clinical: they are not codes, they carry no binding, and no external system should key on them. They are stable within a release but not across a renumbering of the stage tiles — resolve a tool through its ActivityDefinition canonical URL if you need a durable reference."
* usage = "Assigned by SPiER. Populated on ActivityDefinition.identifier for every activity the SPiER tool catalog wires to a stage tile; validated in both directions by the repo's `check:catalog` gate."
* uniqueId[+].type = #uri
* uniqueId[=].value = "http://thespierproject.org/fhir/identifier/tool-id"
* uniqueId[=].preferred = true
