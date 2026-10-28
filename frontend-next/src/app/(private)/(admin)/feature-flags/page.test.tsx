import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test-utils';
import FeatureFlagsPage from './page';
import { type FeatureFlag, FeatureFlagCategoryConst } from '@/lib/actions/feature-flag/types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));

const mocks = vi.hoisted(() => ({
  flags: [] as FeatureFlag[],
}));

vi.mock('@/lib/actions/feature-flag/queries', () => ({
  useFeatureFlags: () => ({ data: mocks.flags, error: null }),
  useCreateFeatureFlag: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateFeatureFlag: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useDeleteFeatureFlag: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetFeatureFlagRoles: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/actions/user/queries', () => ({
  useRoles: () => ({ data: [] }),
}));

function flag(overrides: Partial<FeatureFlag>): FeatureFlag {
  return {
    id: 'id',
    key: 'KEY',
    description: null,
    category: FeatureFlagCategoryConst.GENERAL,
    isSystem: false,
    enabled: true,
    parentId: null,
    createdAt: '',
    updatedAt: '',
    roles: [],
    ...overrides,
  };
}

describe('FeatureFlagsPage - árvore de parent/child', () => {
  it('mostra a flag filha aninhada sob o pai, e recolher o pai esconde a filha', () => {
    mocks.flags = [
      flag({ id: 'p1', key: 'PARENT_FLAG' }),
      flag({ id: 'c1', key: 'CHILD_FLAG', parentId: 'p1' }),
    ];

    render(<FeatureFlagsPage />);

    expect(screen.getAllByText('PARENT_FLAG')[0]).toBeInTheDocument();
    expect(screen.getAllByText('CHILD_FLAG')[0]).toBeInTheDocument();

    const collapseButton = screen.getByRole('button', { name: 'collapse' });
    fireEvent.click(collapseButton);

    expect(screen.getAllByText('PARENT_FLAG')[0]).toBeInTheDocument();
    expect(screen.queryAllByText('CHILD_FLAG')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'expand' })).toBeInTheDocument();
  });

  it('flag sem pai fica na raiz, sem toggle de colapso', () => {
    mocks.flags = [flag({ id: 'r1', key: 'ROOT_FLAG' })];

    render(<FeatureFlagsPage />);

    expect(screen.getAllByText('ROOT_FLAG')[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'collapse' })).not.toBeInTheDocument();
  });
});
