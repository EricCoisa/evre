import React from 'react';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOCK_REGISTRY, isKnownBlock } from './registry';
import { ProposalTermsProvider, type ProposalTerms } from './proposal-terms-context';

vi.mock('@/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** `iframe` resolve a URL via `usePresignedUrl` (react-query + server action) — mockado direto
 * em vez de montar QueryClientProvider, igual o padrão de `renderer.test.tsx` para os hooks de ação. */
const mockPresignedUrl = vi.hoisted(() => ({
  current: { data: undefined, isLoading: false, isError: false } as {
    data?: { url: string };
    isLoading: boolean;
    isError: boolean;
  },
}));
vi.mock('@/lib/actions/storage/queries', () => ({
  usePresignedUrl: () => mockPresignedUrl.current,
}));

// ResponsiveContainer nunca ganha tamanho real no jsdom, então o recharts de verdade não
// desenha nada — troca pelos data-testid que expõem o que cada bloco recebeu (mesmo padrão de
// chart-area-interactive.test.tsx).
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  AreaChart: ({ data, children }: { data: unknown[]; children: ReactNode }) => (
    <div data-testid="area-chart" data-count={data.length}>
      {children}
    </div>
  ),
  Area: ({ dataKey }: { dataKey: string }) => <div data-testid={`area-${dataKey}`} />,
  BarChart: ({ data, children }: { data: unknown[]; children: ReactNode }) => (
    <div data-testid="bar-chart" data-count={data.length}>
      {children}
    </div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid={`bar-${dataKey}`} />,
  LineChart: ({ data, children }: { data: unknown[]; children: ReactNode }) => (
    <div data-testid="line-chart" data-count={data.length}>
      {children}
    </div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  CartesianGrid: () => null,
  XAxis: () => null,
}));

describe('table.basic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays pagination controls and requests the adjacent page', () => {
    const onPageChange = vi.fn();
    const TableBlock = BLOCK_REGISTRY['table.basic'];

    render(
      React.createElement(TableBlock, {
        props: { columns: ['name'] },
        data: {
          data: [{ id: 1, name: 'Ada' }],
          meta: { total: 21, page: 2, limit: 10, totalPages: 3 },
        },
        onPageChange,
      }),
    );

    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('disables previous and next at the first and last pages', () => {
    const TableBlock = BLOCK_REGISTRY['table.basic'];
    const { rerender } = render(
      React.createElement(TableBlock, {
        props: { columns: ['name'] },
        data: { data: [], meta: { total: 11, page: 1, limit: 10, totalPages: 2 } },
        onPageChange: vi.fn(),
      }),
    );

    expect(screen.getByRole('button', { name: 'previous' })).toBeDisabled();
    rerender(
      React.createElement(TableBlock, {
        props: { columns: ['name'] },
        data: { data: [], meta: { total: 11, page: 2, limit: 10, totalPages: 2 } },
        onPageChange: vi.fn(),
      }),
    );
    expect(screen.getByRole('button', { name: 'next' })).toBeDisabled();
  });

  it('hides pagination controls when there is only one page', () => {
    const TableBlock = BLOCK_REGISTRY['table.basic'];
    render(
      React.createElement(TableBlock, {
        props: { columns: ['name'] },
        data: { data: [{ id: 1, name: 'Ada' }], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } },
        onPageChange: vi.fn(),
      }),
    );

    expect(screen.queryByRole('button', { name: 'previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'next' })).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument();
  });

  it('keeps the table visible with skeleton rows while a page loads', () => {
    const TableBlock = BLOCK_REGISTRY['table.basic'];
    render(
      React.createElement(TableBlock, {
        props: { columns: ['name'] },
        data: {
          data: [{ id: 1, name: 'Ada' }],
          meta: { total: 21, page: 1, limit: 10, totalPages: 3 },
        },
        onPageChange: vi.fn(),
        isLoading: true,
      }),
    );

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Ada')).not.toBeInTheDocument();
    expect(document.querySelectorAll('tbody .animate-pulse')).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'next' })).toBeDisabled();
  });

  it('columns fora do formato array vira tabela sem nenhuma coluna, sem quebrar', () => {
    const TableBlock = BLOCK_REGISTRY['table.basic'];
    render(
      React.createElement(TableBlock, {
        props: { columns: 'name' },
        data: { data: [{ id: 1, name: 'Ada' }] },
      }),
    );

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
  });

  it('sem title, o cabeçalho não ganha CardTitle', () => {
    const TableBlock = BLOCK_REGISTRY['table.basic'];
    render(
      React.createElement(TableBlock, {
        props: { columns: ['name'] },
        data: { data: [] },
      }),
    );

    expect(document.querySelector('[data-slot="card-title"]')).not.toBeInTheDocument();
  });
});

