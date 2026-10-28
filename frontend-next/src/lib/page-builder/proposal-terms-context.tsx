'use client';

import React from 'react';

/** Espelha `ProposalRecurrence` do backend (`prisma/schema/proposal.prisma`). */
export type ProposalRecurrence = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

/** Envelope comercial de uma proposta. O bloco `investment` lê isto por contexto, nunca por props —
 * se o preço morasse nas props, layout e envelope teriam duas verdades que podem divergir. */
export interface ProposalTerms {
  totalCents: number | null;
  currency: string;
  recurrence: ProposalRecurrence;
  termDays: number | null;
  validUntil: string | null;
  includedItems: string[];
  optionalItems: string[];
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

// ponytail: único consumidor é o bloco `investment`. Generalizar para injeção de dado por
// profile quando aparecer o segundo contexto — não antes.
/** `undefined` fora de um `ProposalTermsProvider` — o bloco `investment` trata isso como estado vazio. */
export function useProposalTerms(): ProposalTerms | undefined {
  return React.useContext(ProposalTermsContext);
}
