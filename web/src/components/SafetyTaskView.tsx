import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { CodeDrawer } from './CodeDrawer'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from './PageHeader'
import { makeId } from '@spier/core/lib/id'
import {
  buildSafetyTask,
  completeTask,
  displayFor,
  findOpenEpisode,
  isTaskOpen,
  isTaskOverdue,
  taskDueDate,
  tasksForEpisode,
  ESCALATION_TRIGGERS,
  SAFETY_TASK_TYPES,
} from '@spier/core/lib/riskEpisode'
import '../css/WorkflowActionView.css'

/**
 * TL-039 / TL-040 / TL-041 — open, owned, due-dated safety work (Stage 7).
 *
 * One recorder serves all three tools because they are one FHIR shape
 * differentiated by Task.code: reassessment-due is the review schedule, the
 * care-gap codes are open safety actions, and `escalation` (plus its repeating
 * trigger extension) is the escalation workflow.
 *
 * Overdue is computed from the due date on every render rather than stored, so
 * the list can never disagree with the clock.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server.
 */

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function SafetyTaskView() {
  const { addArtifact, activePatientId, episodes, tasks } = usePatient()

  const openEpisode = useMemo(() => findOpenEpisode(episodes), [episodes])
  const episodeTasks = useMemo(
    () => tasksForEpisode(tasks, openEpisode?.id),
    [tasks, openEpisode],
  )

  const [taskType, setTaskType] = useState(SAFETY_TASK_TYPES[0].code)
  const [dueDate, setDueDate] = useState(todayIso())
  const [owner, setOwner] = useState('')
  const [triggers, setTriggers] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const isEscalation = taskType === 'escalation'

  const draft = useMemo(
    () =>
      buildSafetyTask({
        id: 'task-preview',
        patientId: activePatientId,
        episodeId: openEpisode?.id,
        taskType,
        dueDate: dueDate ? `${dueDate}T23:59:59Z` : undefined,
        owner: owner.trim() || undefined,
        escalationTriggers: isEscalation ? triggers : [],
        note: note.trim() || undefined,
        authoredOn: new Date().toISOString(),
      }),
    [activePatientId, openEpisode, taskType, dueDate, owner, triggers, note, isEscalation],
  )

  function toggleTrigger(code: string) {
    setTriggers(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact(
      buildSafetyTask({
        id: `task-${makeId()}`,
        patientId: activePatientId,
        episodeId: openEpisode?.id,
        taskType,
        dueDate: dueDate ? `${dueDate}T23:59:59Z` : undefined,
        owner: owner.trim() || undefined,
        escalationTriggers: isEscalation ? triggers : [],
        note: note.trim() || undefined,
        authoredOn: new Date().toISOString(),
      }),
    )
    setNotice(`${displayFor(SAFETY_TASK_TYPES, taskType)} recorded.`)
    setNote('')
    setTriggers([])
  }

  return (
    <div className="form-view">
      <PageHeader
        eyebrow={['Patient View', 'Workflow']}
        up="/patient/chart"
        title="Safety Tasks — reassessment, care gaps, escalation"
        lede={
          <>
            Records a <strong>Task</strong> tagged to the <strong>Track Risk Over Time</strong>{' '}
            stage. One shape serves all three tools; <em>Task.code</em> says which.
          </>
        }
      />

      <div className="form-wrapper">
        <div className="form-card">
          {!openEpisode && (
            <p className="workflow-form-hint">
              No open episode — the task will be recorded without an episode link. Open one from{' '}
              <Link to="/patient/workflow/risk-episode">Suicide-Risk Episode</Link> first so it rolls
              up into the registry work queue.
            </p>
          )}

          <form className="workflow-form" onSubmit={handleSubmit}>
            <label className="workflow-field">
              <span className="workflow-field-label">Task type</span>
              <select className="workflow-input" value={taskType} onChange={e => setTaskType(e.target.value)}>
                {SAFETY_TASK_TYPES.map(t => (
                  <option key={t.code} value={t.code}>{t.display}</option>
                ))}
              </select>
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Due date</span>
              <input
                type="date"
                className="workflow-input"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                Owner <span className="workflow-field-optional">(person or team)</span>
              </span>
              <input
                type="text"
                className="workflow-input"
                placeholder="e.g. Care manager — J. Rivera"
                value={owner}
                onChange={e => setOwner(e.target.value)}
              />
            </label>

            {isEscalation && (
              <fieldset className="workflow-field">
                <legend className="workflow-field-label">
                  Escalation triggers <span className="workflow-field-optional">(several may apply)</span>
                </legend>
                {ESCALATION_TRIGGERS.map(t => (
                  <label key={t.code}>
                    <input
                      type="checkbox"
                      checked={triggers.includes(t.code)}
                      onChange={() => toggleTrigger(t.code)}
                    />{' '}
                    {t.display}
                  </label>
                ))}
              </fieldset>
            )}

            <label className="workflow-field">
              <span className="workflow-field-label">
                Notes <span className="workflow-field-optional">(optional)</span>
              </span>
              <textarea
                className="workflow-input workflow-textarea"
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </label>

            <button type="submit" className="workflow-submit-btn">Record task</button>
          </form>

          {notice && (
            <div className="workflow-success-notice">
              {notice} <Link to="/patient/chart#activity">View in chart</Link>
            </div>
          )}

          {episodeTasks.length > 0 && (
            <>
              <h3 className="workflow-form-title">Open work on this episode</h3>
              <ul>
                {episodeTasks.map(t => {
                  const overdue = isTaskOverdue(t)
                  const due = taskDueDate(t)
                  const label = (t as { code?: { text?: string } }).code?.text ?? 'Safety task'
                  return (
                    <li key={t.id}>
                      {label}
                      {due ? ` — due ${due.slice(0, 10)}` : ' — no due date'}
                      {overdue ? ' · OVERDUE' : ''}
                      {!isTaskOpen(t) ? ' · completed' : ''}
                      {isTaskOpen(t) && (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="workflow-submit-btn"
                            onClick={() => addArtifact(completeTask(t))}
                          >
                            Mark complete
                          </button>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <CodeDrawer>
          <FhirJsonViewer data={draft} title="Live FHIR Task" defaultOpen />
        </CodeDrawer>
      </div>
    </div>
  )
}
