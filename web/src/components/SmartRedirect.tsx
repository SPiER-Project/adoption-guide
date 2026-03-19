import { useEffect, useState } from 'react';
import FHIR from 'fhirclient';
import { useNavigate } from 'react-router-dom';
import { useSmart } from '../context/SmartContext';

export function SmartRedirect() {
    const [status, setStatus] = useState<string>('Initializing SMART on FHIR client...');
    const [error, setError] = useState<string | null>(null);
    const { setSmartData } = useSmart();
    const navigate = useNavigate();

    useEffect(() => {
        // This function completes the SMART on FHIR launch sequence
        // by exchanging the authorization code for an access token
        FHIR.oauth2
            .ready()
            .then(async (client) => {
                setStatus('Client authenticated. Fetching patient context...');

                try {
                    // If a patient is in context (from EHR launch params), fetch their basic demographics
                    if (client.patient.id) {
                        const patientData = await client.patient.read();

                        // Format some basic info for display
                        const name = patientData.name?.[0];
                        const formattedName = name
                            ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
                            : 'Unknown Name';

                        setSmartData(client, {
                            id: patientData.id,
                            name: formattedName,
                            dob: patientData.birthDate,
                            gender: patientData.gender,
                        });

                        setStatus('Patient data loaded. Redirecting...');

                        // Everything is ready, route the user back to the main app dashboard
                        // Give them a brief moment to see success before redirecting
                        setTimeout(() => {
                            navigate('/');
                        }, 500);
                    } else {
                        // We authenticated, but no patient was in context
                        setSmartData(client, {});
                        navigate('/');
                    }
                } catch (fetchError) {
                    console.error("Error fetching patient data:", fetchError);
                    setError("Authorized successfully, but failed to fetch patient details.");
                }
            })
            .catch((err) => {
                console.error('SMART Ready Error:', err);
                setError(err.message || 'Failed to complete SMART on FHIR authorization.');
            });
    }, [navigate, setSmartData]);

    if (error) {
        return (
            <div className="smart-error" style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ color: '#d32f2f' }}>Authorization Error</h2>
                <p>{error}</p>
                <button
                    onClick={() => navigate('/')}
                    style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
                >
                    Return to Tools
                </button>
            </div>
        );
    }

    return (
        <div className="smart-loading" style={{ padding: '4rem', textAlign: 'center' }}>
            <div className="spinner" style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
            <h2>{status}</h2>
            <p>Securely connecting to electronic health record...</p>
        </div>
    );
}
