import { useEffect, useState } from 'react';
import FHIR from 'fhirclient';

export function SmartLaunch() {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initiate the SMART on FHIR OAuth2 authorization sequence.
        // This will redirect the browser to the EHR's authorization endpoint.
        FHIR.oauth2
            .authorize({
                // The client_id is typically registered with the EHR.
                // For the SMART Launcher, it can be anything if we don't specify one in the launch params.
                client_id: 'spier-client',

                // The scopes we are requesting access to.
                // launch: required for EHR launch
                // patient/*.read: read-only access to the current patient's records
                // profile openid: request basic demographic info
                scope: 'launch patient/*.read profile openid',

                // Where the EHR should redirect back to after authorization.
                // This should match the route for SmartRedirect.tsx
                redirectUri: '/redirect',
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
