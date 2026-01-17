export const ApprovalStatusConst = {
  APPROVED: 'APPROVED',
  APPROVED_WITH_REMARKS: 'APPROVED_WITH_REMARKS',
  REJECTED: 'REJECTED',
} as const;

export type ApprovalStatus = keyof typeof ApprovalStatusConst;
