import React, { createContext, useContext, useState, useEffect } from 'react';
import type Client from 'fhirclient/lib/Client';

interface Patient {
    name?: string;
    dob?: string;
    [key: string]: unknown;
}

interface SmartContextType {
    client: Client | null;
    patient: Patient | null;
    error: Error | null;
    setSmartData: (client: Client, patient: Patient) => void;
    setError: (error: Error) => void;
}

const SmartContext = createContext<SmartContextType | undefined>(undefined);

export function SmartProvider({ children }: { children: React.ReactNode }) {
    const [client, setClient] = useState<Client | null>(null);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [error, setContextError] = useState<Error | null>(null);

    useEffect(() => {
        // Attempt to load from sessionStorage if available (simulating persistent session)
        // The fhirclient library handles its own state in sessionStorage, we're just
        // caching our parsed data for component re-renders.
    }, []);

    const setSmartData = (newClient: Client, newPatient: Patient) => {
        setClient(newClient);
        setPatient(newPatient);
        setContextError(null);
    };

    const setError = (err: Error) => {
        setContextError(err);
    };

    return (
        <SmartContext.Provider value={{ client, patient, error, setSmartData, setError }}>
            {children}
        </SmartContext.Provider>
    );
}

// Hook co-located with its provider by design (idiomatic context module).
// eslint-disable-next-line react-refresh/only-export-components
export function useSmart() {
    const context = useContext(SmartContext);
    if (context === undefined) {
        throw new Error('useSmart must be used within a SmartProvider');
    }
    return context;
}
