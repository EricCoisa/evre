'use client';

import React from 'react';
import type { ProposalRecurrence } from '@/lib/actions/proposal/types';

/** Contexto de renderização da página. `published` é o sinal que o bloco `iframe` usa pra
 * saber se está desenhando o rascunho (prop = id interno do artifact) ou a versão publicada
 * (prop = publicToken). */
export interface PageRenderContext {
  totalCents: number | null;
  currency: string;
  recurrence: ProposalRecurrence;
  termDays: number | null;
  validUntil: string | null;
  includedItems: string[];
  optionalItems: string[];
  published: boolean;
}

const PageRenderContextReact = React.createContext<PageRenderContext | undefined>(undefined);

/** Monta o envelope para os blocos descendentes lerem. `dashboard` nunca usa este provider. */
export function PageRenderContextProvider({
  terms,
  children,
}: {
  terms: PageRenderContext;
  children: React.ReactNode;
}) {
  return (
    <PageRenderContextReact.Provider value={terms}>{children}</PageRenderContextReact.Provider>
  );
}

/** `undefined` fora de um `PageRenderContextProvider`. */
export function usePageRenderContext(): PageRenderContext | undefined {
  return React.useContext(PageRenderContextReact);
}
