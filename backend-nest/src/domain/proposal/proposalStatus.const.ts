export const ProposalStatusConst = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  APPROVED: 'APPROVED',
} as const;

export type ProposalStatus =
  (typeof ProposalStatusConst)[keyof typeof ProposalStatusConst];
