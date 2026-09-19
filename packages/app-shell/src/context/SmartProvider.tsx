import React, { useState, useEffect, useCallback, useMemo } from 'react'
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

    /**
     * ⚠️ **`useCallback` and `useMemo` here are load-bearing, not hygiene.**
     *
     * These were plain functions in a fresh object literal, so every render of
     * this provider handed consumers new identities. `SmartRedirect` lists
     * `setSmartData` in its effect's dependency array — as the lint rule
     * requires — so the chain was: effect runs → `setSmartData` → this provider
     * re-renders → new function identity → dependencies changed → **the effect
     * runs again.**
     *
     * That is an infinite loop and it reached production. On the deployed
     * worklist launch it pushed **20,464 history entries in four seconds** until
     * Chrome's IPC-flooding protection intervened, leaving the user on
     * "Connected. Opening the caseload…" indefinitely while the URL already read
     * `#/population/caseload`.
     *
     * ⚠️ It was almost certainly looping on the CHART launch too, for as long as
     * this code has existed — just invisibly, because that branch navigates away
     * after 500ms, which unmounts `SmartRedirect` and ends the loop before anyone
     * sees it. The tell was there and was misread as a dev-mode artifact:
     * `/token` answering *"This authorization code has already been redeemed"*
     * was this loop redeeming it twice, not React StrictMode double-invoking an
     * effect.
     */
    const setSmartData = useCallback(
        (newClient: Client, newPatient: SmartPatientSummary) => {
            setClient(newClient)
            setPatient(newPatient)
            setContextError(null)
        },
        [],
    )

    const setError = useCallback((err: Error) => {
        setContextError(err)
    }, [])

    // The value object too: a new literal on every render defeats the callbacks'
    // stability for any consumer that depends on the context object itself.
    const value = useMemo(
        () => ({ client, patient, error, setSmartData, setError }),
        [client, patient, error, setSmartData, setError],
    )

    return <SmartContext.Provider value={value}>{children}</SmartContext.Provider>
}
