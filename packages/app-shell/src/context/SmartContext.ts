import { createContext, useContext } from 'react'
import type Client from 'fhirclient/lib/Client'
import type { SmartPatientSummary } from '../lib/smartPatient'

// The SMART context object and its hook. Deliberately NOT a .tsx and holding no
// component: React Fast Refresh only preserves state for a module whose exports
// are all components, so pairing this hook with SmartProvider made that module
// incompatible and every edit to it reset the SMART session state below it.
// The provider lives in SmartProvider.tsx. See ToolConfigContext.ts for the same
// split.

export interface SmartContextType {
    client: Client | null;
    patient: SmartPatientSummary | null;
    error: Error | null;
    setSmartData: (client: Client, patient: SmartPatientSummary) => void;
    setError: (error: Error) => void;
}

export const SmartContext = createContext<SmartContextType | undefined>(undefined)

export function useSmart() {
    const context = useContext(SmartContext)
    if (context === undefined) {
        throw new Error('useSmart must be used within a SmartProvider')
    }
    return context
}
