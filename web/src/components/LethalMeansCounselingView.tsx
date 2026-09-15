import { useMemo, useState } from 'react'
import { usePatient } from '../context/PatientContext'
import { makeId } from '@spier/core/lib/id'
import {
  buildLethalMeansCounseling,
  buildMeansSafetyAction,
  displayFor,
  meansSafetyActionCode,
  meansSafetyActions,
  meansSafetyMethod,
  COUNSELING_TEXT,
  LETHAL_MEANS_METHODS,
  MEANS_SAFETY_ACTIONS,
} from '../lib/lethalMeans'
import { WorkflowForm, WorkflowField, RecordedList } from './WorkflowForm'
import { nowLocalIso, toIsoOrNow, isoDay } from '../lib/dates'

/**
 * TL-008 — lethal means safety counseling / means-safety actions (Stage 4).
 *
 * A recorder rather than a questionnaire, for the same reason as the Stage-5
 * handoff tools: means-safety counseling is an act that gets documented, not a
 * form the patient fills in.
 *
 * The form has two halves because the FHIR does:
 *
 *  - **The counseling happened.** One `Procedure`, and that alone is what
 *    `SPiERLethalMeansCounselingCompleted` counts. Until this recorder existed
 *    nothing in the app wrote it, so that measure's numerator was structurally
 *    unreachable (issue #210).
 *  - **What was actually secured.** One `Observation` per means, with the
 *    action as the value and `status` separating *done* (`final`) from *agreed*
 *    (`preliminary`). "Agreed to lock the medications" and "medications locked"
 *    are different facts, and only the second one is a secured means.
 *
 * Nothing is required to be secured: `declined / not yet addressed` is a real
 * option, because counseling a patient who declines is still counseling and
 * recording it as nothing would lose the attempt.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server.
 */

/** One row of the per-means table: what was addressed, and what came of it. */
interface MeansRow {
  action: string
  completed: boolean
  note: string
}

const EMPTY_ROW: MeansRow = { action: MEANS_SAFETY_ACTIONS[0].code, completed: true, note: '' }

