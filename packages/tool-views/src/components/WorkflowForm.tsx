/**
 * The frame every workflow recorder renders — and the ONLY place it is written.
 *
 * Ten views (caring contact, outreach, referral, appointment, consent, packet,
 * safety task, risk episode, lethal-means counseling, the generic recorder)
 * put a form in a card beside a live FHIR preview, under the page header,
 * above a success notice and a list of what is already on the chart. Every
 * one of them had its own copy of that frame; the maintainability audit
 * (2026-09-15, §2.3) found the "No patient selected" sentence pasted nine
 * times with one already reworded, and only one view scrolling its notice
 * into view. This component is the frame; a recorder is now its fields plus
 * the resource it builds.
 *
 * What stays in the view: the `<form>` itself and its fields (built from
 * `WorkflowField`), any gate hints (`WorkflowHint`), the "on this chart" list
 * (`RecordedList`, passed as `recorded` so it sits BELOW the success notice —
 * the order every view had), and the FHIR draft. What the frame owns: the page header
 * (eyebrow, back link), the card-beside-drawer layout, the scratch-chart hint
 * when no patient is active, the success notice with its "View in chart"
 * link, and the code drawer showing the draft.
 *
 * `check:template` treats a file that renders <WorkflowForm> as a recorder
 * view: it must not ALSO render <PageHeader> or the form layout classes,
 * because then the page would have two headers.
 *
 * ── `lede` says what the clinician is doing; `fhirNote` says what it writes ──
 *
 * ⚠️ **The split is the rule, not a convenience.** Until 2026-09-17 every lede
 * opened "Records a **Communication** tagged to the …" — and the lede renders
 * through `PageHeader`, unconditionally, on `/patient/workflow/*`. So the
 * clean-clinical-surface pass removed the JSON and left the wire format in the
 * prose beside it, which is the same defect one medium over.
 *
 * Settled (Brad, 2026-09-17): **the recorder describes the act.** A resource
 * type, a profile name, an extension id or a `Resource.element` path may not
 * appear in anything a clinician reads — so they go in `fhirNote`, which
 * renders inside the `CodeDrawer` and is therefore gated by `useInspect()`
 * along with the draft itself. The argument an implementer came for ("a
 * ServiceRequest so the referral can be tracked past *sent*") is not lost; it
 * moves to where the resource already is. `check:fhir-render` RULE 3 enforces
 * it by parsing this file's callers and reading their JSX text.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { CodeDrawer } from './CodeDrawer'
import { FhirJsonViewer } from './FhirJsonViewer'
import { PageHeader } from '@spier/ui/PageHeader'
import { Notice } from '@spier/ui/Notice'
import '../css/WorkflowForm.css'

export function WorkflowForm({
  title,
  lede,
  fhirNote,
  draft,
  draftTitle,
  notice,
  noticeExtra,
  recorded,
  children,
}: {
  title: string
  /**
   * One or two sentences under the title, in the clinician's terms: what this
   * records and which pathway stage it lands under.
   *
   * ⚠️ **No FHIR here** — no resource type, profile, extension or element path.
   * That is `fhirNote`, and `check:fhir-render` RULE 3 fails the build on it.
   */
  lede: ReactNode
  /**
   * The implementer's half: what this recorder writes and why that shape. Sits
   * at the top of the code drawer, so it is gated by `useInspect()` with the
   * draft and appears only inside the Adoption Guide.
   */
  fhirNote?: ReactNode
  /** The resource the form will write, shown live in the code drawer. */
  draft: unknown
  /** The drawer's caption — "Live FHIR Communication". */
  draftTitle: string
  /** Set after a successful submit; rendered with a "View in chart" link. */
  notice?: ReactNode
  /** A second link after "View in chart", for the one recorder that has somewhere else to go. */
  noticeExtra?: ReactNode
  /** What is already on the chart — a `RecordedList` or two — rendered after the notice. */
  recorded?: ReactNode
  children: ReactNode
}) {
  const { activePatientId } = usePatient()
  return (
    <div className="form-view">
      <PageHeader eyebrowStyle="pill" eyebrow={['Patient Chart', 'Workflow']} up="/patient/record" title={title} lede={lede} />

      <div className="form-wrapper">
        <div className="form-card">
          {activePatientId === null && (
            <WorkflowHint>
              No patient selected — this will be recorded in the scratch chart. Pick a patient from the
              Population view to attach it to a specific record.
            </WorkflowHint>
          )}

          {children}

          {notice && (
            <WorkflowNotice>
              {notice} <Link to="/patient/record#activity">View in chart</Link>
              {noticeExtra && (
                <>
                  {' · '}
                  {noticeExtra}
                </>
              )}
            </WorkflowNotice>
          )}

          {recorded}
        </div>

        <CodeDrawer>
          {fhirNote && <Notice tone="info">{fhirNote}</Notice>}
          <FhirJsonViewer data={draft} title={draftTitle} defaultOpen />
        </CodeDrawer>
      </div>
    </div>
  )
}

/** A short informational note inside the card: a gate, a prerequisite, a scratch-chart warning. */
export function WorkflowHint({ children }: { children: ReactNode }) {
  return <Notice tone="info">{children}</Notice>
}

/**
 * One labelled control. `optional` is the parenthetical after the label
 * ("optional", "several may apply"); `help` is a sentence under the control
 * for the few fields whose meaning is not self-evident from the label.
 */
export function WorkflowField({
  label,
  optional,
  help,
  children,
}: {
  label: ReactNode
  optional?: ReactNode
  help?: ReactNode
  /** Absent for a checkbox field, where the control sits inside the label text itself. */
  children?: ReactNode
}) {
  return (
    <label className="workflow-field">
      <span className="workflow-field-label">
        {label}
        {optional !== undefined && (
          <>
            {' '}
            <span className="workflow-field-optional">({optional})</span>
          </>
        )}
      </span>
      {children}
      {help !== undefined && <span className="workflow-field-help">{help}</span>}
    </label>
  )
}

/**
 * The success notice. Scrolls itself into view on mount: a form long enough
 * to scroll puts the notice below the fold, and a submit that appears to do
 * nothing is the worst outcome on a suicide-safer-care recorder.
 */
function WorkflowNotice({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [])
  return (
    <Notice tone="success" ref={ref}>
      {children}
    </Notice>
  )
}

/** "Caring contacts on this chart" — a heading and the list of what is already recorded. */
export function RecordedList({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <>
      <h3 className="workflow-form-title">{title}</h3>
      <ul>{children}</ul>
    </>
  )
}
