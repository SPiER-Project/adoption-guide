For a team building the [HIE Intermediary](CapabilityStatement-hie-intermediary.html)
role: a system that stores SPiER resources from one organization and serves
them to another. This page says what the guide requires of an intermediary,
what it gives you to work with, and what it does not yet specify.

SPiER defines resource shapes and what each role must keep intact. It does
not define an exchange protocol. Read the [last section](#not-specified)
before designing around this guide.

### What an intermediary must preserve {#preserve}

The rule is on [Conformance](conformance.html): an intermediary SHALL be
capable of storing and returning every Must-Support element it receives,
unchanged, and SHALL NOT drop a coding it does not recognize. Three things are
named because they are the easiest to lose:

- **`derivedFrom`** — the link from a result to what it was derived from.
- **Every `category`** — the SPiER `suicide-risk` domain category is how the
  whole record is found, alongside the standard clinical category.
- **`meta.profile`** — several results can only be told apart by profile.

The role's CapabilityStatement lists every profile a source can send, so an
intermediary can validate what it receives against the profile it claims.

### What to keep together {#keep-together}

Three chains of references run through the record. Forwarding one resource
without the rest of its chain leaves a reference the receiver cannot resolve.

| Chain | Runs through |
|---|---|
| **A result and its evidence** | [risk concept](StructureDefinition-spier-suicide-risk-concept.html) → `derivedFrom` → the instrument result → `derivedFrom` → the QuestionnaireResponse. The concept requires at least one `derivedFrom`. |
| **An episode** | each resource → `.encounter` → [Encounter](StructureDefinition-spier-encounter.html) → [Risk Episode](StructureDefinition-spier-suicide-risk-episode.html). [Quick Starts](quick-starts.html) has the queries. |
| **A transition** | a [Discharge Safety Packet](StructureDefinition-spier-discharge-safety-packet.html) → `context.related` → the resources it was assembled from, and the Consent that governed it. |

The risk concept is the smallest payload a receiver can act on without
knowing the instrument. It still carries `derivedFrom`, so sending it alone
sends a reference to a resource the receiver does not have.

### Telling results apart in a shared store {#shared-code}

Seven instrument results and the harmonized tier share LOINC `93374-7`. A
store that aggregates several sources holds all of them under one code. Do
not index or summarize on the code alone:
[Quick Starts](quick-starts.html#risk-tier) has the query that isolates the
tier, and [Known limitations](conformance.html#known-limitations) explains why.

### Consent {#consent}

[Information-Sharing Consent](StructureDefinition-spier-information-sharing-consent.html)
records whether suicide-safety information may be shared, with whom, and for
how long.

- The decision is `provision.type`: `permit` or `deny`. A declined share is a
  deny provision, not a status.
- `provision.actor` names the recipient and `provision.period` any expiry.
- Nested deny provisions exclude a named recipient, or a category of content
  from the [handoff content](CodeSystem-spier-handoff-content.html) list.
- The [worked example](Consent-ExampleInformationSharingConsent.html) permits
  sharing with a receiving team and denies one person and one category.

What the roles must do with it:

- An intermediary SHALL move the Consent with the data it governs. Forwarding
  the data without it leaves the receiver unable to honor a deny.
- A [Risk Consumer](CapabilityStatement-risk-consumer.html) SHALL read it
  before re-disclosing anything it received.

A source that withholds something says so. The discharge packet lists each
item it left out with a coded
[withholding basis](CodeSystem-spier-withholding-basis.html), including the
case where no consent is on file; the
[example packet](DocumentReference-ExampleDischargeSafetyPacket.html) shows
one withheld category. An intermediary SHOULD keep those entries, so the
receiver knows the record is incomplete on purpose.

### What this guide does not specify {#not-specified}

Each of these is open. An intermediary applies its own policy, and should not
read the guide's silence as either a requirement or a permission.

| Not specified | What that leaves to you |
|---|---|
| **Transport** | Whether data is pushed or queried, and what a bundle of it looks like. The CapabilityStatement lists RESTful interactions and an optional bulk export, and nothing more. |
| **Document-based exchange** | SPiER publishes no C-CDA mapping. Carrying an instrument's answers as discrete entries in a document is outside this guide. |
| **Which organization produced a resource** | No profile requires a source organization, and SPiER publishes no Provenance profile. In a store fed by several organizations, record the source yourself. |
| **References across systems** | Whether an intermediary keeps the source's ids, rewrites them, or carries the chain in one bundle. The chains above say what must stay resolvable, not how. |
| **Patient identity and duplicates** | No profile requires a business identifier. Matching a patient across organizations, and recognizing the same screen received twice, are yours to handle. |
| **Identifying a recipient** | The consent names a recipient in `provision.actor`, and the worked example does so by display text alone. How that is matched to a requesting organization is not defined. |
| **Privacy law and security labels** | SPiER defines no security labels and does not address 42 CFR Part 2 or state law. The consent profile records a patient's sharing decision; it is not a statement of what the law requires. |