export function LethalMeansCounselingView() {
  const { addArtifact, activePatientId, procedures, observations } = usePatient()

  const [performed, setPerformed] = useState(nowLocalIso())
  const [protocolText, setProtocolText] = useState(COUNSELING_TEXT)
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<Record<string, MeansRow>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const recorded = useMemo(() => meansSafetyActions(observations), [observations])

  const performedIso = useMemo(() => {
    return toIsoOrNow(performed)
  }, [performed])

  const selectedMethods = useMemo(() => LETHAL_MEANS_METHODS.filter(m => rows[m.code]), [rows])

  function toggleMethod(code: string) {
    setRows(prev => {
      if (prev[code]) {
        const next = { ...prev }
        delete next[code]
        return next
      }
      return { ...prev, [code]: { ...EMPTY_ROW } }
    })
  }

  function updateRow(code: string, patch: Partial<MeansRow>) {
    setRows(prev => (prev[code] ? { ...prev, [code]: { ...prev[code], ...patch } } : prev))
  }

  // The preview shows the whole write, not just the Procedure — the point of
  // TL-008 is that counseling and the concrete actions are separate resources.
  const draft = useMemo(
    () => [
      buildLethalMeansCounseling({
        id: 'counseling-preview',
        patientId: activePatientId,
        performed: performedIso,
        text: protocolText,
        note: note.trim() || undefined,
      }),
      ...selectedMethods.map(m =>
        buildMeansSafetyAction({
          id: `means-action-preview-${m.code}`,
          patientId: activePatientId,
          effective: performedIso,
          method: m.code,
          action: rows[m.code].action,
          completed: rows[m.code].completed,
          note: rows[m.code].note.trim() || undefined,
        }),
      ),
    ],
    [activePatientId, performedIso, protocolText, note, selectedMethods, rows],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const batch = makeId()
    addArtifact(
      buildLethalMeansCounseling({
        id: `counseling-${batch}`,
        patientId: activePatientId,
        performed: performedIso,
        text: protocolText,
        note: note.trim() || undefined,
      }),
    )
    for (const m of selectedMethods) {
      addArtifact(
        buildMeansSafetyAction({
          id: `means-action-${batch}-${m.code}`,
          patientId: activePatientId,
          effective: performedIso,
          method: m.code,
          action: rows[m.code].action,
          completed: rows[m.code].completed,
          note: rows[m.code].note.trim() || undefined,
        }),
      )
    }
    setNotice(
      selectedMethods.length === 0
        ? 'Counseling recorded — no means-safety actions were documented.'
        : `Counseling recorded with ${selectedMethods.length} means-safety action${
            selectedMethods.length === 1 ? '' : 's'
          }.`,
    )
    setNote('')
    setRows({})
  }

  return (
    <WorkflowForm
      title="Lethal Means Safety Counseling"
      lede={
        <>
          Records a <strong>Procedure</strong> tagged to the{' '}
          <strong>Document Safety Actions</strong> stage — that counseling happened — plus one{' '}
          <strong>Observation</strong> per means addressed, saying what was actually secured. The
          measure counts the counseling; the observations are what makes follow-up possible.
        </>
      }
      draft={draft}
      draftTitle={`Live FHIR — Procedure + ${selectedMethods.length} action Observation${selectedMethods.length === 1 ? '' : 's'}`}
      notice={notice}
      recorded={
        <>
          {procedures.length > 0 && (
            <RecordedList title="Counseling on this chart">
              {procedures.map((raw, idx) => {
                const p = raw as {
                  id?: string
                  code?: { text?: string }
                  performedDateTime?: string
                }
                return (
                  <li key={p.id ?? idx}>
                    {p.code?.text ?? 'Lethal means safety counseling'}
                    {p.performedDateTime ? ` · ${isoDay(p.performedDateTime)}` : ''}
                  </li>
                )
              })}
            </RecordedList>
          )}

          {recorded.length > 0 && (
            <RecordedList title="Means-safety actions on this chart">
              {recorded.map((o, idx) => (
                <li key={o.id ?? idx}>
                  {displayFor(LETHAL_MEANS_METHODS, meansSafetyMethod(o) ?? '')} →{' '}
                  {displayFor(MEANS_SAFETY_ACTIONS, meansSafetyActionCode(o) ?? '')}
                  {(o as { status?: string }).status === 'preliminary' ? ' · agreed, not confirmed' : ''}
                </li>
              ))}
            </RecordedList>
          )}
        </>
      }
    >
      <form className="workflow-form" onSubmit={handleSubmit}>
        <WorkflowField label="Counseling provided at">
          <input
            type="datetime-local"
            className="workflow-input"
            value={performed}
            onChange={e => setPerformed(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Protocol / description" optional="SNOMED codes this as counseling">
          <input
            type="text"
            className="workflow-input"
            placeholder={COUNSELING_TEXT}
            value={protocolText}
            onChange={e => setProtocolText(e.target.value)}
          />
        </WorkflowField>

        <fieldset className="workflow-field">
          <legend className="workflow-field-label">
            Which means were addressed?{' '}
            <span className="workflow-field-optional">(several may apply)</span>
          </legend>
          {LETHAL_MEANS_METHODS.map(m => (
            <label key={m.code}>
              <input
                type="checkbox"
                checked={!!rows[m.code]}
                onChange={() => toggleMethod(m.code)}
              />{' '}
              {m.display}
            </label>
          ))}
        </fieldset>

        {selectedMethods.map(m => {
          const row = rows[m.code]
          return (
            <fieldset className="workflow-field" key={m.code}>
              <legend className="workflow-field-label">{m.display}</legend>
              <select
                className="workflow-input"
                aria-label={`${m.display} — action taken`}
                value={row.action}
                onChange={e => updateRow(m.code, { action: e.target.value })}
              >
                {MEANS_SAFETY_ACTIONS.map(a => (
                  <option key={a.code} value={a.code}>{a.display}</option>
                ))}
              </select>
              <select
                className="workflow-input"
                aria-label={`${m.display} — status`}
                value={row.completed ? 'done' : 'agreed'}
                onChange={e => updateRow(m.code, { completed: e.target.value === 'done' })}
              >
                <option value="done">Done — the means is secured now</option>
                <option value="agreed">Agreed — planned, not yet confirmed</option>
              </select>
              <input
                type="text"
                className="workflow-input"
                aria-label={`${m.display} — responsible party and detail`}
                placeholder="Responsible party and detail — e.g. brother holds the key, check at follow-up"
                value={row.note}
                onChange={e => updateRow(m.code, { note: e.target.value })}
              />
            </fieldset>
          )
        })}

        <WorkflowField label="Counseling notes" optional="optional">
          <textarea
            className="workflow-input workflow-textarea"
            rows={3}
            placeholder="Who was present, what was discussed, what the patient agreed to."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </WorkflowField>

        <button type="submit" className="workflow-submit-btn">Record counseling</button>
      </form>

    </WorkflowForm>
  )
}
