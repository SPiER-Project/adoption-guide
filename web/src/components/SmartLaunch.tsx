import { useEffect, useState } from 'react';
import FHIR from 'fhirclient';

export function SmartLaunch() {
    const [error, setError] = useState<string | null>(null);

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
                ].join(' '),

                // OAuth redirect URIs cannot carry hash fragments, and GitHub
                // Pages serves no path other than the app base — so redirect
                // to the base and let the main.tsx bootstrap route ?code&state
                // into the #/redirect screen. fhirclient resolves this
                // relative path against the current origin.
                redirectUri: import.meta.env.BASE_URL,
            })
            .catch((err) => {
                console.error('FHIR OAuth2 Authorize Error:', err);
                setError(err.message || 'An error occurred during SMART launch.');
            });
    }, []);

    if (error) {
        return (
            <div className="smart-error">
                <h2>Launch Error</h2>
                <p>{error}</p>
            </div>
        );
    }

    // The fhirclient library handles the redirect immediately,
    // so this UI is typically only visible for a split second.
    return (
        <div className="smart-loading">
            <h2>Redirecting to EHR...</h2>
            <p>Please wait while we establish a secure connection.</p>
        </div>
    );
}
