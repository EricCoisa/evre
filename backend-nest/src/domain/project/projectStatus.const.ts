export const ProjectStatusConst = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ProjectStatus = keyof typeof ProjectStatusConst;
export type ProjectStatusValue =
  (typeof ProjectStatusConst)[keyof typeof ProjectStatusConst];
