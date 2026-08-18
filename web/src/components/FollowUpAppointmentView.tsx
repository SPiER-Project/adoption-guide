import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { CodeDrawer } from './CodeDrawer'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from './PageHeader'
import { makeId } from '../lib/id'
import {
  appointmentProvider,
  appointmentStart,
  appointmentStatus,
  buildFollowUpAppointment,
  displayFor,
  setAppointmentStatus,
  APPOINTMENT_STATUSES,
} from '../lib/handoffs'
import { deriveAppointmentTracking } from '../lib/followUp'
import type { AppointmentResource } from '../types/fhir'
import '../css/WorkflowActionView.css'

/**
 * TL-031 (book the next appointment) + TL-034 (track whether it happened).
 *
 * One view for both tools because TL-034 mints **no resource of its own**:
 * every detail the SSC asks it for — scheduled, date/time, attended, cancelled,
 * no-show, rescheduled — is already carried by `Appointment.status` and
 * `Appointment.start` on the appointment TL-031 created. A parallel
 * "appointment tracking" resource would just be a second copy to keep in sync.
 *
 * So the status buttons below update the SAME appointment in place (upsert by
 * id), and the tracking summary is derived on every render.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server and no scheduling system is
 * contacted; this records an appointment that exists elsewhere.
 */

function defaultStart(): string {
  // Default to a week out at 14:00 local — the typical post-discharge follow-up
  // window, and a future date so the tracking view has something upcoming.
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(14, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function FollowUpAppointmentView() {
  const { addArtifact, activePatientId, appointments } = usePatient()

  const [start, setStart] = useState(defaultStart())
  const [provider, setProvider] = useState('')
  const [description, setDescription] = useState('Post-discharge behavioral health follow-up')
  const [duration, setDuration] = useState('45')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const tracking = useMemo(() => deriveAppointmentTracking(appointments), [appointments])

  const startIso = useMemo(() => {
    const ms = new Date(start).getTime()
    return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString()
  }, [start])

  const draft = useMemo(
    () =>
      buildFollowUpAppointment({
        id: 'appointment-preview',
        patientId: activePatientId,
        status: 'booked',
        start: startIso,
        durationMinutes: Number(duration) || undefined,
        provider,
        description,
        note: note.trim() || undefined,
      }),
    [activePatientId, startIso, duration, provider, description, note],
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact(
      buildFollowUpAppointment({
        id: `appointment-${makeId()}`,
        patientId: activePatientId,
        status: 'booked',
        start: startIso,
        durationMinutes: Number(duration) || undefined,
        provider,
        description,
        note: note.trim() || undefined,
      }),
    )
    setNotice('Follow-up appointment booked.')
    setNote('')
  }

  function updateStatus(appointment: AppointmentResource, status: string) {
    addArtifact(setAppointmentStatus(appointment, status))
    setNotice(`Appointment marked ${displayFor(APPOINTMENT_STATUSES, status).toLowerCase()}.`)
  }

  const sorted = useMemo(
    () =>
      appointments
        .slice()
        .sort((a, b) => (appointmentStart(b) ?? '').localeCompare(appointmentStart(a) ?? '')),
    [appointments],
  )

  return (
    <div className="form-view">
      <PageHeader
        eyebrow={['Patient View', 'Workflow']}
        up="/patient/chart"
        title="Next Appointment & Follow-Up Tracking"
        lede={
          <>
            Records an <strong>Appointment</strong> tagged to the{' '}
            <strong>Coordinate Handoffs</strong> stage. Tracking (TL-034) stores nothing new —{' '}
            <em>Appointment.status</em> already carries booked → attended / no-show / cancelled, so
            the summary below is a read over the same resource.
          </>
        }
      />

      <div className="form-wrapper">
        <div className="form-card">
          {activePatientId === null && (
            <p className="workflow-form-hint">
              No patient selected — this will be recorded in the scratch chart. Pick a patient from the
              Population view to attach it to a specific record.
            </p>
          )}

          {/* TL-034 — derived on every render, never stored. */}
          <p className="workflow-form-hint">
            <strong>Follow-up status:</strong>{' '}
            {tracking.next
              ? `next visit ${(appointmentStart(tracking.next) ?? '').slice(0, 16).replace('T', ' ')}`
              : 'no upcoming visit booked'}
            {` · ${tracking.attendedCount} attended · ${tracking.noShowCount} no-show · ${tracking.cancelledCount} cancelled`}
          </p>

          {tracking.awaitingNoShowFollowUp && (
            <p className="workflow-form-hint">
              The most recent visit was a <strong>no-show</strong>. Record the re-engagement attempt on{' '}
              <Link to="/patient/workflow/outreach">Follow-Up Outreach</Link> — a missed appointment by
              a high-risk patient is a safety event, not an empty slot.
            </p>
          )}

          <form className="workflow-form" onSubmit={handleSubmit}>
            <label className="workflow-field">
              <span className="workflow-field-label">Date &amp; time</span>
              <input
                type="datetime-local"
                className="workflow-input"
                value={start}
                onChange={e => setStart(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Receiving provider / team</span>
              <input
                type="text"
                className="workflow-input"
                placeholder="e.g. Riverside Behavioral Health"
                value={provider}
                onChange={e => setProvider(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Visit description</span>
              <input
                type="text"
                className="workflow-input"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">Duration (minutes)</span>
              <input
                type="number"
                min="5"
                step="5"
                className="workflow-input"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              />
            </label>

            <label className="workflow-field">
              <span className="workflow-field-label">
                Notes <span className="workflow-field-optional">(optional)</span>
              </span>
              <textarea
                className="workflow-input workflow-textarea"
                rows={3}
                placeholder="Transport, reminders, who confirmed the slot."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </label>

            <button type="submit" className="workflow-submit-btn">Book appointment</button>
          </form>

          {notice && (
            <div className="workflow-success-notice">
              {notice} <Link to="/patient/chart#activity">View in chart</Link>
            </div>
          )}

          {sorted.length > 0 && (
            <>
              <h3 className="workflow-form-title">Appointments on this chart</h3>
              <ul>
                {sorted.map((appointment, idx) => {
                  const status = appointmentStatus(appointment)
                  const when = appointmentStart(appointment)
                  const isOpen = status === 'booked' || status === 'proposed' || status === 'arrived'
                  return (
                    <li key={appointment.id ?? idx}>
                      {when ? when.slice(0, 16).replace('T', ' ') : 'undated'}
                      {appointmentProvider(appointment) ? ` · ${appointmentProvider(appointment)}` : ''}
                      {` · ${displayFor(APPOINTMENT_STATUSES, status)}`}
                      {isOpen && (
                        <>
                          {' '}
                          <button
                            type="button"
                            className="workflow-submit-btn"
                            onClick={() => updateStatus(appointment, 'fulfilled')}
                          >
                            Attended
                          </button>{' '}
                          <button
                            type="button"
                            className="workflow-submit-btn"
                            onClick={() => updateStatus(appointment, 'noshow')}
                          >
                            No-show
                          </button>{' '}
                          <button
                            type="button"
                            className="workflow-submit-btn"
                            onClick={() => updateStatus(appointment, 'cancelled')}
                          >
                            Cancelled
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
          <FhirJsonViewer data={draft} title="Live FHIR Appointment" defaultOpen />
        </CodeDrawer>
      </div>
    </div>
  )
}
