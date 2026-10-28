import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockGrid, LayoutBody, PageRenderer } from './renderer';
import type { PageBlock } from './schema';

/** Cobre a árvore de blocos (BlockGrid/Block), a integração com fontes de dado via
 * react-query, e a casca de página (PageRenderer): status do layout, ações e troca para o
 * editor. `./editor/block-chrome` e `./editor/context` são mockados porque o chrome real
 * depende de DndContext do dnd-kit, que é testado separadamente em editor.test.tsx. */

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}));

vi.mock('next/dynamic', () => ({
  default: () => (props: { pageKey: string; onExit: () => void }) => (
    <div data-testid="mock-editor">
      <span>{props.pageKey}</span>
      <button onClick={props.onExit}>exit-editor</button>
    </div>
  ),
}));

vi.mock('@/lib/api/collector', () => ({
  Collector: (fn: unknown) => fn,
  errorStatus: (error: unknown) =>
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: number }).status
      : undefined,
}));

const mockGetDataSource = vi.hoisted(() => vi.fn());
vi.mock('./data-sources', () => ({
  getDataSource: (key: string) => mockGetDataSource(key),
}));

const mockEditor = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('./editor/context', () => ({
  useEditor: () => mockEditor.current,
}));

vi.mock('./editor/block-chrome', () => ({
  BlockChrome: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-chrome">{children}</div>
  ),
  SortableList: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-sortable">{children}</div>
  ),
}));

const mockFeatureFlag = vi.hoisted(() => ({ current: false }));
vi.mock('@/lib/actions/feature-flag/queries', () => ({
  useFeatureFlag: () => mockFeatureFlag.current,
}));

const mockSystemLayouts = vi.hoisted(() => ({
  current: { layouts: {} } as { layouts: Record<string, unknown> },
}));
vi.mock('@/lib/actions/pageBuilder/queries', () => ({
  useSystemPageLayouts: () => ({ data: mockSystemLayouts.current }),
}));

const mockUserConfig = vi.hoisted(() => ({
  current: undefined as { id: string; value: unknown } | undefined,
}));
const mockResetMutate = vi.hoisted(() => vi.fn());
const mockUseUserConfiguration = vi.hoisted(() => vi.fn());
vi.mock('@/lib/actions/userConfiguration/queries', () => ({
  useUserConfiguration: () => {
    mockUseUserConfiguration();
    return { data: mockUserConfig.current };
  },
  useResetUserConfiguration: () => ({ mutate: mockResetMutate, isPending: false }),
}));

