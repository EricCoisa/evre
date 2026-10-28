'use client';

import { useCMS } from '@/contexts/cms-context';
import { ReactNode } from 'react';

export function CMSLayoutWrapper({ children }: { children: ReactNode }) {
    const { isCMSPage } = useCMS();

    // Se for página CMS, usa layout especial sem padding/gap
    if (isCMSPage) {
        return (
            <main className="flex-1 flex flex-col gap-6">
                <div className="flex-1">
                    {children}
                </div>
            </main>
        );
    }

    // Layout padrão para outras páginas
    return (
        <>

            <main className="flex-1 flex flex-col gap-2 sm:gap-4 lg:gap-6 p-2 sm:p-4 lg:p-6">
               
                <div className="flex-1">
                    {children}
                </div>
            </main>
        </>
    );
}
