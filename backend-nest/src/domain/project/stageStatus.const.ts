export const StageStatusConst = {
  TODO: 'TODO',
  DOING: 'DOING',
  DONE: 'DONE',
} as const;

export type StageStatus = keyof typeof StageStatusConst;
