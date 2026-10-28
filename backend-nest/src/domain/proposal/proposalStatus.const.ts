export const ProposalStatusConst = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  LOST: 'LOST',
} as const;

export type ProposalStatus = keyof typeof ProposalStatusConst;
export type ProposalStatusValue =
  (typeof ProposalStatusConst)[keyof typeof ProposalStatusConst];
