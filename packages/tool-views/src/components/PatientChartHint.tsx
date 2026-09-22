/**
 * Which chart a submit will land in — one sentence, written once, for the 18
 * fillers and the 11 recorders alike.
 *
 * ── Why this is a component and not two copies ──────────────────────────────
 *
 * ⚠️ **The question is "is there a patient in CONTEXT", not "is there an id in
 * the URL".** `WorkflowForm` keyed this on `activePatientId`, which is read off
 * the route, so under a live launch — where the patient comes from the launch
 * context and the route carries no id — every recorder opened by telling the
 * clinician *"No patient selected"* while `SmartDataSource` was correctly
 * writing to that patient's chart (clinical-app audit §1.8). There are three
 * answers and the old code had two:
 *
 *   no session, no id     the demo's "play with the forms" state — the write
 *                         lands in the scratch chart, which is what this says
 *   a session with a      the launch patient IS the patient in context; the
 *   patient               write attaches to them and there is nothing to say
 *   a session with NO     a worklist launch, which has a server and no chart:
 *   patient               the write has nowhere to land and will fail, so the
 *                         honest line is that one rather than the scratch one
 *
 * It lived inside `WorkflowForm` until the fillers needed it too. A filler's
 * writeback is now an explicit act — the clinician presses *Save to the chart*
 * on the results screen rather than having the submit write on their behalf
 * (`QuestionnaireView`) — so the screen carrying that button has to say which
 * chart, and a second copy of a three-branch rule beside the words that explain
 * it is exactly the drift CLAUDE.md's hand-duplicated-helpers rule is about.
 */
import { Link } from 'react-router-dom'
import { Notice } from '@spier/ui/Notice'
import { usePatient } from '../context/PatientContext'
import { useSurfaceLinks } from '../context/SurfaceLinksContext'

/**
 * The three cases above; only the first is a scratch chart.
 *
 * ⚠️ Neither this nor the hook below is exported, and not for tidiness: this
 * module's only export has to be a component or React Fast Refresh stops
 * preserving state for it — which is the same constraint that keeps
 * `PatientContext` out of `PatientProvider.tsx`. A caller that needs the state
 * without the words should take this file's hook to its own module rather than
 * widen this one's surface.
 */
type PatientChartState = 'in-context' | 'scratch' | 'launch-without-patient'

function usePatientChartState(): PatientChartState {
  const { activePatientId, isSmartSession, isSmartConnected } = usePatient()
  if (isSmartSession) return isSmartConnected ? 'in-context' : 'launch-without-patient'
  return activePatientId === null ? 'scratch' : 'in-context'
}

/** Nothing at all when a patient is in context — the write attaches to them. */
export function PatientChartHint() {
  const state = usePatientChartState()
  // The caseload is the SURFACE's route: the clinical app has one, the guide
  // does not, and a shared view holds no route literal (SurfaceLinksContext).
  const links = useSurfaceLinks()

  if (state === 'in-context') return null

  if (state === 'launch-without-patient') {
    return (
      <Notice tone="info">
        This session was opened without a patient, so there is no chart to record against. Open a
        patient first.
      </Notice>
    )
  }

  return (
    <Notice tone="info">
      No patient selected — this will be recorded in the scratch chart.
      {links.registryHref && (
        <>
          {' '}
          Pick a patient from the <Link to={links.registryHref}>caseload</Link> to attach it to a
          specific record.
        </>
      )}
    </Notice>
  )
}
