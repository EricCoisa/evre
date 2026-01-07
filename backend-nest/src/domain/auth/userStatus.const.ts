export const UserStatusConst = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
};
export type UserStatus = keyof typeof UserStatusConst;
export type UserStatusValue =
  (typeof UserStatusConst)[keyof typeof UserStatusConst];
