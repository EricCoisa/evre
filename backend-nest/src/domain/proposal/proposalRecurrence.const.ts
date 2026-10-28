export const ProposalRecurrenceConst = {
  ONE_TIME: 'ONE_TIME',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const;

export type ProposalRecurrence = keyof typeof ProposalRecurrenceConst;
export type ProposalRecurrenceValue =
  (typeof ProposalRecurrenceConst)[keyof typeof ProposalRecurrenceConst];
