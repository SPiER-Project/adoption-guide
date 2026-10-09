import { useEffect, useState, type ReactNode } from 'react'
import FHIR from 'fhirclient/browser'
import { toSmartLaunchFailure, type SmartLaunchFailure, type SmartLaunchFailureKind } from '@spier/core/lib/smartLaunchFailure'

import { clientIdForIssuer } from '../lib/smartClients'

export function SmartLaunch() {
    const [error, setError] = useState<SmartLaunchFailure | null>(null)

    useEffect(() => {
        // Initiate the SMART on FHIR OAuth2 authorization sequence.
        // This will redirect the browser to the EHR's authorization endpoint.
        // The `iss` and `launch` values are read by fhirclient from the real
        // query string (see the bootstrap in main.tsx, which routes them here
        // from the app base URL under the hash router).
        FHIR.oauth2
            .authorize({
                // Registered per EHR — see lib/smartClients. The `iss` the
                // host sent names the server whose registration applies; an
                // unknown one falls back to the mock EHR's literal, so every
                // existing launch is unchanged.
                client_id: clientIdForIssuer(
                    new URLSearchParams(window.location.search).get('iss'),
                ),

                // Read + write scopes for the chart's live data path
                // (SmartDataSource): read the patient's existing
                // QuestionnaireResponses / Observations / CarePlans /
                // Communications, and write back submitted assessments plus
                // their derived artifacts. Public client + PKCE (fhirclient
                // default) — fine for GitHub Pages, no backend.
                scope: [
                    'launch',
                    'openid',
                    'fhirUser',
                    'patient/Patient.read',
                    'patient/QuestionnaireResponse.read',
                    'patient/QuestionnaireResponse.write',
                    'patient/Observation.read',
                    'patient/Observation.write',
                    'patient/CarePlan.read',
                    'patient/CarePlan.write',
                    'patient/Communication.read',
                    'patient/Communication.write',

                    // ⚠️ **Stages 4–7: every one of these was READ and WRITTEN
                    // without a scope asking for it.** `getSlice` searches 13
                    // resource types and `saveArtifact` writes the same set;
                    // this list covered four of them. It survived because
                    // neither server SPiER had met enforces read scopes — the
                    // mock says so in its own README ("no read is refused for a
                    // missing scope. Do not describe this mock as proving SMART
                    // scopes work") and Medplum granted the blanket
                    // `user/*.read` below, which covers the gap by accident.
                    //
                    // Against an EHR that grants what is asked for and enforces
                    // it, the reads fail SILENTLY — every one is wrapped in
                    // `.catch(() => [])` so the chart renders a patient with a
                    // thin record instead of a broken integration — and the
                    // writes fail loudly, after the clinician has filled the
                    // form in. `smartScopes.test.ts` now derives both sides
                    // from the code rather than trusting this list.
                    'patient/DocumentReference.read',
                    'patient/DocumentReference.write',
                    'patient/EpisodeOfCare.read',
                    'patient/EpisodeOfCare.write',
                    'patient/Flag.read',
                    'patient/Flag.write',
                    'patient/Task.read',
                    'patient/Task.write',
                    'patient/ServiceRequest.read',
                    'patient/ServiceRequest.write',
                    'patient/Appointment.read',
                    'patient/Appointment.write',
                    'patient/Consent.read',
                    'patient/Consent.write',
                    'patient/Procedure.read',
                    'patient/Procedure.write',
                    'patient/Encounter.read',
                    'patient/Encounter.write',

                    // CAMS Section B's suicide-driver Conditions, which the
                    // writeback sends with the Observations (Tier 2). Nothing
                    // else writes a Condition: the ladder's Tier-3 "Condition
                    // proposal" was retired (#639) — a screen never becomes a
                    // Condition. Write-only on purpose: nothing reads one back.
                    'patient/Condition.write',
                    // ⚠️ **The worklist scope, requested on EVERY launch, and
                    // that is deliberate.** SMART hands the app an opaque
                    // `launch` value: there is no way to tell a chart launch
                    // from a worklist launch (#401) before authorizing, so the
                    // app asks for the superset and the server narrows to the
                    // context it resolved. A chart launch is granted the
                    // `patient/…` half and has this DROPPED — see the mirror
                    // rules in the mock's `authorize`, without which a chart
                    // token would keep this and could read every patient on the
                    // server.
                    //
                    // Requesting it here rather than in a second code path is
                    // the same reasoning as one scope string: two launch
                    // initiations that differ only in scope is the drift this
                    // repo keeps writing gates against.
                    'user/*.read',
                ].join(' '),

                // OAuth redirect URIs cannot carry hash fragments, and GitHub
                // Pages serves no path other than the app base — so redirect
                // to the base and let the main.tsx bootstrap route ?code&state
                // into the #/redirect screen. fhirclient resolves this
                // relative path against the current origin.
                redirectUri: import.meta.env.BASE_URL,

                // ⚠️ Required for the embedded panel, and fhirclient asks for it
                // explicitly: launched inside an iframe with this unset, it logs
                // "please be explicit and provide a completeInTarget option" and
                // then INFERS `true` from being framed (smart.js — the default is
                // `inFrame`). Working by inference is not the same as working, and
                // the wrong value here fails in the least debuggable way: `false`
                // makes it `postMessage` the callback URL to `parent` with the
                // PANEL's origin as targetOrigin, which a cross-origin host frame
                // can never receive, so the launch hangs with no error.
                //
                // `true` — complete the authorization in the frame that started
                // it — is correct for a SMART activity embedded in a host chart,
                // and a no-op for the top-level launch (there is no parent or
                // opener to defer to). Observed as a console warning in the first
                // real iframe launch, panel step 5.
                completeInTarget: true,
            })
            .catch((err: unknown) => {
                // The raw error is for whoever maintains the deployment; the
                // page words its kind (see SmartLaunchErrorNotice).
                console.error('FHIR OAuth2 Authorize Error:', err)
                setError(toSmartLaunchFailure(err, 'authorize'))
            })
    }, [])

    if (error) return <SmartLaunchErrorNotice failure={error} />

    // The fhirclient library handles the redirect immediately,
    // so this UI is typically only visible for a split second.
    return (
        <p className="smart-loading" role="status">Redirecting to the EHR…</p>
    )
}

