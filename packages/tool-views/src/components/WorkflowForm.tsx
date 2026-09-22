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
 * (eyebrow, back link), the card-beside-drawer layout, the hint about which
 * chart this will land in, the success notice with the confirmation beat
 * inside it, and the code drawer showing the draft.
 *
 * ── The two beats, both settled by the clinical-app audit (2026-09-21) ──────
 *
 * ⚠️ **Before a submit, the hint says which chart this lands in — and it is
 * "no patient in CONTEXT", not "no id in the URL".** §1.8: under a live launch
 * every recorder opened by telling the clinician no patient was selected while
 * the write was attaching correctly to the launch patient. See the branch below.
 *
 * ⚠️ **After a submit, there is ONE next action and it is the pathway's.**
 * §4.6: the notice offered "View in chart" and, on one recorder, a second link
 * beside it, and a filler offered its mapper's per-instrument suggestion next
 * to that — three answers to "and now what". `NextStep` is the one answer,
 * from the same `evaluatePathway` the chart's landing card renders.
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
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePatient } from '../context/PatientContext'
import { useSurfaceLinks } from '../context/SurfaceLinksContext'
import { usePageHeaderOwner } from '../context/PageHeaderOwnerContext'
import { useTrail } from '../context/useTrail'
import { CodeDrawer } from './CodeDrawer'
import { FhirJsonViewer } from './FhirJsonViewer'
import { NextStep } from './NextStep'
import { PageHeader } from '@spier/ui/PageHeader'
import { Notice } from '@spier/ui/Notice'
import type { PathwayRecord } from '@spier/core/lib/pathwayEvaluation'
import type {
  CarePlanResource,
  CommunicationResource,
  EpisodeOfCareResource,
  FhirResource,
  ObservationResource,
  ProcedureResource,
  QuestionnaireResponseResource,
} from '@spier/core/types/fhir'
import '../css/WorkflowForm.css'

/**
 * What a recorder just wrote, as the record the pathway evaluator reads.
 *
 * Only the buckets `evaluatePathway` consults are routed — a ServiceRequest, a
 * Consent or a Task changes nothing it asks, so folding them in would be
 * ceremony. Every recorder passes what it wrote all the same: which resource
 * kinds the protocol reads is the EVALUATOR's business and it has already
 * changed once, and a recorder that opted out on today's answer is a recorder
 * that silently shows the wrong next step the day the answer moves.
 */
function pendingRecord(written: FhirResource[]): PathwayRecord | undefined {
  if (written.length === 0) return undefined
  const record: PathwayRecord = {}
  for (const resource of written) {
    switch (resource.resourceType) {
      case 'QuestionnaireResponse':
        record.responses = [
          ...(record.responses ?? []),
          {
            id: String(resource.id ?? ''),
            questionnaireName: '',
            completedAt: new Date().toISOString(),
            resource: resource as QuestionnaireResponseResource,
          },
        ]
        break
      case 'Observation':
        record.observations = [...(record.observations ?? []), resource as ObservationResource]
        break
      case 'CarePlan':
        record.carePlans = [...(record.carePlans ?? []), resource as CarePlanResource]
        break
      case 'Communication':
        record.communications = [...(record.communications ?? []), resource as CommunicationResource]
        break
      case 'Procedure':
        record.procedures = [...(record.procedures ?? []), resource as ProcedureResource]
        break
      case 'EpisodeOfCare':
        record.episodes = [...(record.episodes ?? []), resource as EpisodeOfCareResource]
        break
      default:
        break
    }
  }
  return record
}

export function WorkflowForm({
  title,
  lede,
  fhirNote,
  draft,
  draftTitle,
  notice,
  justRecorded,
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
  /**
   * Set after a successful submit; rendered above the confirmation beat — one
   * next action and one way back (`NextStep`, clinical-app audit §4.6).
   */
  notice?: ReactNode
  /**
   * The resources this recorder just wrote, so the beat's next action is
   * computed from the chart INCLUDING them rather than from the chart as it
   * was a round trip ago. See `pendingRecord` above for why every recorder
   * passes this and not only the three whose output the protocol reads today.
   */
  justRecorded?: FhirResource[]
  /** What is already on the chart — a `RecordedList` or two — rendered after the notice. */
  recorded?: ReactNode
  children: ReactNode
}) {
  // ⚠️ **"No patient in context", not "no id in the URL".** Under a SMART
  // launch the chart is the launch patient's and `activePatientId` — which is
  // read off the route — is null, so this frame opened every recorder with
  // *"No patient selected — this will be recorded in the scratch chart"* while
  // `SmartDataSource` was correctly resolving the launch patient and writing to
  // their chart (clinical-app audit §1.8). The notice was false, not the data.
  //
  // The three cases, and only the first is a scratch chart:
  //
  //   no session, no id     the demo's "play with the forms" state — the write
  //                         lands in the scratch chart, which is what this says
  //   a session with a      the launch patient IS the patient in context; the
  //   patient               write attaches to them and there is nothing to say
  //   a session with NO     a worklist launch, which has a server and no chart:
  //   patient               the write has nowhere to land and will fail, so the
  //                         honest line is that one rather than the scratch one
  const { activePatientId, isSmartSession, isSmartConnected } = usePatient()
  const patientState = isSmartSession
    ? (isSmartConnected ? 'in-context' : 'launch-without-patient')
    : (activePatientId === null ? 'scratch' : 'in-context')
  const pending = useMemo(() => pendingRecord(justRecorded ?? []), [justRecorded])
  // The chart, the caseload and this page's parent are the SURFACE's routes,
  // not this frame's: the clinical app has all three, the guide has only the
  // parent (Tools). See SurfaceLinksContext for the dead links this replaced.
  const links = useSurfaceLinks()
  // On the clinician's routes this frame IS the page and draws the header. On
  // the guide's tool page the page has drawn one naming the tool, so the frame
  // draws none — and keeps the lede, which is the clinician's sentence about
  // what the form records, inside the card instead (PageHeaderOwnerContext).
  const ownsHeader = usePageHeaderOwner() === 'view'
  const trail = useTrail()
  return (
    <div className="form-view">
      {/* ⚠️ A TRAIL, not a pill with a back arrow (Brad, 2026-09-22). The
          eyebrow read `← PATIENT CHART` and the word "Workflow" after it, which
          named the kind of page rather than where it sits; `Care pathway /
          Step 4` says both, and each segment resolves. The pill style went with
          the arrow — it is the website's drill-in badge and a badge containing a
          three-segment trail reads as neither. */}
      {ownsHeader && <PageHeader eyebrow={trail} title={title} lede={lede} />}

      <div className="form-wrapper">
        <div className="form-card">
          {!ownsHeader && <p className="workflow-form__lede">{lede}</p>}
          {patientState === 'scratch' && (
            <WorkflowHint>
              No patient selected — this will be recorded in the scratch chart.
              {links.registryHref && (
                <>
                  {' '}
                  Pick a patient from the <Link to={links.registryHref}>caseload</Link> to attach it to a
                  specific record.
                </>
              )}
            </WorkflowHint>
          )}
          {patientState === 'launch-without-patient' && (
            <WorkflowHint>
              This session was opened without a patient, so there is no chart to record against.
              Open a patient first.
            </WorkflowHint>
          )}

          {children}

          {/* ⚠️ **One action, and it is the pathway's.** The notice used to
              carry "View in chart" and, on one recorder, a second link beside
              it; §4.6 makes the beat after a submit the same shape everywhere —
              what was recorded, then one next step and one way back. */}
          {notice && (
            <WorkflowNotice>
              {notice}
              <NextStep pending={pending} />
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
