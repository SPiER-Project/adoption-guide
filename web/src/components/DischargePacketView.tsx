import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { CodeDrawer } from './CodeDrawer'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from './PageHeader'
import { makeId } from '@spier/core/lib/id'
import {
  applySharingConsent,
  buildDischargePacket,
  consentDecision,
  consentExpiry,
  consentRecipient,
  currentSharingConsent,
  displayFor,
  handoffWithheldItems,
  HANDOFF_CONTENT_ITEMS,
  WITHHOLDING_BASES,
} from '@spier/core/lib/handoffs'
import type { SharingDecision } from '@spier/core/lib/handoffs'
import type { ConsentResource } from '@spier/core/types/fhir'
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
 * This is also the one screen in SPiER where a recorded preference CHANGES an
 * artifact rather than sitting beside it (issue #227). The TL-032 sharing
 * consent is read before the packet asserts what it carries, and anything it
 * excluded is recorded as a withheld item with its basis — a packet silently
 * missing a section is indistinguishable from a bug. The rules, and the two
 * defaults they encode, live in `applySharingConsent()`.
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

function consentSummary(consent: ConsentResource): string {
  const recorded = (consent as { dateTime?: string }).dateTime
  const who = consentRecipient(consent)
  return [
    consentDecision(consent) === 'deny' ? 'sharing declined' : 'sharing permitted',
    who ? `recipient ${who}` : null,
    recorded ? `recorded ${recorded.slice(0, 10)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * What the gate decided, in the reader's terms. Every branch names the basis
 * out loud: the point of the exercise is that an adopting site can see WHICH
 * rule fired, including the two SPiER chose rather than derived.
 */
function ConsentGateNotice({
  decision,
  recipient,
}: {
  decision: SharingDecision
  recipient: string
}) {
  const onFile = decision.consent ? `On file: ${consentSummary(decision.consent)}.` : null
  const recordLink = (
    <Link to="/patient/workflow/sharing-consent">Record an information-sharing consent</Link>
  )

  let tone = 'neutral'
  let title: string
  let detail: React.ReactNode

  if (decision.patientCopyOnly) {
    title = 'Patient copy — no recipient named'
    detail = (
      <>
        A sharing consent governs disclosure to someone <em>else</em>. Nothing here is being
        disclosed, so the packet is assembled whole — withholding a patient&rsquo;s own safety plan
        because they declined to have it forwarded would invert what they asked for. Name a
        recipient to apply the recorded preference. {onFile}
      </>
    )
  } else if (decision.blanketBasis === 'no-consent-recorded') {
    tone = 'withheld'
    title = 'Everything withheld — no sharing consent on file'
    detail = (
      <>
        No active suicide-safety sharing consent exists for this patient. SPiER&rsquo;s default is to
        withhold rather than read silence as permission, so this packet asserts nothing released to{' '}
        <strong>{recipient}</strong>. {recordLink} to change that.
      </>
    )
  } else if (decision.blanketBasis === 'consent-expired') {
    tone = 'withheld'
    title = 'Everything withheld — the sharing consent has expired'
    detail = (
      <>
        The consent on file ended {consentExpiry(decision.consent!)?.slice(0, 10)}, before this
        packet&rsquo;s date, so it no longer authorises release to <strong>{recipient}</strong>.{' '}
        {recordLink} to re-ask. {onFile}
      </>
    )
  } else if (decision.blanketBasis === 'patient-declined-sharing') {
    tone = 'withheld'
    title = 'Everything withheld — the patient declined sharing'
    detail = (
      <>
        The governing consent is a deny: nothing may be released to <strong>{recipient}</strong>.{' '}
        {onFile}
      </>
    )
  } else if (decision.blanketBasis === 'recipient-excluded') {
    tone = 'withheld'
    title = 'Everything withheld — this recipient is excluded by name'
    detail = (
      <>
        The patient&rsquo;s consent permits sharing, but names <strong>{recipient}</strong> in a deny
        provision. {onFile}
      </>
    )
  } else if (decision.blanketBasis === 'recipient-not-authorised') {
    tone = 'withheld'
    title = 'Everything withheld — this recipient is not the one the patient named'
    detail = (
      <>
        The consent on file permits release to a named recipient, and{' '}
        <strong>{recipient}</strong> is not it. A permit naming one party is not a permit naming any
        party, so nothing is released here. {recordLink} if the patient has agreed to this one.{' '}
        {onFile}
      </>
    )
  } else if (decision.withheld.length > 0) {
    // Amber, not green: release is authorised, but something was withheld — and
    // the withheld half is what the reader must not miss.
    tone = 'withheld'
    title = `Sharing permitted, with ${decision.withheld.length} exclusion${
      decision.withheld.length === 1 ? '' : 's'
    }`
    detail = (
      <>
        The patient permitted release to <strong>{recipient}</strong> but excluded the items below.
        They are removed from what the packet asserts it carries, and recorded on it as withheld.{' '}
        {onFile}
      </>
    )
  } else {
    tone = 'permitted'
    title = 'Sharing permitted'
    detail = (
      <>
        The consent on file authorises release to <strong>{recipient}</strong> with no exclusions
        that apply here. {onFile}
      </>
    )
  }

  return (
    <div className={`consent-gate consent-gate--${tone}`}>
      <p className="consent-gate__title">{title}</p>
      <p className="consent-gate__detail">{detail}</p>
      {decision.withheld.length > 0 && (
        <ul className="consent-gate__list">
          {decision.withheld.map(item => (
            <li key={item.code}>
              {displayFor(HANDOFF_CONTENT_ITEMS, item.code)} —{' '}
              <em>{displayFor(WITHHOLDING_BASES, item.basis)}</em>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DischargePacketView() {
  const {
    addArtifact,
    activePatientId,
    carePlans,
    observations,
    appointments,
    documentReferences,
    consents,
  } = usePatient()

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
  // `null` until the user types: the recipient defaults to whoever the patient
  // already named on their consent, which is where the packet is usually going.
  const [recipientInput, setRecipientInput] = useState<string | null>(null)

  const governing = useMemo(() => currentSharingConsent(consents), [consents])
  const recipient =
    recipientInput ?? (governing ? (consentRecipient(governing) ?? '') : '')

  const packetDate = `${date}T12:00:00Z`
  const decision = useMemo(
    () =>
      applySharingConsent({ contentCodes, recipient, consents, asOf: packetDate }),
    [contentCodes, recipient, consents, packetDate],
  )
  const withheldByCode = useMemo(
    () => new Map(decision.withheld.map(w => [w.code, w])),
    [decision],
  )

  // Named recipient + a consent on file ⇒ the packet says which record it was
  // released under. On a patient copy nothing was disclosed, so citing an
  // authority for it would overstate what happened.
  const consentReference =
    !decision.patientCopyOnly && decision.consent?.id
      ? `Consent/${decision.consent.id}`
      : undefined

  const packetParams = {
    patientId: activePatientId,
    date: packetDate,
    title,
    // The gate's output, not the checkbox state — this is the enforcement.
    contentCodes: decision.included,
    relatedReferences: related,
    withheldItems: decision.withheld,
    consentReference,
    note: note.trim() || undefined,
  }

  // Cheap enough to rebuild per render, and rebuilding is what keeps the JSON
  // preview honest about the gate's current answer.
  const draft = buildDischargePacket({ id: 'packet-preview', ...packetParams })

  function toggle(list: string[], code: string): string[] {
    return list.includes(code) ? list.filter(c => c !== code) : [...list, code]
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    addArtifact(buildDischargePacket({ id: `packet-${makeId()}`, ...packetParams }))
    setNotice(
      decision.withheld.length > 0
        ? `Discharge safety packet recorded — ${decision.withheld.length} item${
            decision.withheld.length === 1 ? '' : 's'
          } withheld per the patient's sharing preference.`
        : 'Discharge safety packet recorded.',
    )
  }

  return (
    <div className="form-view">
      <PageHeader
        eyebrow={['Patient View', 'Workflow']}
        up="/patient/chart"
        title="Discharge Safety Packet / Transition Bundle"
        lede={
          <>
            Records a <strong>DocumentReference</strong> tagged to the{' '}
            <strong>Coordinate Handoffs</strong> stage. The packet is a retrievable artifact, not a
            transmission — and it <em>points at</em> the live safety plan and appointment rather than
            copying them. Where the patient&rsquo;s sharing consent excludes something, the packet
            leaves it out and <em>says so</em>.
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

            <label className="workflow-field">
              <span className="workflow-field-label">
                Released to <span className="workflow-field-optional">(leave blank for a patient copy)</span>
              </span>
              <input
                type="text"
                className="workflow-input"
                placeholder="e.g. Riverside Behavioral Health"
                value={recipient}
                onChange={e => setRecipientInput(e.target.value)}
              />
              <span className="workflow-field-help">
                Naming a third party makes this a disclosure, so the patient&rsquo;s recorded sharing
                consent (TL-032) decides what the packet may carry.
              </span>
            </label>

            <ConsentGateNotice decision={decision} recipient={recipient} />

            <fieldset className="workflow-field">
              <legend className="workflow-field-label">
                What is included? <span className="workflow-field-optional">(several may apply)</span>
              </legend>
              {HANDOFF_CONTENT_ITEMS.map(item => {
                const withheld = withheldByCode.get(item.code)
                return (
                  <label
                    key={item.code}
                    className={withheld ? 'withheld-option' : undefined}
                    title={withheld ? displayFor(WITHHOLDING_BASES, withheld.basis) : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={contentCodes.includes(item.code)}
                      onChange={() => setContentCodes(prev => toggle(prev, item.code))}
                    />{' '}
                    {item.display}
                    {withheld && (
                      <span className="withheld-option__tag">
                        withheld · {displayFor(WITHHOLDING_BASES, withheld.basis)}
                      </span>
                    )}
                  </label>
                )
              })}
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
                  const withheld = handoffWithheldItems(d)
                  return (
                    <li key={doc.id ?? idx}>
                      {doc.content?.[0]?.attachment?.title ?? 'Discharge packet'}
                      {doc.date ? ` — ${doc.date.slice(0, 10)}` : ''}
                      {doc.status ? ` · ${doc.status}` : ''}
                      {withheld.length > 0 && (
                        <>
                          {' · '}
                          <span className="withheld-option__tag">
                            {withheld.length} withheld ·{' '}
                            {withheld
                              .map(w => displayFor(HANDOFF_CONTENT_ITEMS, w.code))
                              .join(', ')}
                          </span>
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
          <FhirJsonViewer data={draft} title="Live FHIR DocumentReference" defaultOpen />
        </CodeDrawer>
      </div>
    </div>
  )
}
