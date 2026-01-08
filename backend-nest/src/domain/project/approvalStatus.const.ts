export const ApprovalStatusConst = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ApprovalStatus = keyof typeof ApprovalStatusConst;
