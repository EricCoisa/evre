import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SetPageLayoutUseCase } from './set-page-layout.use-case';
import { GetUserConfigurationByKeyUseCase } from '../../user-configuration/use-cases/get-by-key.use-case';
import { SetUserConfigurationUseCase } from '../../user-configuration/use-cases/set-user-configuration.use-case';
import { PageSourceRegistry } from '../page-source-registry.service';
import { PageBuilderBridgeService } from '../page-builder-bridge.service';
import { PageLayoutValidator } from '../page-layout-validator.service';
import {
  PAGE_LAYOUTS_KEY,
  SetPageLayoutSchema,
  type PageLayout,
} from '../dto/page-layout.dto';

const layout = (
  source?: string,
  type = 'stat.card',
  params?: Record<string, unknown>,
): PageLayout => ({
  v: 1,
  blocks: [
    {
      id: 'b1',
      type,
      span: 2,
      ...(source ? { data: { source, ...(params ? { params } : {}) } } : {}),
    },
  ],
});

const usersListSource = {
  key: 'users.list',
  kind: 'list' as const,
  description: '',
  roles: ['ADMIN'],
  params: [
    { name: 'page', type: 'number' as const, description: 'inteiro >= 1' },
    { name: 'search', type: 'string' as const, description: 'texto' },
    { name: 'active', type: 'boolean' as const, description: 'filtro' },
  ],
};

const mockGetByKey = { execute: vi.fn() };
const mockSet = { execute: vi.fn() };
const mockSources = {
  listForRole: vi.fn(),
  has: vi.fn(),
  getKind: vi.fn(),
  get: vi.fn(),
};
const mockBridge = { describeSchema: vi.fn() };

