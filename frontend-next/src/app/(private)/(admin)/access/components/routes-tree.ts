import type { Routes } from '@/lib/actions/access/route/types';

export interface RouteRow {
  route: Routes;
  depth: number;
  hasChildren: boolean;
}

/** Raízes em ordem, cada uma seguida dos próprios filhos. Pai desconhecido vira raiz. */
export function buildRouteRows(
  routes: Routes[],
  collapsed: Set<string>,
): RouteRow[] {
  const byId = new Map(routes.map((r) => [r.id, r]));
  const childrenOf = new Map<string, Routes[]>();
  for (const route of routes) {
    if (route.parentId && byId.has(route.parentId)) {
      const list = childrenOf.get(route.parentId) ?? [];
      list.push(route);
      childrenOf.set(route.parentId, list);
    }
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.ordem - b.ordem);

  const roots = routes
    .filter((r) => !r.parentId || !byId.has(r.parentId))
    .sort((a, b) => a.ordem - b.ordem);

  const rows: RouteRow[] = [];
  for (const root of roots) {
    const children = childrenOf.get(root.id) ?? [];
    rows.push({ route: root, depth: 0, hasChildren: children.length > 0 });
    if (!collapsed.has(root.id)) {
      for (const child of children) {
        rows.push({ route: child, depth: 1, hasChildren: false });
      }
    }
  }
  return rows;
}

/** Ordem 1..n entre os irmãos de `parentId`, já com o item movido para `toIndex`. */
export function reorderSiblings(
  routes: Routes[],
  parentId: string | null,
  orderedIds: string[],
): Array<{ id: string; ordem: number }> {
  const siblings = new Set(
    routes
      .filter((r) => (r.parentId ?? null) === parentId)
      .map((r) => r.id),
  );
  const byId = new Map(routes.map((r) => [r.id, r]));
  const updates: Array<{ id: string; ordem: number }> = [];
  let position = 0;
  for (const id of orderedIds) {
    if (!siblings.has(id)) continue;
    position += 1;
    if (byId.get(id)?.ordem !== position) updates.push({ id, ordem: position });
  }
  return updates;
}
