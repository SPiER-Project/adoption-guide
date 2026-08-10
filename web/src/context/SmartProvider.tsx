import React, { useState, useEffect } from 'react'
import FHIR from 'fhirclient'
import type Client from 'fhirclient/lib/Client'
import { readSmartPatientSummary, type SmartPatientSummary } from '../lib/smartPatient'
import { SmartContext } from './SmartContext'

// Provider only, so this module is component-only and Fast Refresh works. The
// context object and the useSmart hook live in SmartContext.ts.

export function SmartProvider({ children }: { children: React.ReactNode }) {
    const [client, setClient] = useState<Client | null>(null)
    const [patient, setPatient] = useState<SmartPatientSummary | null>(null)
    const [error, setContextError] = useState<Error | null>(null)

    useEffect(() => {
        // Rehydrate an active SMART session after a full page reload.
        // fhirclient keeps its OAuth state in sessionStorage (keyed by
        // SMART_KEY); without this, a reload would silently drop the app back
        // to local demo mode while still showing chart routes — a confusing
        // (and clinically risky) patient-context switch. Skipped on the
        // redirect screen, which owns the initial ready() exchange.
        if (client) return
        if (window.location.hash.startsWith('#/redirect')) return
        if (!window.sessionStorage.getItem('SMART_KEY')) return
        let cancelled = false
        FHIR.oauth2
            .ready()
            .then(async (rehydrated) => {
                if (cancelled) return
                const summary = await readSmartPatientSummary(rehydrated)
                if (cancelled) return
                setClient(rehydrated)
                setPatient(summary)
            })
            .catch(() => {
                // Stale or expired session state — stay in local demo mode.
            })
        return () => {
            cancelled = true
        }
    }, [client])

    const setSmartData = (newClient: Client, newPatient: SmartPatientSummary) => {
        setClient(newClient)
        setPatient(newPatient)
        setContextError(null)
    }

    const setError = (err: Error) => {
        setContextError(err)
    }

    return (
        <SmartContext.Provider value={{ client, patient, error, setSmartData, setError }}>
            {children}
        </SmartContext.Provider>
    )
}
