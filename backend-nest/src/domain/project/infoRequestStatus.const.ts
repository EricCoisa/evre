export const InfoRequestStatusConst = {
  PENDING: 'PENDING',
  ANSWERED: 'ANSWERED',
  EXPIRED: 'EXPIRED',
} as const;

export type InfoRequestStatus = keyof typeof InfoRequestStatusConst;
