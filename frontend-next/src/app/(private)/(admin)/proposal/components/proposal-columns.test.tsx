import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test-utils';
import { getProposalColumns } from './proposal-columns';
import type { Proposal } from '@/lib/actions/proposal/types';

const t = (key: string) => key;
const tVocabulary = (key: string) => key;

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'p1',
    companyId: 'c1',
    companyName: 'Acme',
    ownerId: 'u1',
    name: 'Site novo',
    status: 'SENT',
    lostReason: null,
    layout: null,
    totalCents: 150000,
    currency: 'BRL',
    recurrence: 'ONE_TIME',
    termDays: null,
    validUntil: null,
    includedItems: [],
    optionalItems: [],
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    daysWithoutMovement: 3,
    ...overrides,
  };
}

function findColumn(columns: ReturnType<typeof getProposalColumns>, key: string) {
  return columns.find((c) => (c as { accessorKey?: string }).accessorKey === key)!;
}

describe('getProposalColumns', () => {
  it('formata totalCents como moeda a partir de centavos', () => {
    const columns = getProposalColumns({ t, tVocabulary });
    const column = findColumn(columns, 'totalCents');
    const item = proposal();
    const row = { getValue: (key: string) => item[key as keyof Proposal], original: item };

    render(<>{column.cell!({ row } as never)}</>);

    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();
  });

  it('rótulo de status vem de proposalStatusLabelKey (namespace vocabulary), nunca string solta', () => {
    const columns = getProposalColumns({ t, tVocabulary });
    const column = findColumn(columns, 'status');
    const item = proposal({ status: 'LOST' });
    const row = { getValue: (key: string) => item[key as keyof Proposal], original: item };

    render(<>{column.cell!({ row } as never)}</>);

    expect(screen.getByText('proposalStatus.LOST')).toBeInTheDocument();
  });

  it('ação duplicar chama onDuplicate com o item da linha', () => {
    const onDuplicate = vi.fn();
    const columns = getProposalColumns({ t, tVocabulary, onDuplicate });
    const column = columns.find((c) => c.id === 'actions')!;
    const item = proposal();
    const row = { getValue: (key: string) => item[key as keyof Proposal], original: item };

    render(<>{column.cell!({ row } as never)}</>);
    fireEvent.click(screen.getByRole('button', { name: 'duplicateTooltip' }));

    expect(onDuplicate).toHaveBeenCalledWith(item);
  });
});
