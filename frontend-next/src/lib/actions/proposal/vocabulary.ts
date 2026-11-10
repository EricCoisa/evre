/** Valor de enum → chave do namespace i18n `vocabulary`. Quem traduz é o chamador, com `t()`. */

import type { VariantProps } from 'class-variance-authority';
import type { badgeVariants } from '@/components/ui/badge';

export const PROPOSAL_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'LOST'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PUBLICATION_STATES = ['ACTIVE', 'EXPIRED', 'REVOKED', 'NONE'] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export const SEND_CHANNELS = ['WHATSAPP', 'EMAIL', 'MANUAL'] as const;
export type SendChannel = (typeof SEND_CHANNELS)[number];

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

/** Chave do rótulo de um canal de envio; valor fora do enum cai em `sendChannel.UNKNOWN`. */
export function sendChannelLabelKey(channel: string): string {
  return SEND_CHANNELS.includes(channel as SendChannel)
    ? `sendChannel.${channel}`
    : 'sendChannel.UNKNOWN';
}

/** Variante do `Badge` por estado de publicação — consumida por toda tela que mostra `PublicationState`. */
export const PUBLICATION_STATE_BADGE_VARIANT: Record<
  PublicationState,
  VariantProps<typeof badgeVariants>['variant']
> = {
  ACTIVE: 'default',
  EXPIRED: 'outline',
  REVOKED: 'destructive',
  NONE: 'secondary',
};
