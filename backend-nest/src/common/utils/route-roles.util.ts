/** Diz se o papel está dentro do teto de papéis permitidos. */
export function isRoleAllowedForRoute(
  allowedRoles: string[],
  roleName: string | null | undefined,
): boolean {
  return (
    allowedRoles.length === 0 || (!!roleName && allowedRoles.includes(roleName))
  );
}
