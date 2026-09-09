import { useEffect, useState } from 'react'
import FHIR from 'fhirclient'

export function SmartLaunch() {
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Initiate the SMART on FHIR OAuth2 authorization sequence.
        // This will redirect the browser to the EHR's authorization endpoint.
        // The `iss` and `launch` values are read by fhirclient from the real
        // query string (see the bootstrap in main.tsx, which routes them here
        // from the app base URL under the hash router).
        FHIR.oauth2
            .authorize({
                // The client_id is typically registered with the EHR.
                // For the SMART Launcher, it can be anything if we don't specify one in the launch params.
                client_id: 'spier-client',

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
                    // Writeback ladder: Tier 0 (DocumentReference floor) and
                    // Tier 3 (opt-in Condition proposal). Requesting Condition
                    // write is harmless — the tier stays OFF by default and a
                    // human must confirm before any Condition is created.
                    'patient/DocumentReference.write',
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
            .catch((err) => {
                console.error('FHIR OAuth2 Authorize Error:', err)
                setError(err.message || 'An error occurred during SMART launch.')
            })
    }, [])

    if (error) {
        return (
            <div className="smart-error">
                <h2>Launch Error</h2>
                <p>{error}</p>
            </div>
        )
    }

    // The fhirclient library handles the redirect immediately,
    // so this UI is typically only visible for a split second.
    return (
        <div className="smart-loading">
            <h2>Redirecting to EHR...</h2>
            <p>Please wait while we establish a secure connection.</p>
        </div>
    )
}
