export const ActivityStatusConst = {
  TODO: 'TODO',
  DOING: 'DOING',
  DONE: 'DONE',
} as const;

export type ActivityStatus = keyof typeof ActivityStatusConst;
