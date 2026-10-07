# The 14 demo Patients

The subject resources every scenario references. Hand-authored FHIR R4 `Patient`
JSON — **not generated**, and no longer part of the IG.

## Why they are not in the IG any more

They were `ig/input/fsh/population-patients.fsh` until step E2
([#392](https://github.com/SPiER-Project/adoption-guide/issues/392)). #356 minted
them there to stop 116 dangling `subject` references, which was a **validation**
need rather than a specification one — and measured before the move,
**not one example instance in the IG referenced them.** The only mentions in FSH
outside that file were comments.

So the IG was publishing 14 examples that illustrated none of its own profiles,
while the mock EHR's patient roster depended on a SUSHI compile — a strange
dependency for a fake EHR, and the §9.3 objection this closes.

## ⚠️ The ids are load-bearing

The filename and `id` must stay exactly `patient-0NN`: the scenarios reference
them **116 times** as `subject: Patient/patient-0NN`, and a missing optional
subject is not a validation error, so a rename dangles references without any
gate going red on the reference itself. `check:scenarios` check 8 is what closes
that, and it fails when it can resolve no Patients at all rather than passing
vacuously.

## ⚠️ The MRN system is deliberately not an example.org URL

`http://thespierproject.org/fhir/identifier/mrn`. This started as
`http://hospital.example.org/mrn`, on the reasoning that `example.org` is right
for synthetic data. The HL7 validator disagreed, 14 times:

```
[error] Patient.identifier[0].system
  → Example URLs are not allowed in this context (http://hospital.example.org/mrn)
```

An `identifier.system` names the namespace that assigns the id, so it must be
resolvable in principle. Synthetic *values* are fine; a synthetic *namespace* is
not. `check:patients` scrapes the system out of `PatientProvider.tsx`, so changing
one side fails by design.

## Where the truth lives

**These files are the only copy of the 14 patients' demographics.** The
caseload table's rows are derived from them at import (`../patients.ts`); the
one hand-curated field, the recommended next step, is in `../next-steps.json`,
keyed by patient id. A Patient missing a name, birth date, gender or an MRN under
the app's system fails the import, and `npm run check:patients`.

## On `us-core-patient`, deliberately not claimed

These validate as base R4 `Patient`. Claiming
`us-core-patient` looks free — us-core 6.1.0 is already an IG dependency and
these carry identifier, name, gender and birthDate.

It is not claimed, for one reason worth stating: US Core Patient must-supports
race, ethnicity and birthSex, and inventing those for 14 synthetic patients would
be fabricating demographic data to satisfy a profile badge. #220 is this repo's
precedent for what that costs — a plausible assertion nobody verified reads
exactly like a verified one. If a partner needs the claim, add the extensions
deliberately and say where the values came from.
