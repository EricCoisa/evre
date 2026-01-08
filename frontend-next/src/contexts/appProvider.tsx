'use client';

import { DevTools } from '@/components/devTools';
import { ReactScan } from '@/components/ui/reactScan';
import { isDevelopment } from '@/lib/utils';
import React, { createContext, useContext, useState } from 'react';
import { Toaster } from 'sonner';


interface AppContextData {
    devTools: boolean;
    setDevTools: React.Dispatch<React.SetStateAction<boolean>>;
    reactScan: boolean;
    setReactScan: React.Dispatch<React.SetStateAction<boolean>>;
    emulateError: boolean;
    setEmulateError: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppContext = createContext<AppContextData | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [reactScan, setReactScan] = useState(false);
    const [devTools, setDevTools] = useState(false);
    const [emulateError, setEmulateError] = useState(false);

    return (
        <AppContext.Provider
            value={{
                reactScan,
                setReactScan,
                devTools,
                setDevTools,
                emulateError,
                setEmulateError
            }}
        >
            <>
                {isDevelopment() &&<><ReactScan enabled={reactScan} /><DevTools /></>}
                {children}
            </>
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
