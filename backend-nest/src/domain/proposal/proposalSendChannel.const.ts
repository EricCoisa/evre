/** Canal de um `ProposalSend` — coluna é `String` (sem enum Prisma), este const só dá type-safety ao código. */
export const ProposalSendChannelConst = {
  WHATSAPP: 'WHATSAPP',
  EMAIL: 'EMAIL',
  MANUAL: 'MANUAL',
} as const;
export type ProposalSendChannelValue =
  (typeof ProposalSendChannelConst)[keyof typeof ProposalSendChannelConst];
