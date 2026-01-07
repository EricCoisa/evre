export const ROLES = ['ADMIN', 'USER', 'MODERATOR'] as const;
export type Role = typeof ROLES[number];