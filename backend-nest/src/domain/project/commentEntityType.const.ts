export const CommentEntityTypeConst = {
  PROJECT: 'PROJECT',
  MILESTONE: 'MILESTONE',
  TASK: 'TASK',
} as const;

export type CommentEntityType = keyof typeof CommentEntityTypeConst;
