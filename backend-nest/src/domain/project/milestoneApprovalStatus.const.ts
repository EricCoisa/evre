export const MilestoneApprovalStatusConst = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type MilestoneApprovalStatus =
  keyof typeof MilestoneApprovalStatusConst;