beforeEach(() => {
  mockGetDataSource.mockReset();
  mockEditor.current = null;
  mockFeatureFlag.current = false;
  mockSystemLayouts.current = { layouts: {} };
  mockUserConfig.current = undefined;
  mockResetMutate.mockReset();
  mockUseUserConfiguration.mockReset();
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

function pageBlock(input: {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  span?: 1 | 2 | 3 | 4;
  className?: string;
  data?: { source: string; params?: Record<string, unknown> };
  children?: PageBlock[];
}): PageBlock {
  return { span: 4, props: {}, ...input } as PageBlock;
}

describe('BlockGrid — árvore de blocos', () => {
  it('árvore vazia não renderiza nenhum bloco', () => {
    const { container } = renderWithClient(<BlockGrid blocks={[]} />);

    expect(container.querySelector('.grid')?.children.length).toBe(0);
  });

  it('ignora tipo desconhecido e avisa no console', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderWithClient(
      <BlockGrid blocks={[pageBlock({ id: 'x', type: 'nao.existe' })]} />,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('nao.existe'));
    warn.mockRestore();
  });

  it('bloco sem fonte mostra o aviso de fonte ausente', () => {
    renderWithClient(
      <BlockGrid
        blocks={[pageBlock({ id: 's1', type: 'list.feed', props: { columns: ['name'] } })]}
      />,
    );

    expect(screen.getByText('blockWithoutSource')).toBeInTheDocument();
  });

  it('mostra o skeleton enquanto a fonte carrega e depois o dado real', async () => {
    let resolveFetch!: (value: unknown) => void;
    mockGetDataSource.mockReturnValue({
      kind: 'list',
      fetcher: () => new Promise((resolve) => { resolveFetch = resolve; }),
    });

    const { container } = renderWithClient(
      <BlockGrid
        blocks={[
          pageBlock({
            id: 's1',
            type: 'text.rich',
            props: { content: 'Total: {{total}}' },
            data: { source: 'users.list' },
          }),
        ]}
      />,
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();

    resolveFetch({ data: [], meta: { total: 42 } });

    expect(await screen.findByText('Total: 42')).toBeInTheDocument();
  });

  it('erro de rede mostra o aviso de falha nos dados', async () => {
    mockGetDataSource.mockReturnValue({
      kind: 'list',
      fetcher: async () => {
        throw new Error('boom');
      },
    });

    renderWithClient(
      <BlockGrid
        blocks={[
          pageBlock({
            id: 's1',
            type: 'list.feed',
            props: { columns: ['name'] },
            data: { source: 'x' },
          }),
        ]}
      />,
    );

    expect(await screen.findByText('blockDataError')).toBeInTheDocument();
  });

  it('403 fora do editor some em silêncio em vez de mostrar aviso', async () => {
    mockGetDataSource.mockReturnValue({
      kind: 'list',
      fetcher: async () => {
        throw Object.assign(new Error('forbidden'), { status: 403 });
      },
    });

    const { container } = renderWithClient(
      <BlockGrid
        blocks={[
          pageBlock({
            id: 's1',
            type: 'list.feed',
            props: { columns: ['name'] },
            data: { source: 'x' },
          }),
        ]}
      />,
    );

    await waitFor(() => expect(container.querySelector('.grid')?.children.length).toBe(0));
  });

  it('403 dentro do editor mostra o aviso em vez de esconder o bloco', async () => {
    mockEditor.current = {};
    mockGetDataSource.mockReturnValue({
      kind: 'list',
      fetcher: async () => {
        throw Object.assign(new Error('forbidden'), { status: 403 });
      },
    });

    renderWithClient(
      <BlockGrid
        blocks={[
          pageBlock({
            id: 's1',
            type: 'list.feed',
            props: { columns: ['name'] },
            data: { source: 'x' },
          }),
        ]}
      />,
    );

    expect(await screen.findByText('blockForbidden')).toBeInTheDocument();
    expect(within(screen.getByTestId('mock-chrome')).getByText('blockForbidden')).toBeInTheDocument();
  });

  it('filtra o className do bloco antes de passar pro componente', () => {
    const { container } = renderWithClient(
      <BlockGrid
        blocks={[
          pageBlock({
            id: 'g1',
            type: 'group',
            props: { title: 'G' },
            className: 'text-center bg-red-500',
          }),
        ]}
      />,
    );

    expect(document.querySelector('.bg-red-500')).toBeNull();
    expect(container.querySelector('.text-center')).not.toBeNull();
  });
});

describe('BlockGrid — containers e filhos', () => {
  const grouped = () =>
    pageBlock({
      id: 'g1',
      type: 'group',
      props: { title: 'Grupo' },
      children: [pageBlock({ id: 'c1', type: 'list.feed', props: { columns: ['name'] } })],
    });

  it('renderiza os filhos fora do editor, sem SortableList', () => {
    renderWithClient(<BlockGrid blocks={[grouped()]} />);

    expect(screen.getByText('Grupo')).toBeInTheDocument();
    // "blockWithoutSource" só aparece se o filho (list.feed sem fonte) também renderizou.
    expect(screen.getByText('blockWithoutSource')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-sortable')).not.toBeInTheDocument();
  });

  it('usa SortableList para ordenar os filhos durante a edição', () => {
    mockEditor.current = {};
    renderWithClient(<BlockGrid blocks={[grouped()]} />);

    expect(screen.getByTestId('mock-sortable')).toBeInTheDocument();
    expect(screen.getByText('blockWithoutSource')).toBeInTheDocument();
  });

  it('bloco filho de tipo desconhecido é ignorado mas os irmãos continuam', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderWithClient(
      <BlockGrid
        blocks={[
          pageBlock({
            id: 'g1',
            type: 'group',
            props: { title: 'Grupo' },
            children: [
              pageBlock({ id: 'bad', type: 'nao.existe' }),
              pageBlock({ id: 'ok', type: 'list.feed', props: { columns: ['name'] } }),
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText('blockWithoutSource')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('nao.existe'));
    warn.mockRestore();
  });

  it('bloco de topo usa Card; filho (bare) não ganha Card aninhado', () => {
    const { container } = renderWithClient(<BlockGrid blocks={[grouped()]} />);

    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(1);
  });
});

describe('BlockGrid — paginação de table.basic', () => {
  it('avança de página ao clicar em próximo e refaz a busca', async () => {
    const user = userEvent.setup();
    mockGetDataSource.mockImplementation(() => ({
      kind: 'list',
      fetcher: async (params?: Record<string, unknown>) => {
        const page = Number(params?.page) || 1;
        return {
          data: [{ id: page, name: `Linha ${page}` }],
          meta: { total: 30, page, limit: 10, totalPages: 3 },
        };
      },
    }));

    renderWithClient(
      <BlockGrid
        blocks={[
          pageBlock({
            id: 'tbl',
            type: 'table.basic',
            props: { columns: ['name'] },
            data: { source: 'users.list' },
          }),
        ]}
      />,
    );

    expect(await screen.findByText('Linha 1')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'next' }));

    expect(await screen.findByText('Linha 2')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('ignora params.page inválido e começa na página 1', async () => {
    mockGetDataSource.mockImplementation(() => ({
      kind: 'list',
      fetcher: async (params?: Record<string, unknown>) => {
        const page = Number(params?.page) || 1;
        return { data: [], meta: { total: 30, page, limit: 10, totalPages: 3 } };
      },
    }));

    renderWithClient(
      <BlockGrid
        blocks={[
          pageBlock({
            id: 'tbl',
            type: 'table.basic',
            props: { columns: ['name'] },
            data: { source: 'users.list', params: { page: 'oops' } },
          }),
        ]}
      />,
    );

    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
  });
});

describe('BlockGrid — BlockBoundary', () => {
  it('isola o bloco que quebra ao renderizar em vez de derrubar a página', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetDataSource.mockReturnValue({
      kind: 'list',
      // `data` vem como string em vez de array: BasicTableRows chama rows.map e quebra.
      fetcher: async () => ({ data: 'not-an-array', meta: { total: 1 } }),
    });

    renderWithClient(
      <BlockGrid
        blocks={[
          pageBlock({
            id: 'tbl',
            type: 'table.basic',
            props: { columns: ['name'] },
            data: { source: 'users.list' },
          }),
        ]}
      />,
    );

    expect(await screen.findByText('blockUnavailable')).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});

describe('PageRenderer', () => {
  it('sem layout customizado, mostra o fallback da página em código e nenhuma ação', () => {
    renderWithClient(
      <PageRenderer pageKey="/dashboard" fallback={<div data-testid="fallback">Fallback</div>} />,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'editor.edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'restoreDefault' })).not.toBeInTheDocument();
  });

  it('feature flag liga o botão de editar; entra e sai do editor', async () => {
    const user = userEvent.setup();
    mockFeatureFlag.current = true;

    renderWithClient(
      <PageRenderer pageKey="/dashboard" fallback={<div data-testid="fallback" />} />,
    );

    await user.click(screen.getByRole('button', { name: 'editor.edit' }));

    expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
    expect(screen.getByText('/dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'exit-editor' }));

    expect(screen.queryByTestId('mock-editor')).not.toBeInTheDocument();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('layout inválido do usuário mostra o aviso, o fallback e habilita restaurar', async () => {
    const user = userEvent.setup();
    mockUserConfig.current = { id: 'cfg-1', value: { '/dashboard': { v: 1 } } };

    renderWithClient(
      <PageRenderer pageKey="/dashboard" fallback={<div data-testid="fallback" />} />,
    );

    expect(screen.getByText('invalidLayout')).toBeInTheDocument();
    expect(screen.getByText('invalidLayoutDescription')).toBeInTheDocument();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'restoreDefault' }));

    expect(mockResetMutate).toHaveBeenCalledWith('cfg-1');
  });

  it('layout do sistema renderiza os blocos sem oferecer restaurar', () => {
    mockSystemLayouts.current = {
      layouts: {
        '/dashboard': {
          v: 1,
          blocks: [{ id: 'b1', type: 'group', span: 4, props: { title: 'Do sistema' } }],
        },
      },
    };

    renderWithClient(
      <PageRenderer pageKey="/dashboard" fallback={<div data-testid="fallback" />} />,
    );

    expect(screen.getByText('Do sistema')).toBeInTheDocument();
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'restoreDefault' })).not.toBeInTheDocument();
  });

  it('layout do usuário válido oferece restaurar o padrão', () => {
    mockUserConfig.current = {
      id: 'cfg-2',
      value: {
        '/dashboard': {
          v: 1,
          blocks: [{ id: 'b1', type: 'group', span: 4, props: { title: 'Meu layout' } }],
        },
      },
    };

    renderWithClient(
      <PageRenderer pageKey="/dashboard" fallback={<div data-testid="fallback" />} />,
    );

    expect(screen.getByText('Meu layout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'restoreDefault' })).toBeEnabled();
  });
});

describe('LayoutBody — layout injetado', () => {
  it('renderiza o layout recebido sem consultar a configuração do usuário', () => {
    renderWithClient(
      <LayoutBody
        profile="dashboard"
        layout={{
          v: 1,
          blocks: [pageBlock({ id: 'b1', type: 'group', props: { title: 'Injetado' } })],
        }}
      />,
    );

    expect(screen.getByText('Injetado')).toBeInTheDocument();
    // É o que a página pública usa: nenhum hook de config, de sessão ou de flag é chamado.
    expect(mockUseUserConfiguration).not.toHaveBeenCalled();
  });

  it('descarta bloco que não pertence ao profile', () => {
    renderWithClient(
      <LayoutBody
        profile="proposal"
        layout={{
          v: 1,
          blocks: [
            pageBlock({ id: 'b1', type: 'alert.banner', props: { title: 'Fica', content: 'ok' } }),
            pageBlock({
              id: 'b2',
              type: 'table.basic',
              props: { title: 'Sai', columns: ['a'] },
              data: { source: 'users.list' },
            }),
          ],
        }}
      />,
    );

    expect(screen.getByText('Fica')).toBeInTheDocument();
    expect(screen.queryByText('Sai')).not.toBeInTheDocument();
    // Bloco fora do profile nem chega a pedir fonte de dado.
    expect(mockGetDataSource).not.toHaveBeenCalled();
  });
});
