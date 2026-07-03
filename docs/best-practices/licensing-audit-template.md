# Tool Licensing Audit Memo — Template

> **Purpose.** A standardized per-tool memo documenting the licensing status of an underlying clinical instrument and any constraints on republishing the SPiER FHIR artifacts derived from it. One memo lives in each tool's `FHIR-Resources/<tool>/licensing/` directory.
>
> **Why this exists.** Before the SPiER FHIR Implementation Guide is publicly hosted at scale and before the repository transfers to the SPiER organization namespace, every built tool needs a clear licensing answer on file. Discovering a license constraint after public hosting is significantly more expensive than discovering it now. Tracked under epic [#64](https://github.com/SPiER-Project/adoption-guide/issues/64).
>
> **How to use.** Copy this file into `FHIR-Resources/<tool>/licensing/MEMO.md` and fill in each field. Mark unknown fields explicitly as `UNKNOWN — investigate` rather than leaving blank; the audit's purpose is to surface what we don't yet know.

---

## Tool

**Name:** `<full tool name>`
**Short name / abbreviation:** `<e.g. ASQ>`
**SPiER tool ID:** `TL-<NNN>`
**SPiER pathway stage(s):** `<flag-risk | clarify-risk | …>`
**Repository location:** `FHIR-Resources/<directory>/`
**Tracking issue:** `<#NN>`

## Instrument provenance

**Original author(s) / authoring institution:** `<institution or role; keep individual names abstract in public docs>`
**Year of original publication:** `<YYYY>`
**Canonical citation:** `<primary published reference>`
**Primary distribution source today:** `<URL or institutional source>`

## Licensing status

**Underlying instrument license:** `<one of: Public domain | Open / no fee required | Open with attribution requirement | Free for non-commercial use | Requires per-distribution license | Requires sign-off but otherwise unrestricted | UNKNOWN — investigate>`
**Source of license claim:** `<URL, document reference, or "verbal communication with originating institution on YYYY-MM-DD" — be precise>`
**License text on file:** `<filename within this licensing/ directory, or "not yet obtained">`

## Sign-off status

**Sign-off required to publish FHIR derivatives:** `<Yes | No | UNKNOWN>`
**Contact for sign-off:** `<role description; abstract in public docs>`
**Date sign-off requested:** `<YYYY-MM-DD or "not yet requested">`
**Date sign-off received:** `<YYYY-MM-DD or "pending">`
**Sign-off artifact on file:** `<filename, or "pending">`

## Conditions on redistribution

**Attribution required?** `<Yes — describe required form | No>`
**Modifications permitted?** `<Yes | Yes with notification | No | UNKNOWN>`
**Commercial use permitted?** `<Yes | No | UNKNOWN>`
**Other constraints:** `<e.g. "must preserve item wording verbatim", "must distribute alongside scoring guidance", "must not be excerpted">`

## FHIR artifact metadata reflection

How are the above conditions reflected in the published FHIR resources?

- `Questionnaire.copyright`: `<exact string, or "not yet set">`
- `Questionnaire.useContext`: `<any relevant context bindings, or "n/a">`
- IG page attribution block: `<reference to ig/input/pagecontent/<tool>.md section, or "not yet authored">`
- FSH source attribution: `<reference to ig/input/fsh/<tool>.fsh declaration, or "not yet authored">`

## Open questions

A bulleted list of things that need further investigation, e.g.:

- Whether the originating institution considers the FHIR derivative work a "modified version" of the instrument or a "representation."
- Whether translations or non-English adaptations carry their own licensing.
- Whether scoring algorithms are licensed separately from item text.

## Audit log

| Date | Reviewer (role) | Action / change |
|---|---|---|
| YYYY-MM-DD | Brief description of who reviewed and what was updated. | |

---

## Recommended directory layout for `FHIR-Resources/<tool>/licensing/`

```
licensing/
├── MEMO.md                       # The filled-in copy of this template.
├── LICENSE                       # Plain-text copy of the instrument license, if separately distributed.
├── permission-letter.pdf         # Signed permission letter from the originating institution, if obtained.
└── correspondence/               # Any prior email/contract correspondence relevant to permissioning.
```

Sensitive correspondence containing individual names or contract details should be kept in a private location and referenced from `MEMO.md` rather than committed to a public repository.
