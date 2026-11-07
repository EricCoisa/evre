import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { act, fireEvent, render, screen, within } from '@/test-utils';
import { DataTable } from './data-table';
import type { PaginatedResponse } from '@/lib/types/pagination.types';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'pt-BR' }),
}));

// Mocks controláveis por teste: isMobile (layout) e o estado de erro de query do react-query
// (getQueryState/refetchQueries), que DataTable lê fora de qualquer hook de dados específico.
const mocks = vi.hoisted(() => ({
  isMobile: false,
  queryState: undefined as { error?: Error } | undefined,
  refetchQueries: vi.fn(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mocks.isMobile,
}));

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({
    getQueryState: () => mocks.queryState,
    refetchQueries: mocks.refetchQueries,
  }),
}));

beforeEach(() => {
  mocks.isMobile = false;
  mocks.queryState = undefined;
  mocks.refetchQueries = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

interface Row {
  id: string;
  status: string;
}

const columns: ColumnDef<Row>[] = [{ accessorKey: 'id', header: 'ID' }];

function page(overrides: Partial<PaginatedResponse<Row>> = {}): PaginatedResponse<Row> {
  return {
    data: [{ id: '1', status: 'active' }],
    meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    ...overrides,
  };
}

// Reproduz o padrão real (ex.: user-tab.tsx): pagination e filters vivem no consumidor, não no DataTable.
function Harness({
  data,
  options,
}: {
  data: PaginatedResponse<Row>;
  options?: { value: string; label: string }[];
}) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [filters, setFilters] = useState<Record<string, string>>({});
  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        queryKey={['rows']}
        pagination={pagination}
        onPaginationChange={setPagination}
        filters={filters}
        onFiltersChange={setFilters}
      >
        <DataTable.Select title="status" accessorKey="status" options={options} />
      </DataTable>
      <div data-testid="filters-debug">{JSON.stringify(filters)}</div>
    </>
  );
}

const openSelect = (title: string) => {
  const label = screen.getByText(title, { selector: 'label' });
  fireEvent.click(within(label.parentElement!).getByRole('combobox'));
};