describe('group', () => {
  it('com title, mostra o CardTitle dentro de um Card (não bare)', () => {
    const Group = BLOCK_REGISTRY.group;
    render(
      React.createElement(
        Group,
        { props: { title: 'Usuários' }, children: React.createElement('span', null, 'filho') },
      ),
    );

    expect(screen.getByText('Usuários')).toBeInTheDocument();
    expect(screen.getByText('filho')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="card"]')).toBeInTheDocument();
  });

  it('sem title, não mostra CardTitle mas ainda renderiza os filhos', () => {
    const Group = BLOCK_REGISTRY.group;
    render(
      React.createElement(Group, {
        props: {},
        children: React.createElement('span', null, 'filho'),
      }),
    );

    expect(document.querySelector('[data-slot="card-title"]')).not.toBeInTheDocument();
    expect(screen.getByText('filho')).toBeInTheDocument();
  });

  it('bare dispensa o Card e mantém o título e os filhos', () => {
    const Group = BLOCK_REGISTRY.group;
    render(
      React.createElement(Group, {
        props: { title: 'Usuários' },
        bare: true,
        children: React.createElement('span', null, 'filho'),
      }),
    );

    expect(screen.getByText('Usuários')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="card"]')).not.toBeInTheDocument();
  });

  it('title que vem como objeto não quebra o render — str() devolve vazio', () => {
    const Group = BLOCK_REGISTRY.group;
    render(React.createElement(Group, { props: { title: { nested: true } } }));

    // A prop é truthy (é um objeto), então o CardTitle existe, só que vazio.
    expect(document.querySelector('[data-slot="card-title"]')).toHaveTextContent('');
  });
});

describe('text.rich — interpolação de variáveis {{var}} com fonte de dados', () => {
  it('substitui {{total}} e campos da fonte no meio do texto', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    render(
      React.createElement(RichBlock, {
        props: {
          content: 'Bom dia, temos {{total}} usuários no sistema hoje (último: {{name}})',
        },
        data: {
          data: [{ id: 1, name: 'Ana' }],
          meta: { total: 42 },
        },
      }),
    );

    expect(
      screen.getByText('Bom dia, temos 42 usuários no sistema hoje (último: Ana)'),
    ).toBeInTheDocument();
  });

  it('sem dados carregados, substitui {{var}} por um traço', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    render(
      React.createElement(RichBlock, {
        props: { content: 'Total: {{total}}' },
      }),
    );

    expect(screen.getByText('Total: —')).toBeInTheDocument();
  });
});

describe('chart.area', () => {
  it('mostra título, descrição e os pontos da série', () => {
    const ChartBlock = BLOCK_REGISTRY['chart.area'];
    render(
      React.createElement(ChartBlock, {
        props: { title: 'Cadastros', description: 'Últimos 30 dias' },
        data: {
          data: [
            { date: '2024-01-01', value: 10 },
            { date: '2024-01-02', value: 20 },
          ],
        },
      }),
    );

    expect(screen.getByText('Cadastros')).toBeInTheDocument();
    expect(screen.getByText('Últimos 30 dias')).toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '2');
    expect(screen.getByTestId('area-value')).toBeInTheDocument();
  });

  it('sem description, não mostra o CardDescription', () => {
    const ChartBlock = BLOCK_REGISTRY['chart.area'];
    render(React.createElement(ChartBlock, { props: { title: 'Cadastros' }, data: { data: [] } }));

    expect(screen.getByText('Cadastros')).toBeInTheDocument();
    expect(screen.queryByText('Últimos 30 dias')).not.toBeInTheDocument();
    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '0');
  });

  it('sem data (undefined), usa lista vazia em vez de quebrar', () => {
    const ChartBlock = BLOCK_REGISTRY['chart.area'];
    render(React.createElement(ChartBlock, { props: { title: 'Cadastros' } }));

    expect(screen.getByTestId('area-chart')).toHaveAttribute('data-count', '0');
  });
});

