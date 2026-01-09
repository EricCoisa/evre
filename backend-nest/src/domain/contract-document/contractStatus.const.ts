export const ContractStatusConst = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ContractStatus =
  (typeof ContractStatusConst)[keyof typeof ContractStatusConst];
