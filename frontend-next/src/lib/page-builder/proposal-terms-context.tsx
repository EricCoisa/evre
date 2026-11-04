'use client';

import React from 'react';

/** Espelha `ProposalRecurrence` do backend (`prisma/schema/proposal.prisma`). */
export type ProposalRecurrence = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

/** Contexto de renderização da proposta. O bloco `investment` lê o envelope comercial por aqui,
 * nunca por props — se o preço morasse nas props, layout e envelope teriam duas verdades que
 * podem divergir. `published` é o sinal que o bloco `iframe` usa pra saber se está desenhando o
 * rascunho (prop = id interno do artifact) ou a versão publicada (prop = publicToken). */
export interface ProposalTerms {
  totalCents: number | null;
  currency: string;
  recurrence: ProposalRecurrence;
  termDays: number | null;
  validUntil: string | null;
  includedItems: string[];
  optionalItems: string[];
  published: boolean;
}

const ProposalTermsContext = React.createContext<ProposalTerms | undefined>(undefined);

/** Monta o envelope para os blocos descendentes lerem. `dashboard` nunca usa este provider. */
export function ProposalTermsProvider({
  terms,
  children,
}: {
  terms: ProposalTerms;
  children: React.ReactNode;
}) {
  return (
    <ProposalTermsContext.Provider value={terms}>{children}</ProposalTermsContext.Provider>
  );
}

/** `undefined` fora de um `ProposalTermsProvider` — o bloco `investment` trata isso como estado
 * vazio; o bloco `iframe` (consumidor de `published`) só é montado dentro de profiles que já
 * passam `proposalTerms`, então nunca lê `undefined` na prática. */
export function useProposalTerms(): ProposalTerms | undefined {
  return React.useContext(ProposalTermsContext);
}
