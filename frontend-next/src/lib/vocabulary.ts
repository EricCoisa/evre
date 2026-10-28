/** Valor de enum → chave do namespace i18n `vocabulary`. Quem traduz é o chamador, com `t()`. */

export const PROPOSAL_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'LOST'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PUBLICATION_STATES = ['ACTIVE', 'EXPIRED', 'REVOKED', 'NONE'] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

/** Chave do rótulo de um estado de proposta; valor fora do enum cai em `proposalStatus.UNKNOWN`. */
export function proposalStatusLabelKey(status: string): string {
  return PROPOSAL_STATUSES.includes(status as ProposalStatus)
    ? `proposalStatus.${status}`
    : 'proposalStatus.UNKNOWN';
}

/** Chave do rótulo de um estado de publicação; valor fora do enum cai em `publication.UNKNOWN`. */
export function publicationStateLabelKey(state: string): string {
  return PUBLICATION_STATES.includes(state as PublicationState)
    ? `publication.${state}`
    : 'publication.UNKNOWN';
}
