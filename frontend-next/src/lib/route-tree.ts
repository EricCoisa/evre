import type { UserRoute } from '@/lib/actions/auth/types';

export type RouteNode = UserRoute & { children: RouteNode[] };

export type Crumb = {
  /** URL acumulada até este segmento. */
  href: string;
  /** Segmento cru — é o `[id]` quando não há rota cadastrada neste nível. */
  raw: string;
  /** Presente quando o segmento é uma rota cadastrada. */
  labelKey?: string;
  /** Prefixo do pai, presente só quando o segmento não é rota cadastrada. */
  dynamicOf?: string;
};

/** `/a/b/c` → `['/a', '/a/b', '/a/b/c']` */
export function pathPrefixes(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((_, i) => `/${segments.slice(0, i + 1).join('/')}`);
}

/** Árvore por `parentId`; filho cujo pai não veio na lista sobe para a raiz. */
export function buildRouteTree(routes: UserRoute[]): RouteNode[] {
  const nodes = new Map<string, RouteNode>(
    routes.map((r) => [r.id, { ...r, children: [] }]),
  );
  const roots: RouteNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }

  const sort = (list: RouteNode[]): RouteNode[] => {
    list.sort((a, b) => a.ordem - b.ordem);
    list.forEach((n) => sort(n.children));
    return list;
  };
  return sort(roots);
}

/** Rota cadastrada mais específica que cobre o pathname — cai no ancestral em `[id]`. */
export function matchRoute(
  routes: UserRoute[],
  pathname: string,
): UserRoute | undefined {
  for (const prefix of pathPrefixes(pathname).reverse()) {
    const found = routes.find((r) => r.path === prefix);
    if (found) return found;
  }
  return undefined;
}

/** Um crumb por segmento da URL, resolvido pelo prefixo acumulado. */
export function breadcrumbTrail(
  routes: UserRoute[],
  pathname: string,
): Crumb[] {
  let prefix = '';
  return pathname
    .split('/')
    .filter(Boolean)
    .map((raw) => {
      const parent = prefix;
      prefix += `/${raw}`;
      const route = routes.find((r) => r.path === prefix);
      return route
        ? { href: prefix, raw, labelKey: route.labelKey }
        : { href: prefix, raw, dynamicOf: parent };
    });
}
