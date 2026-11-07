import { DescribePageBuilderTool } from './describe-page-builder.tool';
import { PageSourceRegistry } from '../page-source-registry.service';
import { PageBuilderBridgeService } from '../page-builder-bridge.service';
import type { AiToolContext } from 'src/domain/ai/ai-tool.types';

describe('DescribePageBuilderTool', () => {
  let tool: DescribePageBuilderTool;
  let mockPageSources: { listForRole: ReturnType<typeof vi.fn> };
  let mockBridge: { describeSchema: ReturnType<typeof vi.fn> };

  const fakeContext: AiToolContext = {
    userId: 'user-123',
    roleName: 'USER',
    approvedScopes: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPageSources = {
      listForRole: vi.fn().mockReturnValue([
        {
          key: 'logs.list',
          kind: 'list',
          description: 'Logs do sistema',
          fields: ['module', 'action', 'message'],
          params: [{ name: 'limit', type: 'number', description: 'Itens por página' }],
        },
      ]),
    };

    mockBridge = {
      describeSchema: vi.fn().mockResolvedValue({
        blocks: [
          {
            type: 'table.basic',
            description: 'Tabela simples',
            accepts: ['list'],
            container: false,
            props: [{ name: 'columns', type: 'string[]', required: true }],
          },
        ],
        pages: [{ pageKey: '/dashboard', description: 'Dashboard principal' }],
        spans: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        classNames: ['p-4', 'text-center'],
      }),
    };

    tool = new DescribePageBuilderTool(
      mockPageSources as unknown as PageSourceRegistry,
      mockBridge as unknown as PageBuilderBridgeService,
    );
  });

  it('possui a definição correta da tool', () => {
    expect(tool.definition.name).toBe('describe_page_builder');
    expect(tool.definition.invalidates).toEqual([]);
    expect(tool.definition.inputSchema).toBeDefined();
  });

  it('executa com profile padrão (dashboard) filtrando fontes pelo role', async () => {
    const result = await tool.execute({}, fakeContext);

    expect(mockBridge.describeSchema).toHaveBeenCalledWith('dashboard');
    expect(mockPageSources.listForRole).toHaveBeenCalledWith('USER');

    expect(result).toMatchObject({
      profile: 'dashboard',
      dataSources: 'role-filtered',
      maxBlocks: 20,
      maxChildren: 12,
      inlineShapes: undefined,
    });

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe('table.basic');
    expect(result.pages).toEqual([
      { pageKey: '/dashboard', description: 'Dashboard principal' },
    ]);
    expect(result.sources).toEqual([
      {
        key: 'logs.list',
        kind: 'list',
        description: 'Logs do sistema',
        fields: ['module', 'action', 'message'],
        params: [{ name: 'limit', type: 'number', description: 'Itens por página' }],
      },
    ]);
  });

  it('executa com profile proposal (inline-only) ocultando fontes e expondo inlineShapes', async () => {
    const result = await tool.execute({ profile: 'proposal' }, fakeContext);

    expect(mockBridge.describeSchema).toHaveBeenCalledWith('proposal');
    expect(mockPageSources.listForRole).not.toHaveBeenCalled();

    expect(result).toMatchObject({
      profile: 'proposal',
      dataSources: 'inline-only',
      maxBlocks: 80,
      maxChildren: 12,
      sources: [],
    });

    expect(result.inlineShapes).toBeDefined();
    expect(result.inlineShapes?.list).toContain('{ data: Record<string, unknown>[]');
    expect(result.inlineShapes?.series).toBe('{ data: { date: string, value: number }[] }');
  });
});

