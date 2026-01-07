export const UserRoleConst = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  MODERATOR: 'MODERATOR',
};
export type UserRole = keyof typeof UserRoleConst;
export type UserRoleValue = (typeof UserRoleConst)[keyof typeof UserRoleConst];
