import { useEffect, useState } from 'react'
import FHIR from 'fhirclient'
import { useNavigate } from 'react-router-dom'
import { useSmart } from '../context/SmartContext'
import { usePresentation } from '../context/PresentationContext'
import { readSmartPatientSummary } from '../lib/smartPatient'
import { launchPathForIntent } from '@spier/core/lib/smartIntent'
import { configureFhircastHub } from '@spier/core/lib/fhircast'

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
                    // ── The launch-context parameters the host can send ──────
                    //
                    // Both live on the raw token response, which is where SMART
                    // puts launch context, and all are optional: a host that sends
                    // none gets the panel's own banner and the pathway overview.
                    //
                    // ⚠️ **Read BEFORE the patient branch, because a worklist
                    // launch carries them too** — `intent` especially. The host's
                    // measures launch names a tool on a launch that has no chart.
                    // These were declared inside the patient branch until
                    // 2026-09-09, which is why the worklist branch below could not
                    // see `directed` and opened the caseload regardless of what
                    // the host had asked for.
                    const tokenResponse = (client.state.tokenResponse ?? {}) as {
                        need_patient_banner?: unknown
                        intent?: unknown
                        'hub.url'?: unknown
                        'hub.topic'?: unknown
                    }

                    // Only an explicit `false` suppresses our strip. Absent means
                    // "app decides", and the app's answer is to name the patient.
                    if (tokenResponse.need_patient_banner === false) {
                        setHostDrawsPatientBanner(true)
                    }

                    // A DIRECTED launch: `intent` names the tool to open, so land
                    // there instead of the default. An intent this build does not
                    // recognize resolves to null and falls through — the host is a
                    // different system on a different release cycle, and "open
                    // something I have never heard of" must not be a dead end.
                    const directed = typeof tokenResponse.intent === 'string'
                        ? launchPathForIntent(tokenResponse.intent)
                        : null

                    // If a patient is in context (from EHR launch params), fetch their basic demographics
                    if (client.patient.id) {
                        const summary = await readSmartPatientSummary(client)
                        setSmartData(client, summary)

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
                            navigate(directed ?? '/patient/record')
                        }, 500)
                    } else {
                        // ── Authenticated, and NO patient in context ──────────
                        //
                        // ⚠️ **This used to be the failure branch, and since #401
                        // it is also a success.** A worklist launch has no patient
                        // by design: the mock EHR mints a `userScoped` context and
                        // the token comes back with no `patient` at all. Sending
                        // that to `/` — written for "we authorized but something is
                        // wrong" — would drop a launched clinician on the front
                        // page with a live session they cannot see.
                        //
                        // The two cases are told apart by the GRANT, not by
                        // guessing: a worklist grant carries a `user/…` read
                        // scope, which is exactly the permission the server
                        // enforces for a cross-patient read (`mayCrossPatients`).
                        // A launch with neither a patient nor that scope really is
                        // broken, and still lands on `/`.
                        const scope = String(
                            (client.state.tokenResponse as { scope?: unknown } | undefined)?.scope ?? '',
                        )
                        const isWorklist = scope
                            .split(/\s+/)
                            .some(s => /^user\/[^.]+\.(read|\*)$/.test(s))

                        setSmartData(client, {})
                        if (isWorklist) {
                            setStatus('Connected. Opening the caseload...')
                            // ⚠️ **`directed` first, and it was missed the first
                            // time.** A worklist launch can name a tool too: the
                            // host's measures launch sends `intent: open-measures`,
                            // and this branch navigated to the caseload
                            // unconditionally — so that button would have opened
                            // the wrong page while looking like it worked. The
                            // patient branch below has always honoured `directed`;
                            // there was never a reason this one should not.
                            //
                            // The caseload is the fallback because a worklist
                            // session has no chart to open. `check:catalog` asserts
                            // that route is a PAGE rather than a redirect, so it
                            // cannot silently become one of the guide's explainers.
                            setTimeout(() => navigate(directed ?? '/population/caseload'), 500)
                        } else {
                            navigate('/')
                        }
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
