export const ProposalAcceptanceSourceConst = {
  LINK: 'LINK',
  OFFLINE: 'OFFLINE',
} as const;

export type ProposalAcceptanceSource =
  keyof typeof ProposalAcceptanceSourceConst;
export type ProposalAcceptanceSourceValue =
  (typeof ProposalAcceptanceSourceConst)[keyof typeof ProposalAcceptanceSourceConst];
