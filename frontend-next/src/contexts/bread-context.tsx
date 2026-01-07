
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

// // Hook automatizado para atualizar o breadcrumb sem lógica no componente
// export function useAutoBread<T>(idUser: string) {
//         const { setItem, items } = useBread();
//     const pathname = usePathname();

//     const segments = pathname
//         .split("/")
//         .filter((seg) => seg && seg !== "private");

//     const penultimate = segments.length > 1 ? segments[segments.length - 2] : null;

//     const route = RoutePagesList.find(r => r.path === penultimate);

//     const nullcast: RoutePageQuery<T> = ({
//         queryKey: () => ["null", "null"],
//         queryFn: () => nullFunction(),
//     })
//     // Se não tiver rota correspondente, não faz nada
//     const queryConfig = route?.getBreadName() ?? nullcast
//     // Agora sim: chamamos a query aqui, de forma segura
//     const query = useQuery<T>({
//         queryKey: queryConfig ? (queryConfig.queryKey(idUser) as readonly unknown[]) : [],
//         queryFn: queryConfig
//             ? (async () => await queryConfig.queryFn(idUser) as T)
//             : undefined,
//         enabled: !!queryConfig, // só executa se a rota existir
//     });

//         React.useEffect(() => {
//             const newValue = route && query.data && query.data[route?.key as keyof T] ? String(query.data[route?.key as keyof T]) : null;
//             if (newValue !== items) {
//                 setItem(newValue);
//             }
//         }, [route, query.data, setItem, items]);

//     return query; // opcional: caso queira usar no componente
// }

