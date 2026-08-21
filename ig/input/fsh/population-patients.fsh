// Population demo patients — the subject resources the scenarios reference.
//
// ⚠️ These 14 ids are referenced 116 times across
// `packages/demo-population/src/scenarios/patient-*.json` as `subject: Patient/patient-0NN`,
// and until this file existed EVERY ONE OF THEM DANGLED. A missing optional
// subject is not a validation error, so no gate saw it: the offline checker
// asserted each resource points at the RIGHT patient id, never that the id
// resolves to anything. `npm run check:scenarios` now closes that.
//
// ── Why the ids look like this ────────────────────────────────────────────
// `* id = "patient-0NN"` is load-bearing, not cosmetic. The Instance NAME is
// CamelCase per FSH convention, but the resource id must be exactly the string
// the scenarios reference, or the references still dangle. Renaming an id here
// silently re-breaks up to 21 references (patient-011's count) with nothing
// going red except the new gate.
//
// ── The MRN system, and why it is NOT an example.org URL ──────────────────
// `http://spier.org/identifier/mrn`. This file first used
// `http://hospital.example.org/mrn` — the system the app had always emitted —
// on the reasoning that `example.org` is the right domain for synthetic data.
//
// ⚠️ **That reasoning was wrong, and the HL7 validator says so:**
//   [error] Patient.identifier[0].system
//     → Example URLs are not allowed in this context (http://hospital.example.org/mrn)
// 14 errors, one per patient. An `identifier.system` names the namespace that
// assigns the id, so it must be resolvable in principle; "this is only a demo"
// is not a licence to put an example URL there. Synthetic *values* are fine —
// a synthetic *namespace* is not.
//
// The rename therefore covers all five app sites too (`populationToFhir` and the
// blank patient in `PatientProvider.tsx`, `MRN_SYSTEM` in `fhircast.ts` and its
// test, and `DEMO_PATIENT`), because `check:patients` scrapes the system out of
// the TypeScript: changing only one side fails the gate by design. Safe to
// rename because FHIRcast's context Patient travels only between SPiER tabs.
//
// ── Where the truth lives ─────────────────────────────────────────────────
// This file is CANONICAL for the 14 patients' demographics. `patients.json`
// keeps `id` + the hand-curated `recommendedNextStep`, and still carries display
// copies of name/dob/gender/mrn for the caseload table — which is duplication,
// so `npm run check:patients` asserts the two agree field by field. That is the
// same treatment `check:stages`, `check:fallback` and `check:catalog` give every
// other hand-duplicated value in this repo: gate it rather than pretend it is
// not duplicated.
//
// Deliberately NOT claimed: `us-core-patient`. See the note at the foot of this
// file — it is a real question, not an oversight.

Instance: PopulationPatient001
InstanceOf: Patient
Title: "Demo patient — Jane Doe"
Description: "Synthetic population patient patient-001. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-001.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-001"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "12345"
* name[0].use = #official
* name[0].given[0] = "Jane"
* name[0].family = "Doe"
* gender = #female
* birthDate = "1990-01-15"

Instance: PopulationPatient002
InstanceOf: Patient
Title: "Demo patient — Marcus Chen"
Description: "Synthetic population patient patient-002. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-002.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-002"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "23456"
* name[0].use = #official
* name[0].given[0] = "Marcus"
* name[0].family = "Chen"
* gender = #male
* birthDate = "1985-06-22"

Instance: PopulationPatient003
InstanceOf: Patient
Title: "Demo patient — Sarah Patel"
Description: "Synthetic population patient patient-003. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-003.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-003"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "34567"
* name[0].use = #official
* name[0].given[0] = "Sarah"
* name[0].family = "Patel"
* gender = #female
* birthDate = "1978-11-03"

Instance: PopulationPatient004
InstanceOf: Patient
Title: "Demo patient — Daniel Okafor"
Description: "Synthetic population patient patient-004. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-004.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-004"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "45678"
* name[0].use = #official
* name[0].given[0] = "Daniel"
* name[0].family = "Okafor"
* gender = #male
* birthDate = "1996-04-09"