/** Confere que o schema aceita o argumento aninhado serializado como string e valida o mesmo conteúdo. */
describe('SetPageLayoutSchema — layout como string JSON', () => {
  const valid = {
    v: 1,
    blocks: [{ id: 'b1', type: 'stat.card', data: { source: 'users.list' } }],
  };

  it('aceita objeto', () => {
    const parsed = SetPageLayoutSchema.safeParse({
      pageKey: '/dashboard',
      layout: valid,
    });

    expect(parsed.success).toBe(true);
  });

  it('aceita string JSON e devolve objeto já parseado', () => {
    const parsed = SetPageLayoutSchema.safeParse({
      pageKey: '/dashboard',
      layout: JSON.stringify(valid),
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.layout.blocks[0].type).toBe('stat.card');
  });

  it('continua recusando conteúdo inválido dentro da string', () => {
    const parsed = SetPageLayoutSchema.safeParse({
      pageKey: '/dashboard',
      layout: JSON.stringify({ v: 1, blocks: [{ id: 'b1' }] }),
    });

    expect(parsed.success).toBe(false);
  });

  it('string que não é JSON falha com erro de schema, sem estourar exceção', () => {
    expect(() =>
      SetPageLayoutSchema.safeParse({ pageKey: '/dashboard', layout: 'não é json {' }),
    ).not.toThrow();
    expect(
      SetPageLayoutSchema.safeParse({ pageKey: '/dashboard', layout: 'não é json {' })
        .success,
    ).toBe(false);
  });

  // A4: `source` (fonte real) e `inline` (payload colado) são mutuamente exclusivos — estrutural,
  // não depende de `kind`, então checado aqui no schema de forma, antes do validador semântico.
  it('recusa bloco com source e inline ao mesmo tempo', () => {
    const parsed = SetPageLayoutSchema.safeParse({
      pageKey: '/dashboard',
      layout: {
        v: 1,
        blocks: [
          {
            id: 'b1',
            type: 'stat.card',
            data: { source: 'users.list', inline: { data: [] } },
          },
        ],
      },
    });

    expect(parsed.success).toBe(false);
  });

  it('aceita bloco só com inline (sem source)', () => {
    const parsed = SetPageLayoutSchema.safeParse({
      pageKey: '/dashboard',
      layout: {
        v: 1,
        blocks: [{ id: 'b1', type: 'stat.card', data: { inline: { data: [] } } }],
      },
    });

    expect(parsed.success).toBe(true);
  });
});

describe('SetPageLayoutUseCase', () => {
  let useCase: SetPageLayoutUseCase;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SetPageLayoutUseCase,
        // A validação semântica saiu para um serviço compartilhado com a escrita do layout
        // de sistema; o use-case continua responsável só pelo merge e pela gravação.
        PageLayoutValidator,
        { provide: GetUserConfigurationByKeyUseCase, useValue: mockGetByKey },
        { provide: SetUserConfigurationUseCase, useValue: mockSet },
        { provide: PageSourceRegistry, useValue: mockSources },
        { provide: PageBuilderBridgeService, useValue: mockBridge },
      ],
    }).compile();
    useCase = mod.get(SetPageLayoutUseCase);
    vi.clearAllMocks();
    mockSources.listForRole.mockReturnValue([usersListSource]);
    mockSources.getKind.mockReturnValue('list');
    mockSources.get.mockReturnValue(usersListSource);
    // A ponte devolve o catálogo JÁ filtrado pelo profile; o mock espelha isso.
    mockBridge.describeSchema.mockImplementation((profile?: string) => {
      const dataBlocks = [
        { type: 'stat.card', description: '', accepts: ['list', 'count'], container: false, props: [] },
        { type: 'chart.area', description: '', accepts: ['series'], container: false, props: [] },
      ];
      const contentBlocks = [
        { type: 'group', description: '', accepts: [], container: true, props: [] },
        { type: 'text.rich', description: '', accepts: [], container: false, inline: true, props: [] },
      ];
      return Promise.resolve({
        // A3/A4: proposal também oferece blocos de dado — publicação é `inline-only`, não `none`.
        blocks:
          profile === 'proposal'
            ? [...contentBlocks, ...dataBlocks]
            : [...dataBlocks, ...contentBlocks],
        pages: [{ pageKey: '/dashboard', description: '' }],
        spans: [1, 2, 3, 4],
        classNames:
          profile === 'proposal'
            ? ['text-center', 'font-bold', 'max-w-prose']
            : ['text-center', 'font-bold'],
      });
    });
    mockGetByKey.execute.mockResolvedValue({
      id: 'def-1',
      labelKey: PAGE_LAYOUTS_KEY,
      value: {},
    });
    mockSet.execute.mockResolvedValue({});
  });

  it('grava o layout serializado como JSON string', async () => {
    await useCase.execute('u1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: layout('users.list'),
    });

    expect(mockSet.execute).toHaveBeenCalledWith('u1', {
      definitionId: 'def-1',
      value: JSON.stringify({ '/dashboard': layout('users.list') }),
    });
  });

  it('preserva o layout das outras páginas ao gravar uma', async () => {
    const existing = layout('users.list');
    mockGetByKey.execute.mockResolvedValue({
      id: 'def-1',
      labelKey: PAGE_LAYOUTS_KEY,
      value: { '/outra': existing },
    });

    await useCase.execute('u1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: layout('users.list'),
    });

    const written = JSON.parse(
      mockSet.execute.mock.calls[0][1].value as string,
    ) as Record<string, PageLayout>;
    expect(Object.keys(written).sort()).toEqual(['/dashboard', '/outra']);
    expect(written['/outra']).toEqual(existing);
  });

  it('recusa fonte que o role do usuário não alcança', async () => {
    mockSources.listForRole.mockReturnValue([]);

    await expect(
      useCase.execute('u1', 'USER', {
        pageKey: '/dashboard',
        layout: layout('users.list'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockSet.execute).not.toHaveBeenCalled();
  });

  // Estes quatro cobrem o caso real que passou batido: o agente gravou um table.basic sem
  // data.source e a página renderizou uma tabela de colunas vazias.
  it('recusa bloco que consome dado mas veio sem fonte', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout(),
      }),
    ).rejects.toThrow(/precisa de data.source/);
    expect(mockSet.execute).not.toHaveBeenCalled();
  });

  it('recusa type de bloco que não existe no catálogo', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout('users.list', 'nao.existe'),
      }),
    ).rejects.toThrow(/não existe/);
  });

  it('recusa fonte de kind incompatível com o bloco', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout('users.list', 'chart.area'),
      }),
    ).rejects.toThrow(/aceita series/);
  });

  it('recusa param com tipo errado — o caso "page: 3-7"', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout('users.list', 'stat.card', { page: '3-7' }),
      }),
    ).rejects.toThrow(/param "page" espera number/);
    expect(mockSet.execute).not.toHaveBeenCalled();
  });

  it('aceita número vindo como string numérica', async () => {
    await useCase.execute('u1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: layout('users.list', 'stat.card', { page: '3' }),
    });

    expect(mockSet.execute).toHaveBeenCalled();
  });

  it('aceita param string', async () => {
    await useCase.execute('u1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: layout('users.list', 'stat.card', { search: 'jo' }),
    });

    expect(mockSet.execute).toHaveBeenCalled();
  });

  it('aceita param boolean como booleano ou como "true"/"false"', async () => {
    await useCase.execute('u1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: layout('users.list', 'stat.card', { active: true }),
    });

    expect(mockSet.execute).toHaveBeenCalled();
  });

  it('recusa param boolean com valor que não é booleano nem "true"/"false"', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout('users.list', 'stat.card', { active: 'talvez' }),
      }),
    ).rejects.toThrow(/param "active" espera boolean/);
    expect(mockSet.execute).not.toHaveBeenCalled();
  });

  it('recusa param que a fonte não declara', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout('users.list', 'stat.card', { range: '30d' }),
      }),
    ).rejects.toThrow(/não aceita o param "range"/);
  });

  it('recusa pageKey que nenhuma tela renderiza', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/inexistente',
        layout: layout('users.list'),
      }),
    ).rejects.toThrow(/não é customizável/);
  });

  // Aninhamento: "um card com o total à esquerda e a lista à direita".
  const group = (children: unknown[]): PageLayout =>
    ({
      v: 1,
      blocks: [{ id: 'g1', type: 'group', span: 4, props: { title: 'Usuários' }, children }],
    }) as PageLayout;

  it('aceita container com filhos que têm fonte', async () => {
    await useCase.execute('u1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: group([
        { id: 'c1', type: 'stat.card', span: 2, data: { source: 'users.list' } },
        { id: 'c2', type: 'stat.card', span: 2, data: { source: 'users.list' } },
      ]),
    });

    expect(mockSet.execute).toHaveBeenCalled();
  });

  it('recusa container sem children', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', { pageKey: '/dashboard', layout: group([]) }),
    ).rejects.toThrow(/precisa de pelo menos um item/);
  });

  it('recusa container dentro de container — aninhamento é de um nível', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: group([{ id: 'c1', type: 'group' }]),
      }),
    ).rejects.toThrow(/não pode ficar dentro de outro/);
  });

  it('valida o filho como qualquer outro bloco', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: group([{ id: 'c1', type: 'stat.card', span: 2 }]),
      }),
    ).rejects.toThrow(/precisa de data.source/);
  });

  it('recusa fonte fora do alcance do role também dentro de um container', async () => {
    mockSources.listForRole.mockReturnValue([]);

    await expect(
      useCase.execute('u1', 'USER', {
        pageKey: '/dashboard',
        layout: group([
          { id: 'c1', type: 'stat.card', span: 2, data: { source: 'users.list' } },
        ]),
      }),
    ).rejects.toThrow(/indisponível/);
  });

  it('recusa children em bloco que não é container', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: {
          v: 1,
          blocks: [
            {
              id: 'b1',
              type: 'stat.card',
              data: { source: 'users.list' },
              children: [{ id: 'c1', type: 'stat.card' }],
            },
          ],
        } as PageLayout,
      }),
    ).rejects.toThrow(/não aceita "children"/);
  });

  // className só tem efeito se a classe existir no CSS gerado pelo Tailwind, o que só vale
  // para a allowlist que o frontend publica na ponte. Aceitar qualquer classe gravaria um
  // layout "válido" que não muda nada na tela.
  it('aceita className da lista publicada pelo frontend', async () => {
    await useCase.execute('u1', 'ADMIN', {
      pageKey: '/dashboard',
      layout: {
        v: 1,
        blocks: [
          {
            id: 'b1',
            type: 'stat.card',
            className: 'text-center font-bold',
            data: { source: 'users.list' },
          },
        ],
      } as PageLayout,
    });

    expect(mockSet.execute).toHaveBeenCalled();
  });

  it('recusa className fora da lista', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: {
          v: 1,
          blocks: [
            {
              id: 'b1',
              type: 'stat.card',
              className: 'text-center bg-red-500',
              data: { source: 'users.list' },
            },
          ],
        } as PageLayout,
      }),
    ).rejects.toThrow(/bg-red-500/);
    expect(mockSet.execute).not.toHaveBeenCalled();
  });

  it('valida className também nos filhos de um container', async () => {
    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: group([
          {
            id: 'c1',
            type: 'stat.card',
            span: 2,
            className: 'rotate-45',
            data: { source: 'users.list' },
          },
        ]),
      }),
    ).rejects.toThrow(/rotate-45/);
  });

  it('falha quando a definition PAGE_LAYOUTS não foi semeada', async () => {
    mockGetByKey.execute.mockResolvedValue(null);

    await expect(
      useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout('users.list'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // O profile é a base de segurança da F1: a página pública renderiza sem sessão, então
  // nenhum bloco dela pode chamar endpoint.
  describe('profile', () => {
    const textBlock = (
      extra: Record<string, unknown> = {},
    ): PageLayout =>
      ({
        v: 1,
        blocks: [{ id: 'b1', type: 'text.rich', span: 12, ...extra }],
      }) as PageLayout;

    // A4: `proposal` passou de dataSources `'none'` para `'inline-only'` — ganhou os 5 blocos de
    // dado (table/chart/feed), mas só com `data.inline` (payload colado); `data.source` continua
    // fora de alcance, exatamente como `'none'` recusava, só que agora com outra mensagem.
    it('inline-only recusa bloco com data.source', async () => {
      await expect(
        useCase.execute('u1', 'ADMIN', {
          pageKey: '/dashboard',
          profile: 'proposal',
          layout: textBlock({ data: { source: 'users.list' } }),
        }),
      ).rejects.toThrow(/não busca fonte de dado interna.*b1/s);
      expect(mockSet.execute).not.toHaveBeenCalled();
    });

    it('inline-only recusa data.source também dentro de children', async () => {
      await expect(
        useCase.execute('u1', 'ADMIN', {
          pageKey: '/dashboard',
          profile: 'proposal',
          layout: {
            v: 1,
            blocks: [
              {
                id: 'g1',
                type: 'group',
                span: 12,
                children: [
                  { id: 'c1', type: 'text.rich', span: 6 },
                  { id: 'c2', type: 'text.rich', span: 6, data: { source: 'users.list' } },
                ],
              },
            ],
          } as PageLayout,
        }),
      ).rejects.toThrow(/não busca fonte de dado interna.*c2/s);
      expect(mockSet.execute).not.toHaveBeenCalled();
    });

    it('inline-only aceita bloco de conteúdo puro, sem conferir role', async () => {
      mockSources.listForRole.mockReturnValue([]);

      await useCase.execute('u1', 'USER', {
        pageKey: '/dashboard',
        profile: 'proposal',
        layout: textBlock({ props: { content: 'Olá' } }),
      });

      expect(mockSet.execute).toHaveBeenCalled();
      expect(mockSources.listForRole).not.toHaveBeenCalled();
    });

    it('inline-only aceita data.inline com shape list certo', async () => {
      await useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        profile: 'proposal',
        layout: {
          v: 1,
          blocks: [
            {
              id: 'b1',
              type: 'stat.card',
              span: 2,
              data: { inline: { data: [{ nome: 'Ada' }] } },
            },
          ],
        } as PageLayout,
      });

      expect(mockSet.execute).toHaveBeenCalled();
    });

    it('inline-only aceita data.inline com shape series certo', async () => {
      await useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        profile: 'proposal',
        layout: {
          v: 1,
          blocks: [
            {
              id: 'b1',
              type: 'chart.area',
              span: 2,
              data: { inline: { data: [{ date: '2024-01', value: 10 }] } },
            },
          ],
        } as PageLayout,
      });

      expect(mockSet.execute).toHaveBeenCalled();
    });

    it('inline-only recusa shape errado — series recebendo array de objeto', async () => {
      await expect(
        useCase.execute('u1', 'ADMIN', {
          pageKey: '/dashboard',
          profile: 'proposal',
          layout: {
            v: 1,
            blocks: [
              {
                id: 'b1',
                type: 'chart.area',
                span: 2,
                data: { inline: { data: [{ nome: 'Ada' }] } },
              },
            ],
          } as PageLayout,
        }),
      ).rejects.toThrow(/data\.inline espera/);
      expect(mockSet.execute).not.toHaveBeenCalled();
    });

    it('inline-only recusa data.inline acima do teto de tamanho', async () => {
      const oversized = { data: [{ big: 'x'.repeat(70_000) }] };

      await expect(
        useCase.execute('u1', 'ADMIN', {
          pageKey: '/dashboard',
          profile: 'proposal',
          layout: {
            v: 1,
            blocks: [{ id: 'b1', type: 'stat.card', span: 2, data: { inline: oversized } }],
          } as PageLayout,
        }),
      ).rejects.toThrow(/acima do teto/);
      expect(mockSet.execute).not.toHaveBeenCalled();
    });

    it('inline-only recusa bloco que não existe no catálogo dele', async () => {
      await expect(
        useCase.execute('u1', 'ADMIN', {
          pageKey: '/dashboard',
          profile: 'proposal',
          layout: {
            v: 1,
            blocks: [
              { id: 'b1', type: 'nao.existe', span: 2, data: { inline: { data: [] } } },
            ],
          } as PageLayout,
        }),
      ).rejects.toThrow(/não existe/);
    });

    // O espelho de role-filtered: dado colado num dashboard seria um número inventado
    // parecendo métrica real — recusa também no topo e em children.
    it('role-filtered (dashboard) recusa data.inline', async () => {
      await expect(
        useCase.execute('u1', 'ADMIN', {
          pageKey: '/dashboard',
          layout: {
            v: 1,
            blocks: [
              {
                id: 'b1',
                type: 'stat.card',
                span: 2,
                data: { inline: { data: [{ nome: 'Ada' }] } },
              },
            ],
          } as PageLayout,
        }),
      ).rejects.toThrow(/não aceita dado colado.*b1/s);
      expect(mockSet.execute).not.toHaveBeenCalled();
    });

    it('storage record não exige pageKey do catálogo', async () => {
      await useCase.execute('u1', 'ADMIN', {
        pageKey: '/proposal/rascunho',
        profile: 'proposal',
        layout: textBlock({ props: { content: 'Olá' } }),
      });

      expect(mockSet.execute).toHaveBeenCalled();
    });

    it('storage config continua exigindo pageKey do catálogo', async () => {
      await expect(
        useCase.execute('u1', 'ADMIN', {
          pageKey: '/inexistente',
          profile: 'dashboard',
          layout: layout('users.list'),
        }),
      ).rejects.toThrow(/não é customizável/);
    });

    it('profile ausente vale dashboard: consulta a ponte com o catálogo do dashboard', async () => {
      await useCase.execute('u1', 'ADMIN', {
        pageKey: '/dashboard',
        layout: layout('users.list'),
      });

      expect(mockBridge.describeSchema).toHaveBeenCalledWith('dashboard');
    });

    it('dashboard recusa className que só o profile editorial aceita', async () => {
      await expect(
        useCase.execute('u1', 'ADMIN', {
          pageKey: '/dashboard',
          layout: {
            v: 1,
            blocks: [
              {
                id: 'b1',
                type: 'stat.card',
                className: 'max-w-prose',
                data: { source: 'users.list' },
              },
            ],
          } as PageLayout,
        }),
      ).rejects.toThrow(/max-w-prose/);
    });

    it('recusa layout acima do teto de blocos do profile', async () => {
      const blocks = Array.from({ length: 21 }, (_, i) => ({
        id: `b${i}`,
        type: 'stat.card',
        data: { source: 'users.list' },
      }));

      await expect(
        useCase.execute('u1', 'ADMIN', {
          pageKey: '/dashboard',
          layout: { v: 1, blocks } as PageLayout,
        }),
      ).rejects.toThrow(/excede o teto de 20/);
      expect(mockSet.execute).not.toHaveBeenCalled();
    });

    it('o mesmo layout passa no profile de teto maior', async () => {
      const blocks = Array.from({ length: 21 }, (_, i) => ({
        id: `b${i}`,
        type: 'text.rich',
        props: { content: 'x' },
      }));

      await useCase.execute('u1', 'ADMIN', {
        pageKey: '/proposal/rascunho',
        profile: 'proposal',
        layout: { v: 1, blocks } as PageLayout,
      });

      expect(mockSet.execute).toHaveBeenCalled();
    });
  });
});