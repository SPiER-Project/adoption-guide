import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { makeId } from '@spier/core/lib/id'
import {
  appointmentProvider,
  appointmentStart,
  appointmentStatus,
  buildFollowUpAppointment,
  displayFor,
  setAppointmentStatus,
  APPOINTMENT_STATUSES,
} from '@spier/core/lib/handoffs'
import { deriveAppointmentTracking } from '@spier/core/lib/followUp'
import type { AppointmentResource } from '@spier/core/types/fhir'
import { WorkflowForm, WorkflowField, WorkflowHint, RecordedList } from './WorkflowForm'
import { toIsoOrNow } from '../lib/dates'
import { Button } from '@spier/ui/Button'

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
    return toIsoOrNow(start)
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
    <WorkflowForm
      title="Next Appointment & Follow-Up Tracking"
      lede={
        <>
          Books the next visit under <strong>Coordinate Handoffs</strong>, and tracks it. Marking
          one attended, missed or cancelled updates that same visit rather than filing a second
          record, so the follow-up summary below can never disagree with what was booked.
        </>
      }
      fhirNote={
        <>
          Writes an <strong>Appointment</strong>. Tracking stores nothing new:{' '}
          <code>status</code> already carries booked → fulfilled / noshow / cancelled and{' '}
          <code>start</code> carries the date, so the summary below is a read over the same
          resource and the status buttons upsert it by id. A parallel &ldquo;appointment
          tracking&rdquo; resource would only be a second copy to keep in step.
        </>
      }
      draft={draft}
      draftTitle="Live FHIR Appointment"
      notice={notice}
      recorded={
        <>
          {sorted.length > 0 && (
            <RecordedList title="Appointments on this chart">
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
                        <Button size="sm" onClick={() => updateStatus(appointment, 'fulfilled')}>
                          Attended
                        </Button>{' '}
                        <Button size="sm" onClick={() => updateStatus(appointment, 'noshow')}>
                          No-show
                        </Button>{' '}
                        <Button size="sm" onClick={() => updateStatus(appointment, 'cancelled')}>
                          Cancelled
                        </Button>
                      </>
                    )}
                  </li>
                )
              })}
            </RecordedList>
          )}
        </>
      }
    >
      {/* TL-034 — derived on every render, never stored. */}
      <WorkflowHint>
        <strong>Follow-up status:</strong>{' '}
        {tracking.next
          ? `next visit ${(appointmentStart(tracking.next) ?? '').slice(0, 16).replace('T', ' ')}`
          : 'no upcoming visit booked'}
        {` · ${tracking.attendedCount} attended · ${tracking.noShowCount} no-show · ${tracking.cancelledCount} cancelled`}
      </WorkflowHint>

      {tracking.awaitingNoShowFollowUp && (
        <WorkflowHint>
          The most recent visit was a <strong>no-show</strong>. Record the re-engagement attempt on{' '}
          <Link to="/patient/workflow/outreach">Follow-Up Outreach</Link> — a missed appointment by
          a high-risk patient is a safety event, not an empty slot.
        </WorkflowHint>
      )}

      <form className="workflow-form" onSubmit={handleSubmit}>
        <WorkflowField label="Date &amp; time">
          <input
            type="datetime-local"
            className="workflow-input"
            value={start}
            onChange={e => setStart(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Receiving provider / team">
          <input
            type="text"
            className="workflow-input"
            placeholder="e.g. Riverside Behavioral Health"
            value={provider}
            onChange={e => setProvider(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Visit description">
          <input
            type="text"
            className="workflow-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Duration (minutes)">
          <input
            type="number"
            min="5"
            step="5"
            className="workflow-input"
            value={duration}
            onChange={e => setDuration(e.target.value)}
          />
        </WorkflowField>

        <WorkflowField label="Notes" optional="optional">
          <textarea
            className="workflow-input workflow-textarea"
            rows={3}
            placeholder="Transport, reminders, who confirmed the slot."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </WorkflowField>

        <Button type="submit">Book appointment</Button>
      </form>

    </WorkflowForm>
  )
}
