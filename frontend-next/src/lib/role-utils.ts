export function isClientUser(user: { role?: string; roleName?: string } | null | undefined): boolean {
  return user?.role === 'USER' || user?.roleName === 'USER';
}
