export const ProposalSendChannelConst = {
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  MANUAL: 'MANUAL',
} as const;
export type ProposalSendChannelValue =
  (typeof ProposalSendChannelConst)[keyof typeof ProposalSendChannelConst];
