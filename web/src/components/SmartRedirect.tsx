import { useEffect, useState } from 'react'
import FHIR from 'fhirclient'
import { useNavigate } from 'react-router-dom'
import { useSmart } from '../context/SmartContext'
import { usePresentation } from '../context/PresentationContext'
import { readSmartPatientSummary } from '../lib/smartPatient'
import { launchPathForIntent } from '../lib/smartIntent'
import { configureFhircastHub } from '../lib/fhircast'

export function SmartRedirect() {
    const [status, setStatus] = useState<string>('Initializing SMART on FHIR client...')
    const [error, setError] = useState<string | null>(null)
    const { setSmartData } = useSmart()
    const { setHostDrawsPatientBanner } = usePresentation()
    const navigate = useNavigate()

    useEffect(() => {
        // This function completes the SMART on FHIR launch sequence
        // by exchanging the authorization code for an access token
        FHIR.oauth2
            .ready()
            .then(async (client) => {
                setStatus('Client authenticated. Fetching patient context...')

                try {
                    // If a patient is in context (from EHR launch params), fetch their basic demographics
                    if (client.patient.id) {
                        const summary = await readSmartPatientSummary(client)
                        setSmartData(client, summary)

                        // ── The two launch-context parameters the host can send ──
                        // Both live on the raw token response, which is where
                        // SMART puts launch context, and both are optional: a
                        // host that sends neither gets the panel's own banner and
                        // the pathway overview.
                        const tokenResponse = (client.state.tokenResponse ?? {}) as {
                            need_patient_banner?: unknown
                            intent?: unknown
                            'hub.url'?: unknown
                            'hub.topic'?: unknown
                        }
                        // Only an explicit `false` suppresses our strip. Absent
                        // means "app decides", and the app's answer is to name the
                        // patient.
                        if (tokenResponse.need_patient_banner === false) {
                            setHostDrawsPatientBanner(true)
                        }

                        // A DIRECTED launch: `intent` names the tool to open, so
                        // land there instead of the overview. An intent this
                        // build does not recognize resolves to null and falls
                        // through to the chart — the host is a different system
                        // on a different release cycle, and "open something I
                        // have never heard of" must not be a dead end.
                        const directed = typeof tokenResponse.intent === 'string'
                            ? launchPathForIntent(tokenResponse.intent)
                            : null

                        // ── FHIRcast (step 6) ────────────────────────────
                        // The EHR tells us where its hub is and which session
                        // topic we are in; subscribing is how context crosses
                        // the origin boundary between the host chart and this
                        // panel. Best-effort on purpose: a hub that refuses or
                        // is unreachable leaves the app on its same-origin
                        // BroadcastChannel simulation, which is a degraded
                        // demo rather than a broken chart.
                        const hubUrl = tokenResponse['hub.url']
                        const hubTopic = tokenResponse['hub.topic']
                        if (typeof hubUrl === 'string' && hubUrl && typeof hubTopic === 'string' && hubTopic) {
                            await configureFhircastHub({ url: hubUrl, topic: hubTopic })
                        }

                        setStatus('Patient data loaded. Redirecting...')

                        // Land on the patient chart — a SMART launch carries a
                        // patient context, so the chart (which now reads live
                        // EHR data via SmartDataSource) is the destination.
                        // Give the user a brief moment to see success first.
                        setTimeout(() => {
                            navigate(directed ?? '/patient/chart')
                        }, 500)
                    } else {
                        // We authenticated, but no patient was in context
                        setSmartData(client, {})
                        navigate('/')
                    }
                } catch (fetchError) {
                    console.error('Error fetching patient data:', fetchError)
                    setError('Authorized successfully, but failed to fetch patient details.')
                }
            })
            .catch((err) => {
                console.error('SMART Ready Error:', err)
                setError(err.message || 'Failed to complete SMART on FHIR authorization.')
            })
    }, [navigate, setSmartData, setHostDrawsPatientBanner])

    if (error) {
        return (
            <div className="smart-error" style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 className="smart-error-heading">Authorization Error</h2>
                <p>{error}</p>
                <button
                    onClick={() => navigate('/')}
                    style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
                >
                    Return to Tools
                </button>
            </div>
        )
    }

    return (
        <div className="smart-loading" style={{ padding: '4rem', textAlign: 'center' }}>
            <div className="spinner" style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
            <h2>{status}</h2>
            <p>Securely connecting to electronic health record...</p>
        </div>
    )
}