/** One entry per kind; `Record` makes a new kind a compile error until worded. */
const COPY: Record<SmartLaunchFailureKind, { title: string; body: string }> = {
  refused: {
    title: 'The EHR did not let this app open.',
    body: 'Open it again from the patient’s chart in the EHR. If this keeps happening, this app’s access has to be granted at your site.',
  },
  'not-launched': {
    title: 'This app was not opened from the EHR.',
    body: 'It opens from a patient’s chart or a worklist in the EHR. Go back to the EHR and open it from there.',
  },
  unreachable: {
    title: 'Could not reach the EHR.',
    body: 'The EHR did not answer. Check your connection, then open the app again from the EHR.',
  },
  'record-unread': {
    title: 'Could not read this patient’s details from the EHR.',
    body: 'You are signed in, but the patient’s name and details did not load. Open the app again from the patient’s chart.',
  },
  failed: {
    title: 'This app could not open.',
    body: 'Something went wrong while connecting to the EHR. Open it again from the EHR; if this keeps happening, tell whoever supports this app at your site.',
  },
}

/**
 * The launch and redirect pages' error state: opening the app from the EHR
 * failed, in a clinician's words.
 *
 * ⚠️ **It words the failure's `kind` and never prints its `detail`.** Until
 * 2026-10-07 `SmartLaunch` and `SmartRedirect` rendered `describeError(err)` —
 * fhirclient's "403 Forbidden\nURL: …/token" with the server's
 * `error_description` appended, "access_denied: …", "No 'state' parameter
 * found. Please (re)launch the app." — on the first screen a launched clinician
 * sees. `check:jargon` cannot see a message fhirclient builds at runtime, and
 * its clinical scan does not read this package anyway. The detail goes to the
 * console, where both pages already log the raw error;
 * `apps/clinical/src/pages/smartLaunchError.test.tsx` drives the real library.
 *
 * Here rather than in `apps/clinical` (where the chart's `DataSourceErrorNotice`
 * lives) because both apps mount `/launch` and `/redirect` from this package;
 * and in THIS file, which `SmartRedirect` imports it from, because
 * `check:template` lets a bare error page's `<h2>` stand only in a route
 * element outside the shell — it derives that set from the route tables, by
 * file name, so a separate module for the notice would be a page it governs.
 */
export function SmartLaunchErrorNotice({
  failure,
  children,
}: {
  failure: SmartLaunchFailure
  /** An action under the message, such as a way back. */
  children?: ReactNode
}) {
  const { title, body } = COPY[failure.kind]
  return (
    <div className="smart-error" role="alert">
      <h2 className="smart-error-heading">{title}</h2>
      <p>{body}</p>
      {children}
    </div>
  )
}
