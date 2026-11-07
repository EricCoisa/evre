export const ProjectTaskStatusConst = {
  WAITING: 'WAITING',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;

export type ProjectTaskStatus = keyof typeof ProjectTaskStatusConst;
