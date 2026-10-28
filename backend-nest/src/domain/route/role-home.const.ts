export const ROLE_HOME_CONFIG_KEY = 'SYSTEM_ROLE_HOME_ROUTES';

/** `{ roleName: routeId }`. Role ausente = sem home definida; quem resolve decide o fallback. */
export type RoleHomeMap = Record<string, string>;

export function parseRoleHomeMap(raw: unknown): RoleHomeMap {
  const source: unknown = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

  const out: RoleHomeMap = {};
  for (const [role, routeId] of Object.entries(source)) {
    if (typeof routeId === 'string' && routeId) out[role] = routeId;
  }
  return out;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
