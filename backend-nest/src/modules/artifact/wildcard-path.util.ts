/** Express 5 popula um wildcard nomeado (`*path`) como array de segmentos, não string. */
export function normalizeWildcardPath(
  path: string | string[] | undefined,
): string | undefined {
  if (path === undefined) return undefined;
  return Array.isArray(path) ? path.join('/') : path;
}
