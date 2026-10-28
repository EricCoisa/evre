import { describe, it, expect } from 'vitest';
import {
  breadcrumbTrail,
  buildRouteTree,
  matchRoute,
  pathPrefixes,
} from '@/lib/route-tree';
import type { UserRoute } from '@/lib/actions/auth/types';

const route = (over: Partial<UserRoute> & Pick<UserRoute, 'id' | 'path'>): UserRoute => ({
  labelKey: `ROUTE_${over.id.toUpperCase()}`,
  icon: null,
  parentId: null,
  ordem: 0,
  isHome: false,
  isActive: true,
  showSideBar: true,
  ...over,
});

const settings = route({ id: 'settings', path: '/settings', ordem: 2 });
const flags = route({
  id: 'flags',
  path: '/settings/feature-flags',
  parentId: 'settings',
  ordem: 1,
});
const email = route({
  id: 'email',
  path: '/settings/email',
  parentId: 'settings',
  ordem: 0,
});
const user = route({ id: 'user', path: '/user', ordem: 1 });

const routes = [flags, settings, user, email];

describe('pathPrefixes', () => {
  it('acumula da raiz até o último segmento', () => {
    expect(pathPrefixes('/a/b/c')).toEqual(['/a', '/a/b', '/a/b/c']);
    expect(pathPrefixes('/')).toEqual([]);
  });
});

describe('buildRouteTree', () => {
  it('aninha por parentId e ordena por ordem em cada nível', () => {
    const tree = buildRouteTree(routes);

    expect(tree.map((n) => n.path)).toEqual(['/user', '/settings']);
    expect(tree[1].children.map((n) => n.path)).toEqual([
      '/settings/email',
      '/settings/feature-flags',
    ]);
  });

  it('filho sem o pai na lista sobe para a raiz', () => {
    // Pai sem acesso (ou showSideBar=false) não deve sumir com o filho liberado.
    const tree = buildRouteTree([flags, user]);
    expect(tree.map((n) => n.path)).toEqual(['/settings/feature-flags', '/user']);
  });

  it('suporta mais de dois níveis', () => {
    const deep = route({
      id: 'deep',
      path: '/settings/feature-flags/deep',
      parentId: 'flags',
    });
    const tree = buildRouteTree([settings, flags, deep]);
    expect(tree[0].children[0].children[0].path).toBe(
      '/settings/feature-flags/deep',
    );
  });
});

describe('matchRoute', () => {
  it('prefere a subrota ao pai', () => {
    expect(matchRoute(routes, '/settings/feature-flags')?.id).toBe('flags');
  });

  it('cai no ancestral quando o segmento é dinâmico', () => {
    expect(matchRoute(routes, '/user/abc-123')?.id).toBe('user');
  });

  it('devolve undefined quando nada cobre o path', () => {
    expect(matchRoute(routes, '/nope')).toBeUndefined();
  });
});

describe('breadcrumbTrail', () => {
  it('um crumb por segmento, com href acumulado', () => {
    expect(breadcrumbTrail(routes, '/settings/feature-flags')).toEqual([
      { href: '/settings', raw: 'settings', labelKey: 'ROUTE_SETTINGS' },
      {
        href: '/settings/feature-flags',
        raw: 'feature-flags',
        labelKey: 'ROUTE_FLAGS',
      },
    ]);
  });

  it('marca o segmento dinâmico com o prefixo do pai', () => {
    expect(breadcrumbTrail(routes, '/user/abc-123')).toEqual([
      { href: '/user', raw: 'user', labelKey: 'ROUTE_USER' },
      { href: '/user/abc-123', raw: 'abc-123', dynamicOf: '/user' },
    ]);
  });
});
