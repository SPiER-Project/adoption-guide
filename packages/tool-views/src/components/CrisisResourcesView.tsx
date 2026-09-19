import { useMemo, useState } from 'react'
import { usePatient } from '../context/PatientContext'
import { makeId } from '@spier/core/lib/id'
import {
  buildCrisisResourcesShared,
  crisisResourceCodes,
  crisisResourceShares,
  CRISIS_RESOURCES,
  DEFAULT_CRISIS_RESOURCES,
} from '@spier/core/lib/crisisResources'
import { displayFor } from '@spier/core/lib/handoffs'
import { WorkflowForm, WorkflowField, WorkflowHint, RecordedList } from './WorkflowForm'
import { nowLocalIso, toIsoOrNow, isoDay } from '../lib/dates'
import { Button } from '@spier/ui/Button'

/**
 * TL-013 — patient-facing crisis resources / coping supports (Stage 4).
 *
 * This replaces the generic `WorkflowActionView`, the third and last tool to
 * come off it, for the reason the other two did: the generic recorder stamped
 * no `meta.profile`, and its `category` carried text with no coding, so its
 * output could not satisfy `SPiERCrisisResourcesShared` or the
 * `category:suicideRisk` slice. The TL-013 ActivityDefinition's description has
 * always said the output is "a SPiERCrisisResourcesShared Communication".
 *
 * Unlike TL-009, no measure reads this profile — the cost was a conformance
 * claim the guide made and the app broke, not a silent zero in a numerator.
 * That makes it the less urgent fix and the clearer illustration: a tool can be
 * documented, launchable, catalogued and green on every gate while emitting
 * something its own IG page does not describe.
 *
 * ⚠️ **The checklist is required, and the submit button says so.** The profile
 * is `payload 1..*`, and a payload is what names a resource — so "crisis
 * resources shared: none" is not a recordable state. The builder will not
 * invent one; the form refuses to submit instead.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server, and no resource is actually
 * sent to the patient.
 */

function toggle(list: string[], code: string): string[] {
  return list.includes(code) ? list.filter(c => c !== code) : [...list, code]
}

export function CrisisResourcesView() {
  const { addArtifact, activePatientId, communications } = usePatient()

  const shares = useMemo(() => crisisResourceShares(communications), [communications])

  const [sent, setSent] = useState(nowLocalIso())
  const [codes, setCodes] = useState<string[]>(DEFAULT_CRISIS_RESOURCES)
  const [localLine, setLocalLine] = useState('')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const needsLocalLine = codes.some(c => c === 'local-crisis-line' || c === 'warmline')

  const params = useMemo(
    () => ({
      patientId: activePatientId,
      sent: toIsoOrNow(sent),
      resourceCodes: codes,
      localLine: localLine.trim() || undefined,
      note: note.trim() || undefined,
    }),
    [activePatientId, sent, codes, localLine, note],
  )

  // The preview is built from whatever is selected, INCLUDING nothing: showing
  // the non-conformant empty-payload resource is more honest than hiding it,
  // and the disabled submit beside it is what states the rule.
  const draft = useMemo(
    () => buildCrisisResourcesShared({ id: 'crisis-resources-preview', ...params }),
    [params],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (codes.length === 0) return
    addArtifact(buildCrisisResourcesShared({ id: `crisis-resources-${makeId()}`, ...params }))
    setNotice(`Recorded ${codes.length} crisis resource${codes.length === 1 ? '' : 's'} shared with the patient.`)
    setNote('')
  }

  return (
    <WorkflowForm
      title="Record Crisis Resources Shared"
      lede={
        <>
          Records what the patient was actually given, under{' '}
          <strong>Document Safety Actions</strong>. Each resource is ticked from a list
          rather than typed as a note, so &ldquo;did this patient leave with crisis
          contacts?&rdquo; is something the chart can answer later.
        </>
      }
      fhirNote={
        <>
          Writes a <strong>Communication</strong> on the{' '}
          <strong>SPiERCrisisResourcesShared</strong> profile, one payload per resource,
          each coded with a <code>crisis-resource-code</code> extension —{' '}
          <code>Communication.payload.content[x]</code> is string, Attachment or Reference
          with no coded choice, so the code rides beside the human-readable line. The profile
          requires <code>payload 1..*</code>, which is why an empty selection is not
          recordable rather than being silently dropped.
        </>
      }
      draft={draft}
      draftTitle="Live FHIR Communication (crisis resources shared)"
      notice={notice}
      recorded={
        shares.length > 0 ? (
          <RecordedList title="Crisis resources shared on this chart">
            {shares.map((share, idx) => {
              const s = share as { id?: string; sent?: string }
              const shared = crisisResourceCodes(share)
              return (
                <li key={s.id ?? idx}>
                  {s.sent ? isoDay(s.sent) : 'undated'} ·{' '}
                  {shared.map(c => displayFor(CRISIS_RESOURCES, c)).join(', ')}
                </li>
              )
            })}
          </RecordedList>
        ) : undefined
      }
    >
      {codes.length === 0 && (
        <WorkflowHint>
          Select at least one resource. &ldquo;Nothing shared&rdquo; is not something this
          form can record — if no crisis resource was given, there is nothing here to
          document, and recording an empty hand-off would misstate what the patient left with.
        </WorkflowHint>
      )}

      <form className="workflow-form" onSubmit={handleSubmit}>
        <WorkflowField label="Shared at">
          <input
            type="datetime-local"
            className="workflow-input"
            value={sent}
            onChange={e => setSent(e.target.value)}
          />
        </WorkflowField>

        <fieldset className="workflow-field">
          <legend className="workflow-field-label">
            What was shared?{' '}
            <span className="workflow-field-optional">(at least one)</span>
          </legend>
          {CRISIS_RESOURCES.map(resource => (
            <label key={resource.code}>
              <input
                type="checkbox"
                checked={codes.includes(resource.code)}
                onChange={() => setCodes(prev => toggle(prev, resource.code))}
              />{' '}
              {resource.display}
            </label>
          ))}
        </fieldset>

        {needsLocalLine && (
          <WorkflowField
            label="Local line details"
            optional="optional"
            help="The one thing a shared list cannot carry: this site's actual number. It is added to the local-line and warmline entries the patient is given."
          >
            <input
              type="text"
              className="workflow-input"
              placeholder="e.g. County Crisis Line, (555) 123-4567, 24/7"
              value={localLine}
              onChange={e => setLocalLine(e.target.value)}
            />
          </WorkflowField>
        )}

        <WorkflowField label="Internal note" optional="optional">
          <textarea
            className="workflow-input workflow-textarea"
            rows={2}
            placeholder="Not given to the patient — e.g. who walked through the resources with them."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </WorkflowField>

        <Button type="submit" disabled={codes.length === 0}>
          Record crisis resources
        </Button>
      </form>
    </WorkflowForm>
  )
}
