export const MembershipScopeRoleConst = {
  OWNER: 'OWNER',
  COLLABORATOR: 'COLLABORATOR',
  VIEWER: 'VIEWER',
} as const;

export type MembershipScopeRole = keyof typeof MembershipScopeRoleConst;
export type MembershipScopeRoleValue =
  (typeof MembershipScopeRoleConst)[keyof typeof MembershipScopeRoleConst];
