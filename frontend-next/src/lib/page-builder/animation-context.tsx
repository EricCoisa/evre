'use client';

import React from 'react';
import type { BlockAnimation } from './animation';

/** Padrão de animação da página (`layout.animation`), disponível para todo `Block` descendente
 * sem precisar atravessar `BlockContent`/`BlockBody`/`BlockChildren` como prop — mesmo papel que
 * `page-render-context.tsx` já cumpre para `proposalTerms`. */
const LayoutAnimationContext = React.createContext<BlockAnimation | undefined>(undefined);

export function LayoutAnimationProvider({
  animation,
  children,
}: {
  animation?: BlockAnimation;
  children: React.ReactNode;
}) {
  return (
    <LayoutAnimationContext.Provider value={animation}>{children}</LayoutAnimationContext.Provider>
  );
}

/** `undefined` fora de um `LayoutAnimationProvider` — mesmo efeito de não ter padrão de página. */
export function useLayoutAnimation(): BlockAnimation | undefined {
  return React.useContext(LayoutAnimationContext);
}
