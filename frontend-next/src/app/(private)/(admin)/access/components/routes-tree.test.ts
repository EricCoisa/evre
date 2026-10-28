import { describe, it, expect } from 'vitest';
import { buildRouteRows, reorderSiblings } from './routes-tree';
import type { Routes } from '@/lib/actions/access/route/types';

function route(over: Partial<Routes>): Routes {
  return {
    id: 'x', path: '/x', labelKey: 'x', icon: null, parentId: null,
    ordem: 0, isActive: true, showSideBar: true,
    createdAt: '', updatedAt: '',
    ...over,
  } as Routes;
}

const tree = [
  route({ id: 'a', ordem: 1 }),
  route({ id: 'a1', parentId: 'a', ordem: 1 }),
  route({ id: 'a2', parentId: 'a', ordem: 2 }),
  route({ id: 'b', ordem: 2 }),
];

describe('buildRouteRows', () => {
  it('aninha filhos sob o pai, na ordem', () => {
    expect(buildRouteRows(tree, new Set()).map((r) => r.route.id)).toEqual(['a', 'a1', 'a2', 'b']);
  });

  it('pai recolhido esconde os filhos', () => {
    expect(buildRouteRows(tree, new Set(['a'])).map((r) => r.route.id)).toEqual(['a', 'b']);
  });

  it('marca hasChildren só em quem tem', () => {
    const rows = buildRouteRows(tree, new Set());
    expect(rows.find((r) => r.route.id === 'a')?.hasChildren).toBe(true);
    expect(rows.find((r) => r.route.id === 'b')?.hasChildren).toBe(false);
  });

  it('pai inexistente vira raiz em vez de sumir', () => {
    const orfa = [route({ id: 'o', parentId: 'fantasma' })];
    expect(buildRouteRows(orfa, new Set())).toHaveLength(1);
  });
});

describe('reorderSiblings', () => {
  it('numera 1..n só entre irmãos do mesmo pai', () => {
    expect(reorderSiblings(tree, 'a', ['a2', 'a1'])).toEqual([
      { id: 'a2', ordem: 1 },
      { id: 'a1', ordem: 2 },
    ]);
  });

  it('não emite update para quem já está na ordem certa', () => {
    expect(reorderSiblings(tree, 'a', ['a1', 'a2'])).toEqual([]);
  });

  it('ignora id que não é irmão', () => {
    expect(reorderSiblings(tree, null, ['a', 'a1', 'b'])).toEqual([]);
  });
});