describe('chart.bar', () => {
  it('mostra título, descrição e as barras da série', () => {
    const BarBlock = BLOCK_REGISTRY['chart.bar'];
    render(
      React.createElement(BarBlock, {
        props: { title: 'Cadastros por dia', description: 'Último mês' },
        data: {
          data: [
            { date: '2024-01-01', value: 15 },
            { date: '2024-01-02', value: 25 },
          ],
        },
      }),
    );

    expect(screen.getByText('Cadastros por dia')).toBeInTheDocument();
    expect(screen.getByText('Último mês')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-count', '2');
    expect(screen.getByTestId('bar-value')).toBeInTheDocument();
  });

  it('sem dados, não quebra', () => {
    const BarBlock = BLOCK_REGISTRY['chart.bar'];
    render(React.createElement(BarBlock, { props: { title: 'Cadastros' } }));

    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-count', '0');
  });
});

describe('chart.line', () => {
  it('mostra título, descrição e as linhas da série', () => {
    const LineBlock = BLOCK_REGISTRY['chart.line'];
    render(
      React.createElement(LineBlock, {
        props: { title: 'Tendência', description: 'Visitas diárias' },
        data: {
          data: [
            { date: '2024-01-01', value: 100 },
            { date: '2024-01-02', value: 150 },
          ],
        },
      }),
    );

    expect(screen.getByText('Tendência')).toBeInTheDocument();
    expect(screen.getByText('Visitas diárias')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toHaveAttribute('data-count', '2');
    expect(screen.getByTestId('line-value')).toBeInTheDocument();
  });
});




describe('text.rich', () => {
  it('renderiza conteúdo formatado com negrito, itálico, código e link', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    render(
      React.createElement(RichBlock, {
        props: {
          content: 'Texto com *negrito*, _itálico_, ~riscado~, ```codigo``` e [Guia](/docs).',
        },
      }),
    );

    expect(screen.getByText('negrito')).toBeInTheDocument();
    expect(screen.getByText('itálico')).toBeInTheDocument();
    expect(screen.getByText('riscado')).toBeInTheDocument();
    expect(screen.getByText('codigo')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Guia' });
    expect(link).toHaveAttribute('href', '/docs');
  });

  it('preserva quebras de linha e formatação do RichTextInput', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    render(
      React.createElement(RichBlock, {
        props: {
          content: 'Primeira linha\n\nSegunda linha com *destaque*\n- Ponto A\n- Ponto B',
        },
      }),
    );

    expect(screen.getByText('destaque')).toBeInTheDocument();
    expect(screen.getByText(/Primeira linha/)).toBeInTheDocument();
    expect(screen.getByText(/Ponto A/)).toBeInTheDocument();
  });

  it('não cria link para urls inseguras com javascript:', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    render(
      React.createElement(RichBlock, {
        props: {
          content: '[Ataque](javascript:alert(1))',
        },
      }),
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Ataque')).toBeInTheDocument();
  });

  it('modo bare renderiza sem a casca de Card', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    render(
      React.createElement(RichBlock, {
        props: { content: 'Conteúdo livre' },
        bare: true,
      }),
    );

    expect(screen.getByText('Conteúdo livre')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="card"]')).not.toBeInTheDocument();
  });
});