describe('DataTable.Select', () => {
  it('sem `options`, deriva valores de response.filter e usa t(value) como label (comportamento original)', () => {
    render(<Harness data={page({ filter: { status: ['active', 'inactive'] } })} />);
    openSelect('status');
    expect(screen.getByRole('option', { name: 'active' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'inactive' })).toBeInTheDocument();
  });

  it('sem `options` e sem response.filter, mostra o aviso de valores indisponíveis', () => {
    render(<Harness data={page()} />);
    expect(screen.getByText(/filterValuesUnavailable/)).toBeInTheDocument();
  });

  it('com `options`, mostra o label explícito em vez do value cru e ignora response.filter', () => {
    const options = [
      { value: 'uuid-1', label: 'Provider A · 5511900000000' },
      { value: 'uuid-2', label: 'Provider B · 5511911111111' },
    ];
    // filter ausente de propósito: provaria o fallback "indisponível" se `options` não substituísse a derivação
    render(<Harness data={page()} options={options} />);
    openSelect('status');
    expect(screen.getByRole('option', { name: 'Provider A · 5511900000000' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Provider B · 5511911111111' })).toBeInTheDocument();
    expect(screen.queryByText('uuid-1')).not.toBeInTheDocument();
    expect(screen.queryByText(/filterValuesUnavailable/)).not.toBeInTheDocument();
  });

  it('selecionar uma opção propaga o `value` (ex.: UUID) para o filtro, não o label', () => {
    const options = [
      { value: 'uuid-1', label: 'Provider A · 5511900000000' },
      { value: 'uuid-2', label: 'Provider B · 5511911111111' },
    ];
    render(<Harness data={page()} options={options} />);
    openSelect('status');
    fireEvent.click(screen.getByRole('option', { name: 'Provider B · 5511911111111' }));
    expect(screen.getByTestId('filters-debug').textContent).toBe(JSON.stringify({ status: 'uuid-2' }));

    openSelect('status');
    fireEvent.click(screen.getByRole('option', { name: 'all' }));
    expect(screen.getByTestId('filters-debug').textContent).toBe(JSON.stringify({}));
  });
});

describe('DataTable.Input', () => {
  function InputHarness({
    globalFilter,
    onGlobalFilterChange,
    placeholder,
  }: {
    globalFilter: string;
    onGlobalFilterChange: (v: string) => void;
    placeholder?: string;
  }) {
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    return (
      <DataTable
        columns={columns}
        data={page()}
        queryKey={['rows']}
        pagination={pagination}
        onPaginationChange={setPagination}
        enableGlobalFilter
        globalFilter={globalFilter}
        onGlobalFilterChange={onGlobalFilterChange}
      >
        <DataTable.Input title="Buscar" placeholder={placeholder} />
      </DataTable>
    );
  }

  it('digitar propaga para onGlobalFilterChange só após o debounce de 1000ms', () => {
    vi.useFakeTimers();
    const onGlobalFilterChange = vi.fn();
    render(<InputHarness globalFilter="" onGlobalFilterChange={onGlobalFilterChange} placeholder="Procurar registro" />);

    const input = screen.getByPlaceholderText('Procurar registro');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onGlobalFilterChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onGlobalFilterChange).toHaveBeenCalledWith('abc');
  });

  it('não chama onGlobalFilterChange quando o valor digitado é igual ao filtro atual do contexto', () => {
    vi.useFakeTimers();
    const onGlobalFilterChange = vi.fn();
    render(<InputHarness globalFilter="abc" onGlobalFilterChange={onGlobalFilterChange} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onGlobalFilterChange).not.toHaveBeenCalled();
  });

  it('sincroniza o valor exibido quando o globalFilter muda por fora do input (ex.: reset externo)', () => {
    function ExternalSyncHarness() {
      const [globalFilter, setGlobalFilter] = useState('inicial');
      return (
        <>
          <InputHarness globalFilter={globalFilter} onGlobalFilterChange={setGlobalFilter} />
          <button type="button" onClick={() => setGlobalFilter('externo')}>
            trocar-externo
          </button>
        </>
      );
    }

    render(<ExternalSyncHarness />);
    expect(screen.getByDisplayValue('inicial')).toBeInTheDocument();

    fireEvent.click(screen.getByText('trocar-externo'));
    expect(screen.getByDisplayValue('externo')).toBeInTheDocument();
  });
});

describe('DataTable.Input / DataTable.Select fora do DataTable', () => {
  it('DataTable.Input lança erro quando renderizado fora do contexto do DataTable', () => {
    expect(() => render(<DataTable.Input />)).toThrow('DataTable.Input must be used within DataTable');
  });

  it('DataTable.Select lança erro quando renderizado fora do contexto do DataTable', () => {
    expect(() => render(<DataTable.Select accessorKey="status" />)).toThrow(
      'DataTable.Select must be used within DataTable',
    );
  });
});

describe('DataTable.Actions e sidebar de filtros (mobile)', () => {
  function ActionsHarness() {
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    const [filters, setFilters] = useState<Record<string, string>>({ status: 'uuid-2' });
    return (
      <>
        <DataTable
          columns={columns}
          data={page()}
          queryKey={['rows']}
          pagination={pagination}
          onPaginationChange={setPagination}
          filters={filters}
          onFiltersChange={setFilters}
        >
          <DataTable.Select
            title="status"
            accessorKey="status"
            options={[{ value: 'uuid-2', label: 'Provider B' }]}
          />
          <DataTable.Actions>
            <button type="button">Nova</button>
          </DataTable.Actions>
        </DataTable>
        <div data-testid="filters-debug">{JSON.stringify(filters)}</div>
      </>
    );
  }

  it('renderiza as ações no toolbar desktop e na barra mobile; abrir a sidebar espelha os filtros e resetFilters os limpa', () => {
    render(<ActionsHarness />);

    // Uma cópia no bloco "hidden lg:flex" (toolbar cheio) e outra no bloco "flex lg:hidden" (actionNodes)
    expect(screen.getAllByText('Nova')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('filters'));
    // A sidebar espelha os filterNodes (DataTable.Select) via updateSidebar — segunda ocorrência do label "status"
    expect(screen.getAllByText('status').length).toBeGreaterThan(1);

    fireEvent.click(screen.getByText('resetFilters'));
    expect(screen.getByTestId('filters-debug').textContent).toBe(JSON.stringify({}));
  });
});

describe('DataTable - estados vazio e de erro de dados', () => {
  function BasicHarness({
    data,
    error,
    emptyMessage,
  }: {
    data: PaginatedResponse<Row> | Row[];
    error?: Error | null;
    emptyMessage?: string;
  }) {
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    return (
      <DataTable
        columns={columns}
        data={data}
        error={error}
        queryKey={['rows']}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage={emptyMessage}
      />
    );
  }

  it('mostra a mensagem de erro quando `error` é informado', () => {
    render(<BasicHarness data={page()} error={new Error('Falha ao buscar registros')} />);
    expect(screen.getByText('Falha ao buscar registros')).toBeInTheDocument();
  });

  it('usa a mensagem de fallback quando o Error não tem `message`', () => {
    render(<BasicHarness data={page()} error={new Error('')} />);
    expect(screen.getByText('Erro ao carregar dados')).toBeInTheDocument();
  });

  it('mostra emptyMessage customizado quando não há registros', () => {
    render(
      <BasicHarness
        data={page({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })}
        emptyMessage="Nada por aqui"
      />,
    );
    expect(screen.getByText('Nada por aqui')).toBeInTheDocument();
  });

  it('usa t(noRecords) quando emptyMessage é string vazia', () => {
    render(
      <BasicHarness
        data={page({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })}
        emptyMessage=""
      />,
    );
    expect(screen.getByText('noRecords')).toBeInTheDocument();
  });
});

describe('DataTable - loading e erro vindo do react-query', () => {
  function LoadingHarness({
    isLoading,
    data,
  }: {
    isLoading?: boolean;
    data?: PaginatedResponse<Row> | Row[];
  }) {
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    return (
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        queryKey={['rows']}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
    );
  }

  it('mostra o TableSkeleton quando isLoading é true', () => {
    const { container } = render(<LoadingHarness isLoading data={page()} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('mostra o TableSkeleton quando data é undefined, mesmo com isLoading false', () => {
    const { container } = render(<LoadingHarness isLoading={false} data={undefined} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('mostra ErrorState e aciona refetchQueries ao clicar em tentar novamente quando a query tem erro em cache', () => {
    mocks.queryState = { error: new Error('timeout') };
    render(<LoadingHarness data={page()} />);

    expect(screen.getByText('error_loading')).toBeInTheDocument();
    fireEvent.click(screen.getByText('tryAgain'));
    expect(mocks.refetchQueries).toHaveBeenCalledWith({ queryKey: ['rows'] });
  });
});

describe('DataTable - agrupamento (enableGrouping)', () => {
  interface GroupRow {
    id: string;
    team: string;
    name: string;
  }

  const groupedData: GroupRow[] = [
    { id: '1', team: 'alpha', name: 'Ana' },
    { id: '2', team: 'alpha', name: 'Bruno' },
    { id: '3', team: 'beta', name: 'Caio' },
  ];

  function GroupHarness({ columns: cols }: { columns: ColumnDef<GroupRow>[] }) {
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    return (
      <DataTable
        columns={cols}
        data={groupedData}
        queryKey={['grouped']}
        pagination={pagination}
        onPaginationChange={setPagination}
        enableGrouping
      />
    );
  }

  it('agrupa pela coluna com meta.groupBy, mostra a contagem de itens e expande ao clicar (label padrão)', () => {
    const groupedColumns: ColumnDef<GroupRow>[] = [
      { accessorKey: 'team', header: 'Equipe', meta: { groupBy: true } },
      { accessorKey: 'name', header: 'Nome' },
    ];
    render(<GroupHarness columns={groupedColumns} />);

    expect(screen.getByText('team: alpha')).toBeInTheDocument();
    expect(screen.getByText('team: beta')).toBeInTheDocument();
    expect(screen.getByText('(2 itens)')).toBeInTheDocument();

    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('team: alpha'));
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('agrupa por coluna definida via id + accessorFn (sem accessorKey) — cobre o fallback por id', () => {
    const groupedColumns: ColumnDef<GroupRow>[] = [
      { id: 'teamId', accessorFn: (row) => row.team, header: 'Equipe', meta: { groupBy: true } },
      { accessorKey: 'name', header: 'Nome' },
    ];
    render(<GroupHarness columns={groupedColumns} />);

    expect(screen.getByText('teamId: alpha')).toBeInTheDocument();
  });

  it('usa meta.groupLabel customizado em vez do label padrão', () => {
    const groupedColumns: ColumnDef<GroupRow>[] = [
      {
        accessorKey: 'team',
        header: 'Equipe',
        meta: {
          groupBy: true,
          groupLabel: (value) => <strong>Grupo {String(value)}</strong>,
        },
      },
      { accessorKey: 'name', header: 'Nome' },
    ];
    render(<GroupHarness columns={groupedColumns} />);

    expect(screen.queryByText('team: alpha')).not.toBeInTheDocument();
    expect(screen.getByText(/Grupo alpha/)).toBeInTheDocument();
  });

  it('oculta a contagem de itens quando meta.hideGroupCount é true', () => {
    const groupedColumns: ColumnDef<GroupRow>[] = [
      {
        accessorKey: 'team',
        header: 'Equipe',
        meta: {
          groupBy: true,
          hideGroupCount: true,
          groupLabel: (value) => <strong>Grupo {String(value)}</strong>,
        },
      },
      { accessorKey: 'name', header: 'Nome' },
    ];
    render(<GroupHarness columns={groupedColumns} />);

    expect(screen.getByText(/Grupo alpha/)).toBeInTheDocument();
    expect(screen.queryByText(/\(2 itens\)/)).not.toBeInTheDocument();
  });
});

describe('DataTable - visão mobile (useIsMobile = true)', () => {
  interface MobileRow {
    id: string;
    name: string;
    createdAt: string;
  }

  const mobileColumns: ColumnDef<MobileRow>[] = [
    { accessorKey: 'name', header: 'Nome', meta: { mobileOrder: 1 } },
    { accessorKey: 'createdAt', header: 'Criado em', meta: { mobileOrder: 2 } },
    { id: 'actions', header: 'Ações', cell: () => <button type="button">Editar</button> },
  ];

  const mobileData: PaginatedResponse<MobileRow> = {
    data: [
      { id: '1', name: 'Ana', createdAt: '2026-01-01' },
      { id: '2', name: 'Bruno', createdAt: '2026-01-02' },
    ],
    meta: { total: 2, page: 1, limit: 10, totalPages: 2 },
  };

  function MobileHarness() {
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    return (
      <DataTable
        columns={mobileColumns}
        data={mobileData}
        queryKey={['mobile-rows']}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
    );
  }

  it('renderiza cards com a ação sempre visível e o campo collapsible (createdAt, heurística default) escondido até expandir', () => {
    mocks.isMobile = true;
    render(<MobileHarness />);

    expect(screen.getAllByText('Editar')).toHaveLength(2);
    expect(screen.queryByText('2026-01-01')).not.toBeInTheDocument();

    const [toggle] = screen.getAllByText('Ver detalhes');
    fireEvent.click(toggle);
    expect(screen.getByText('2026-01-01')).toBeInTheDocument();
    expect(screen.getAllByText('Menos detalhes').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Menos detalhes')[0]);
    expect(screen.queryByText('2026-01-01')).not.toBeInTheDocument();
  });

  it('paginação mobile desabilita "previous" na primeira página e habilita após avançar', () => {
    mocks.isMobile = true;
    render(<MobileHarness />);

    expect(screen.getByText('previous').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByText('next'));
    expect(screen.getByText('previous').closest('button')).not.toBeDisabled();
  });

  it('respeita mobileLabel e hidden; isAction:false explícito faz "operations" ser tratada como dado, não ação', () => {
    mocks.isMobile = true;
    interface Row2 {
      id: string;
      name: string;
      secret: string;
      ops: string;
    }
    const columns2: ColumnDef<Row2>[] = [
      { accessorKey: 'name', header: 'Nome', meta: { mobileLabel: 'Nome Custom' } },
      { accessorKey: 'secret', header: 'Secreto', meta: { hidden: true } },
      { id: 'operations', accessorKey: 'ops', header: 'Operações', meta: { isAction: false } },
    ];
    const data2: Row2[] = [{ id: '1', name: 'Ana', secret: 'nao-deveria-aparecer', ops: 'valor-ops' }];

    function Harness4() {
      const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
      return (
        <DataTable
          columns={columns2}
          data={data2}
          queryKey={['rows2']}
          pagination={pagination}
          onPaginationChange={setPagination}
        />
      );
    }

    render(<Harness4 />);
    expect(screen.getByText('Nome Custom')).toBeInTheDocument();
    expect(screen.queryByText('nao-deveria-aparecer')).not.toBeInTheDocument();
    expect(screen.getByText('valor-ops')).toBeInTheDocument();
  });
});
