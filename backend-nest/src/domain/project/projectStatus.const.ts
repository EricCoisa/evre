export const ProjectStatusConst = {
  PROPOSAL: 'PROPOSAL',
  REQUIREMENTS: 'REQUIREMENTS',
  DEVELOPMENT: 'DEVELOPMENT',
  DONE: 'DONE',
} as const;

export type ProjectStatus = keyof typeof ProjectStatusConst;