describe('button.action', () => {
  it('renderiza somente o botão com link e rótulo em rich text', () => {
    const ButtonBlock = BLOCK_REGISTRY['button.action'];
    render(
      React.createElement(ButtonBlock, {
        props: {
          label: 'Ver *Relatórios*',
          url: '/relatorios',
        },
      }),
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/relatorios');
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
  });

  it('não cria link para url insegura e renderiza botão sem href', () => {
    const ButtonBlock = BLOCK_REGISTRY['button.action'];
    render(
      React.createElement(ButtonBlock, {
        props: {
          label: 'Clique',
          url: 'javascript:alert(1)',
        },
      }),
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clique' })).toBeInTheDocument();
  });
});

describe('list.feed', () => {
  it('mostra lista com campo principal e campo secundário', () => {
    const FeedBlock = BLOCK_REGISTRY['list.feed'];
    render(
      React.createElement(FeedBlock, {
        props: { title: 'Atividades Recentes', columns: ['action', 'module'] },
        data: {
          data: [
            { id: 1, action: 'User Created', module: 'AUTH' },
            { id: 2, action: 'Password Changed', module: 'SETTINGS' },
          ],
        },
      }),
    );

    expect(screen.getByText('Atividades Recentes')).toBeInTheDocument();
    expect(screen.getByText('User Created')).toBeInTheDocument();
    expect(screen.getByText('AUTH')).toBeInTheDocument();
    expect(screen.getByText('Password Changed')).toBeInTheDocument();
    expect(screen.getByText('SETTINGS')).toBeInTheDocument();
  });

  it('mostra estado vazio com texto de sem registros', () => {
    const FeedBlock = BLOCK_REGISTRY['list.feed'];
    render(
      React.createElement(FeedBlock, {
        props: { columns: ['action'] },
        data: { data: [] },
      }),
    );

    expect(screen.getByText('noRecords')).toBeInTheDocument();
  });

  it('mostra skeletons quando isLoading é true', () => {
    const FeedBlock = BLOCK_REGISTRY['list.feed'];
    render(
      React.createElement(FeedBlock, {
        props: { columns: ['action', 'module'] },
        data: { data: [] },
        isLoading: true,
      }),
    );

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});

describe('topic', () => {
  it('renderiza título, descrição e os 3 itens da lista', () => {
    const TopicBlock = BLOCK_REGISTRY.topic;
    render(
      React.createElement(TopicBlock, {
        props: {
          title: 'Escopo',
          description: 'O que entra no projeto',
          items: ['Descoberta', 'Implementação', 'Entrega'],
        },
      }),
    );

    expect(screen.getByText('Escopo')).toBeInTheDocument();
    expect(screen.getByText('O que entra no projeto')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});

describe('image', () => {
  it('sem alt não quebra — renderiza com alt vazio', () => {
    const ImageBlock = BLOCK_REGISTRY.image;
    render(
      React.createElement(ImageBlock, {
        props: { url: 'https://cdn.example.com/mock.png' },
      }),
    );

    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('alt', '');
  });

  it('mostra a legenda quando informada', () => {
    const ImageBlock = BLOCK_REGISTRY.image;
    render(
      React.createElement(ImageBlock, {
        props: { url: 'https://cdn.example.com/mock.png', caption: 'Tela inicial' },
      }),
    );

    expect(screen.getByText('Tela inicial')).toBeInTheDocument();
  });
});

describe('text.rich — presets (heading1–heading4, quote, lead, caption, paragraph)', () => {
  it('preset="heading1" ou "h1" renderiza um <h1> de verdade', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    render(
      React.createElement(RichBlock, {
        props: { content: 'Título Principal', preset: 'heading1' },
      }),
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'Título Principal' });
    expect(heading.tagName).toBe('H1');
  });

  it('preset="heading2" ou "h2" renderiza um <h2> de verdade', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    render(
      React.createElement(RichBlock, {
        props: { content: 'Escopo do projeto', preset: 'heading2' },
      }),
    );

    const heading = screen.getByRole('heading', { level: 2, name: 'Escopo do projeto' });
    expect(heading.tagName).toBe('H2');
  });

  it('preset="heading3" e "heading4" renderizam <h3> e <h4> reais', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    const { rerender } = render(
      React.createElement(RichBlock, {
        props: { content: 'Subseção 3', preset: 'heading3' },
      }),
    );
    expect(screen.getByRole('heading', { level: 3 }).tagName).toBe('H3');

    rerender(
      React.createElement(RichBlock, {
        props: { content: 'Subseção 4', preset: 'heading4' },
      }),
    );
    expect(screen.getByRole('heading', { level: 4 }).tagName).toBe('H4');
  });

  it('preset="quote" renderiza <blockquote>', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    const { container } = render(
      React.createElement(RichBlock, {
        props: { content: 'Uma citação inspiradora', preset: 'quote' },
      }),
    );

    expect(container.querySelector('blockquote')).toBeInTheDocument();
    expect(screen.getByText('Uma citação inspiradora')).toBeInTheDocument();
  });

  it('preset ausente ou inválido cai no default ("paragraph")', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    const { container } = render(
      React.createElement(RichBlock, {
        props: { content: 'Texto comum', preset: 'desconhecido' },
      }),
    );

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(container.querySelector('blockquote')).not.toBeInTheDocument();
    expect(screen.getByText('Texto comum')).toBeInTheDocument();
  });

  it('nunca nasce dentro de um Card', () => {
    const RichBlock = BLOCK_REGISTRY['text.rich'];
    render(
      React.createElement(RichBlock, {
        props: { content: 'Título de Seção', preset: 'heading2' },
      }),
    );

    expect(document.querySelector('[data-slot="card"]')).not.toBeInTheDocument();
  });
});

describe('divider', () => {
  it('renderiza um <hr>', () => {
    const DividerBlock = BLOCK_REGISTRY.divider;
    render(React.createElement(DividerBlock, { props: {} }));

    expect(document.querySelector('hr')).toBeInTheDocument();
  });

  it('nunca nasce dentro de um Card', () => {
    const DividerBlock = BLOCK_REGISTRY.divider;
    render(React.createElement(DividerBlock, { props: { spacing: 'lg' } }));

    expect(document.querySelector('[data-slot="card"]')).not.toBeInTheDocument();
  });
});

describe('investment', () => {
  it('sem contexto mostra o estado vazio explícito', () => {
    const InvestmentBlock = BLOCK_REGISTRY.investment;
    render(React.createElement(InvestmentBlock, { props: {} }));

    expect(screen.getByText('investmentEmpty')).toBeInTheDocument();
  });

  it('formata totalCents: 2400000 + BRL como R$ 24.000,00', () => {
    const InvestmentBlock = BLOCK_REGISTRY.investment;
    const terms: ProposalTerms = {
      totalCents: 2400000,
      currency: 'BRL',
      recurrence: 'ONE_TIME',
      termDays: null,
      validUntil: null,
      includedItems: [],
      optionalItems: [],
    };

    render(
      React.createElement(ProposalTermsProvider, {
        terms,
        children: React.createElement(InvestmentBlock, { props: {} }),
      }),
    );

    expect(screen.getByText('R$ 24.000,00')).toBeInTheDocument();
  });

  it('mostra itens inclusos e, só com showOptional, os opcionais', () => {
    const InvestmentBlock = BLOCK_REGISTRY.investment;
    const terms: ProposalTerms = {
      totalCents: 100000,
      currency: 'BRL',
      recurrence: 'MONTHLY',
      termDays: 30,
      validUntil: null,
      includedItems: ['Suporte'],
      optionalItems: ['Manutenção extra'],
    };

    render(
      React.createElement(ProposalTermsProvider, {
        terms,
        children: React.createElement(InvestmentBlock, { props: {} }),
      }),
    );

    expect(screen.getByText('Suporte')).toBeInTheDocument();
    expect(screen.queryByText('Manutenção extra')).not.toBeInTheDocument();

    render(
      React.createElement(ProposalTermsProvider, {
        terms,
        children: React.createElement(InvestmentBlock, { props: { showOptional: true } }),
      }),
    );

    expect(screen.getByText('Manutenção extra')).toBeInTheDocument();
  });
});

describe('price', () => {
  it('rows com 3 linhas renderiza 3 linhas rótulo → valor', () => {
    const PriceBlock = BLOCK_REGISTRY.price;
    render(
      React.createElement(PriceBlock, {
        props: {
          rows: ['Desenvolvimento|180000', 'Design|50000', 'Infra|20000'],
        },
      }),
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Desenvolvimento')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.800,00')).toBeInTheDocument();
  });

  it('totalCents: 2400000 + BRL sai R$ 24.000,00', () => {
    const PriceBlock = BLOCK_REGISTRY.price;
    render(
      React.createElement(PriceBlock, {
        props: { rows: [], totalCents: 2400000, currency: 'BRL' },
      }),
    );

    expect(screen.getByText('R$ 24.000,00')).toBeInTheDocument();
  });

  it('highlight aplica a moldura de destaque', () => {
    const PriceBlock = BLOCK_REGISTRY.price;
    render(
      React.createElement(PriceBlock, { props: { rows: [], highlight: true } }),
    );

    expect(document.querySelector('[data-slot="card"]')).toHaveClass('border-primary');
  });

  it('sem highlight, não ganha a moldura de destaque', () => {
    const PriceBlock = BLOCK_REGISTRY.price;
    render(React.createElement(PriceBlock, { props: { rows: [] } }));

    expect(document.querySelector('[data-slot="card"]')).not.toHaveClass('border-primary');
  });

  it('duas instâncias no mesmo layout renderizam independentes', () => {
    const PriceBlock = BLOCK_REGISTRY.price;
    render(
      <>
        {React.createElement(PriceBlock, {
          props: { title: 'Projeto', rows: ['Setup|100000'], recurrence: 'ONE_TIME' },
        })}
        {React.createElement(PriceBlock, {
          props: { title: 'Mensalidade', rows: ['Suporte|5000'], recurrence: 'MONTHLY' },
        })}
      </>,
    );

    expect(screen.getByText('Projeto')).toBeInTheDocument();
    expect(screen.getByText('Mensalidade')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.000,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
  });

  it('linha sem "|" ou com valor não numérico mostra "—" em vez de quebrar', () => {
    const PriceBlock = BLOCK_REGISTRY.price;
    render(
      React.createElement(PriceBlock, {
        props: { rows: ['Sem separador', 'Rótulo|abc'] },
      }),
    );

    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});

describe('iframe', () => {
  const NO_SAME_ORIGIN_SANDBOX = 'allow-scripts allow-popups allow-modals allow-forms';

  beforeEach(() => {
    mockPresignedUrl.current = {
      data: { url: 'https://cdn.example.com/artifacts/demo.html' },
      isLoading: false,
      isError: false,
    };
  });

  it('sem storageKey mostra aviso em vez do iframe', () => {
    const IframeBlock = BLOCK_REGISTRY.iframe;
    render(React.createElement(IframeBlock, { props: {} }));

    expect(screen.getByText('iframeMissingArtifact')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('colapsado: iframe não é interativo — scrolling="no" e camada de clique por cima, sandbox sem allow-same-origin', () => {
    const IframeBlock = BLOCK_REGISTRY.iframe;
    render(
      React.createElement(IframeBlock, { props: { storageKey: 'proposals/p1/artifacts/x.html' } }),
    );

    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe).toHaveAttribute('scrolling', 'no');
    expect(iframe?.getAttribute('sandbox')).toBe(NO_SAME_ORIGIN_SANDBOX);
    expect(iframe?.getAttribute('sandbox')).not.toContain('allow-same-origin');

    // camada transparente captura o clique — não dá para digitar/rolar dentro do preview
    expect(screen.getByRole('button', { name: 'iframeOpen' })).toBeInTheDocument();
    // modal ainda fechado: só o iframe do preview existe
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('clique/toque abre o modal com scrolling="yes" e sandbox igual, sem allow-same-origin', () => {
    const IframeBlock = BLOCK_REGISTRY.iframe;
    render(
      React.createElement(IframeBlock, { props: { storageKey: 'proposals/p1/artifacts/x.html' } }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'iframeOpen' }));

    const iframes = document.querySelectorAll('iframe');
    expect(iframes).toHaveLength(2);
    const modalIframe = iframes[1];
    expect(modalIframe).toHaveAttribute('scrolling', 'yes');
    expect(modalIframe.getAttribute('sandbox')).toBe(NO_SAME_ORIGIN_SANDBOX);
    expect(modalIframe.getAttribute('sandbox')).not.toContain('allow-same-origin');

    // o preview continua com o mesmo sandbox restrito — liberar no modal não afrouxa o resto
    const previewIframe = iframes[0];
    expect(previewIframe.getAttribute('sandbox')).toBe(NO_SAME_ORIGIN_SANDBOX);
  });

  it('falha ao resolver a URL mostra aviso no lugar do bloco, sem derrubar o componente', () => {
    mockPresignedUrl.current = { data: undefined, isLoading: false, isError: true };
    const IframeBlock = BLOCK_REGISTRY.iframe;
    render(
      React.createElement(IframeBlock, { props: { storageKey: 'proposals/p1/artifacts/x.html' } }),
    );

    expect(screen.getByText('iframeLoadError')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
});

describe('isKnownBlock', () => {
  it('reconhece todo tipo do BLOCK_REGISTRY e recusa tipo inventado', () => {
    for (const type of Object.keys(BLOCK_REGISTRY)) {
      expect(isKnownBlock(type)).toBe(true);
    }
    expect(isKnownBlock('nao.existe')).toBe(false);
  });
});
