/**
 * The resource types SPiER *mutates* rather than appends.
 *
 * An episode is opened then closed, a flag raised then cleared, a task created
 * then completed, a referral tracked through to completed, an appointment
 * resolved to fulfilled or noshow, an Encounter opened and later closed (#263).
 * POSTing each transition would leave the superseded version on the server, so a
 * closed episode would still read as open — hence `SmartDataSource.saveArtifact`
 * PUTs these with the client-supplied id (FHIR update-as-create) and POSTs
 * everything else.
 *
 * ⚠️ **Extracted into its own module because a second reader appeared, and a
 * hand-copied list of eight type names is exactly the drift `CLAUDE.md`
 * catalogues.** The mock EHR has to know which types arrive by PUT — it gates
 * writes on its capability profile, and gating PUT against the *create* list
 * refused every lifecycle write even under the `full` profile. That bug was
 * invisible until a browser submitted a real form: the panel's save aborted, and
 * the console blamed CORS.
 *
 * ⚠️ **This is not the writeback ladder.** The ladder (Tiers 0–3:
 * DocumentReference, QuestionnaireResponse, Observation, Condition) is what the
 * capability-degradation demo turns down. These are SPiER's own episode
 * bookkeeping, on a different axis, and the two lists overlap only at
 * `DocumentReference`. Conflating them is what produced the bug above.
 */
export const LIFECYCLE_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'EpisodeOfCare',
  'Flag',
  'Task',
  'DocumentReference',
  'ServiceRequest',
  'Appointment',
  'Consent',
  // #263: an Encounter is opened, gains its episode reference when one opens,
  // gains Appointment references as they are booked, and is closed.
  'Encounter',
])
