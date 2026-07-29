import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { FhirJsonViewer } from './FhirJsonViewer'
import { makeId } from '../lib/id'
import { buildDischargePacket, HANDOFF_CONTENT_ITEMS } from '../lib/handoffs'
import '../css/WorkflowActionView.css'

/**
 * TL-030 — assemble the discharge safety packet (Stage 5).
 *
 * A DocumentReference rather than another Communication: the handoff (TL-009)
 * is an *event*, the packet is an *object* that persists and can be re-retrieved
 * later by the patient or the receiving provider.
 *
 * The `context.related` picker below is the point of the design. It offers the
 * patient's LIVE resources — the safety-plan CarePlan, the most recent risk
 * Observation, the booked follow-up Appointment — so the packet points at the
 * record rather than becoming a stale copy divorced from it.
 *
 * ⚠️ DEMO ONLY — nothing is persisted to a server, and no PDF is generated:
 * `content.attachment` carries the packet's title and content type only.
 */

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Content items pre-checked because they are the SSC's expected minimum. */
const DEFAULT_CONTENT = ['safety-plan-copy', 'crisis-resources', 'appointment-details']

interface RelatedOption {
  reference: string
  label: string
}

export function DischargePacketView() {
  const { addArtifact, activePatientId, carePlans, observations, appointments, documentReferences } =
    usePatient()

  // Candidate context.related targets, drawn from what this patient actually has.
  const relatedOptions = useMemo<RelatedOption[]>(() => {
    const options: RelatedOption[] = []
    for (const cp of carePlans) {
      const c = cp as { id?: string; title?: string }
      if (c.id) options.push({ reference: `CarePlan/${c.id}`, label: c.title ?? 'Safety plan' })
    }
    // Only the most recent risk observation — the packet needs the current
    // picture, not the whole assessment history.
    const risk = observations
      .filter(o => {
        const code = (o as { code?: { coding?: { code?: string }[] } }).code?.coding?.[0]?.code
        return code === '93374-7'
      })
      .slice()
      .sort((a, b) => {
        const da = (a as { effectiveDateTime?: string }).effectiveDateTime ?? ''
        const db = (b as { effectiveDateTime?: string }).effectiveDateTime ?? ''
        return db.localeCompare(da)
      })[0] as { id?: string } | undefined
    if (risk?.id) options.push({ reference: `Observation/${risk.id}`, label: 'Current risk level' })
    for (const appt of appointments) {
      const a = appt as { id?: string; description?: string; start?: string }
      if (a.id) {
        options.push({
          reference: `Appointment/${a.id}`,
          label: `${a.description ?? 'Follow-up appointment'}${a.start ? ` — ${a.start.slice(0, 10)}` : ''}`,
        })
      }
    }
    return options
  }, [carePlans, observations, appointments])

  const [title, setTitle] = useState('Suicide-safety discharge packet')
  const [date, setDate] = useState(todayIso())
  const [contentCodes, setContentCodes] = useState<string[]>(DEFAULT_CONTENT)
  const [related, setRelated] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const draft = useMemo(
    () =>
      buildDischargePacket({
        id: 'packet-preview',
        patientId: activePatientId,
        date: `${date}T12:00:00Z`,
        title,
        contentCodes,
        relatedReferences: related,
        note: note.trim() || undefined,
      }),
    [activePatientId, date, title, contentCodes, related, note],
  )

  function toggle(list: string[], code: string): string[] {
    return list.includes(code) ? list.filter(c => c !== code) : [...list, code]
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact(
      buildDischargePacket({
        id: `packet-${makeId()}`,
        patientId: activePatientId,
        date: `${date}T12:00:00Z`,
        title,
        contentCodes,
        relatedReferences: related,
        note: note.trim() || undefined,
      }),
    )
    setNotice('Discharge safety packet recorded.')
  }

  return (
    <div className="form-wrapper">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/patient/chart">← Patient chart</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Discharge Safety Packet</span>
      </nav>

      <div className="form-card">
        <header className="workflow-form-header">
          <h2 className="workflow-form-title">Discharge Safety Packet / Transition Bundle</h2>
          <p className="workflow-form-subtitle">
            Records a <strong>DocumentReference</strong> tagged to the{' '}
            <strong>Coordinate Handoffs</strong> stage. The packet is a retrievable artifact, not a
            transmission — and it <em>points at</em> the live safety plan and appointment rather than
            copying them.
          </p>
        </header>

        {activePatientId === null && (
          <p className="workflow-form-hint">
            No patient selected — this will be recorded in the scratch chart. Pick a patient from the
            Population view to attach it to a specific record.
          </p>
        )}

        <form className="workflow-form" onSubmit={handleSubmit}>
          <label className="workflow-field">
            <span className="workflow-field-label">Packet title</span>
            <input
              type="text"
              className="workflow-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </label>

          <label className="workflow-field">
            <span className="workflow-field-label">Date assembled</span>
            <input
              type="date"
              className="workflow-input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </label>

          <fieldset className="workflow-field">
            <legend className="workflow-field-label">
              What is included? <span className="workflow-field-optional">(several may apply)</span>
            </legend>
            {HANDOFF_CONTENT_ITEMS.map(item => (
              <label key={item.code}>
                <input
                  type="checkbox"
                  checked={contentCodes.includes(item.code)}
                  onChange={() => setContentCodes(prev => toggle(prev, item.code))}
                />{' '}
                {item.display}
              </label>
            ))}
          </fieldset>

          <fieldset className="workflow-field">
            <legend className="workflow-field-label">
              Assembled from <span className="workflow-field-optional">(links, not copies)</span>
            </legend>
            {relatedOptions.length === 0 ? (
              <p className="workflow-form-hint">
                No safety plan, risk observation or appointment on this chart yet — the packet will
                record its contents as codes only.
              </p>
            ) : (
              relatedOptions.map(opt => (
                <label key={opt.reference}>
                  <input
                    type="checkbox"
                    checked={related.includes(opt.reference)}
                    onChange={() => setRelated(prev => toggle(prev, opt.reference))}
                  />{' '}
                  {opt.label} <code>{opt.reference}</code>
                </label>
              ))
            )}
          </fieldset>

          <label className="workflow-field">
            <span className="workflow-field-label">
              Description <span className="workflow-field-optional">(optional)</span>
            </span>
            <textarea
              className="workflow-input workflow-textarea"
              rows={3}
              placeholder="Anything notable about what the patient left with."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </label>

          <button type="submit" className="workflow-submit-btn">Record packet</button>
        </form>

        {notice && (
          <div className="workflow-success-notice">
            {notice} <Link to="/patient/chart#activity">View in chart</Link>
          </div>
        )}

        {documentReferences.length > 0 && (
          <>
            <h3 className="workflow-form-title">Packets on this chart</h3>
            <ul>
              {documentReferences.map((d, idx) => {
                const doc = d as {
                  id?: string
                  date?: string
                  status?: string
                  content?: { attachment?: { title?: string } }[]
                }
                return (
                  <li key={doc.id ?? idx}>
                    {doc.content?.[0]?.attachment?.title ?? 'Discharge packet'}
                    {doc.date ? ` — ${doc.date.slice(0, 10)}` : ''}
                    {doc.status ? ` · ${doc.status}` : ''}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <aside className="debug-sidebar">
        <FhirJsonViewer data={draft} title="Live FHIR DocumentReference" defaultOpen />
      </aside>
    </div>
  )
}
