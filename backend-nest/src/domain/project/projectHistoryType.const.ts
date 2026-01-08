export const ProjectHistoryTypeConst = {
  STATUS_CHANGE: 'STATUS_CHANGE',
  COMMENT: 'COMMENT',
  APPROVAL: 'APPROVAL',
} as const;

export type ProjectHistoryType = keyof typeof ProjectHistoryTypeConst;