Instance: PopulationPatient005
InstanceOf: Patient
Title: "Demo patient — Elena Rodriguez"
Description: "Synthetic population patient patient-005. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-005.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-005"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "56789"
* name[0].use = #official
* name[0].given[0] = "Elena"
* name[0].family = "Rodriguez"
* gender = #female
* birthDate = "1972-08-30"

Instance: PopulationPatient006
InstanceOf: Patient
Title: "Demo patient — Jamal Washington"
Description: "Synthetic population patient patient-006. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-006.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-006"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "67890"
* name[0].use = #official
* name[0].given[0] = "Jamal"
* name[0].family = "Washington"
* gender = #male
* birthDate = "1989-02-14"

Instance: PopulationPatient007
InstanceOf: Patient
Title: "Demo patient — Aisha Patel-Williams"
Description: "Synthetic population patient patient-007. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-007.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-007"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "78901"
* name[0].use = #official
* name[0].given[0] = "Aisha"
* name[0].family = "Patel-Williams"
* gender = #female
* birthDate = "2008-09-21"

Instance: PopulationPatient008
InstanceOf: Patient
Title: "Demo patient — Thomas Becker"
Description: "Synthetic population patient patient-008. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-008.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-008"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "89012"
* name[0].use = #official
* name[0].given[0] = "Thomas"
* name[0].family = "Becker"
* gender = #male
* birthDate = "1965-12-05"

Instance: PopulationPatient009
InstanceOf: Patient
Title: "Demo patient — Mei Lin"
Description: "Synthetic population patient patient-009. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-009.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-009"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "90123"
* name[0].use = #official
* name[0].given[0] = "Mei"
* name[0].family = "Lin"
* gender = #female
* birthDate = "1981-07-17"

Instance: PopulationPatient010
InstanceOf: Patient
Title: "Demo patient — Robert Hayes"
Description: "Synthetic population patient patient-010. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-010.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-010"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "01234"
* name[0].use = #official
* name[0].given[0] = "Robert"
* name[0].family = "Hayes"
* gender = #male
* birthDate = "1953-03-08"

Instance: PopulationPatient011
InstanceOf: Patient
Title: "Demo patient — Maria Alvarez"
Description: "Synthetic population patient patient-011. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-011.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-011"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "11011"
* name[0].use = #official
* name[0].given[0] = "Maria"
* name[0].family = "Alvarez"
* gender = #female
* birthDate = "1997-10-12"

Instance: PopulationPatient012
InstanceOf: Patient
Title: "Demo patient — Nia Barrett"
Description: "Synthetic population patient patient-012. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-012.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-012"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "11012"
* name[0].use = #official
* name[0].given[0] = "Nia"
* name[0].family = "Barrett"
* gender = #female
* birthDate = "1991-03-04"

Instance: PopulationPatient013
InstanceOf: Patient
Title: "Demo patient — Owen Delacroix"
Description: "Synthetic population patient patient-013. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-013.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-013"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "11013"
* name[0].use = #official
* name[0].given[0] = "Owen"
* name[0].family = "Delacroix"
* gender = #male
* birthDate = "1988-12-19"

Instance: PopulationPatient014
InstanceOf: Patient
Title: "Demo patient — Terrence Whitfield"
Description: "Synthetic population patient patient-014. Subject of the scenario artifacts in packages/demo-population/src/scenarios/patient-014.json. Demonstration data only — not a real person."
Usage: #example
* id = "patient-014"
* identifier[0].system = "http://spier.org/identifier/mrn"
* identifier[0].value = "11014"
* name[0].use = #official
* name[0].given[0] = "Terrence"
* name[0].family = "Whitfield"
* gender = #male
* birthDate = "1994-07-30"

// ── On us-core-patient ────────────────────────────────────────────────────
// These validate as base R4 `Patient`. Claiming
// `http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient` looks free —
// us-core 6.1.0 is already a dependency (sushi-config.yaml) and these carry
// identifier, name, gender and birthDate, which covers its required elements.
//
// It is deliberately not claimed yet, for one reason worth stating: US Core
// Patient must-supports race, ethnicity and birthSex, and inventing those values
// for 14 synthetic patients would be fabricating demographic data to satisfy a
// profile badge. #220 is this repo's precedent for what that costs — a plausible
// assertion nobody verified reads exactly like a verified one. If a partner needs
// the us-core claim, add the extensions deliberately and say where the values
// came from.
