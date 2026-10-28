
"use client";

import React, { createContext, useContext, useState } from "react";

export type BreadContextType = {
    items: string | null;
    setItem: React.Dispatch<React.SetStateAction<string | null>>;
};

const BreadContext = createContext<BreadContextType | undefined>(undefined);

export const BreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItem] = useState<string | null>(null);
    return (
        <BreadContext.Provider value={{ items, setItem }}>
            {children}
        </BreadContext.Provider>
    );
};

export function useBread() {
    const context = useContext(BreadContext);

    if (!context) throw new Error("useBread must be used within a BreadProvider");
    return context;
}

