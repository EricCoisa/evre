export const PublicationStateConst = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  NONE: 'NONE',
} as const;

export type PublicationState =
  (typeof PublicationStateConst)[keyof typeof PublicationStateConst];

export const PUBLICATION_STATE_VALUES = Object.values(
  PublicationStateConst,
) as [PublicationState, ...PublicationState[]];
