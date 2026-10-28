import { McpService } from './mcp.service';
import { JSONRPC_ERROR, MCP_LATEST_PROTOCOL_VERSION } from 'src/domain/mcp/mcp.const';

const mockRegistry = {
  getToolDefinitions: vi.fn(),
  dispatch: vi.fn(),
};
const mockLogging = { create: vi.fn() };

const caller = { userId: 'u1', roleName: 'ADMIN', approvedScopes: ['feature-flags:write'] };

describe('McpService (JSON-RPC)', () => {
  let service: McpService;

  beforeEach(() => {
    service = new McpService(mockRegistry as never, mockLogging as never);
    vi.clearAllMocks();
    mockLogging.create.mockResolvedValue(undefined);
    mockRegistry.getToolDefinitions.mockResolvedValue([
      { name: 'list_users', description: 'lista', inputSchema: { type: 'object' } },
    ]);
  });

  const call = (body: unknown) => service.handle(body, caller);

  it('initialize devolve a versão pedida quando é uma que conhecemos', async () => {
    const res = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26' },
    });

    expect(res).toMatchObject({
      id: 1,
      result: { protocolVersion: '2025-03-26', capabilities: { tools: {} } },
    });
  });

  it('initialize cai na versão mais nova quando a pedida é desconhecida', async () => {
    const res = await call({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '1999-01-01' },
    });

    expect((res as { result: { protocolVersion: string } }).result.protocolVersion).toBe(
      MCP_LATEST_PROTOCOL_VERSION,
    );
  });

  it('tools/list expõe o catálogo do ToolRegistry filtrado pelo usuário', async () => {
    const res = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' });

    expect(mockRegistry.getToolDefinitions).toHaveBeenCalledWith({
      roleName: 'ADMIN',
      userId: 'u1',
    });
    expect(res).toMatchObject({ result: { tools: [{ name: 'list_users' }] } });
  });

  it('tools/call repassa os scopes aprovados como approvedScopes do dispatch', async () => {
    mockRegistry.dispatch.mockResolvedValue({ status: 'ok', result: { ok: true } });

    await call({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'toggle_feature_flag', arguments: { key: 'X' } },
    });

    expect(mockRegistry.dispatch).toHaveBeenCalledWith(
      'toggle_feature_flag',
      { key: 'X' },
      { userId: 'u1', roleName: 'ADMIN', approvedScopes: ['feature-flags:write'] },
    );
  });

  it('approval_required vira resultado isError explicando o scope, não erro JSON-RPC', async () => {
    mockRegistry.dispatch.mockResolvedValue({
      status: 'approval_required',
      scope: 'users:write',
    });

    const res = (await call({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'update_user' },
    })) as { error?: unknown; result: { isError: boolean; content: { text: string }[] } };

    // Erro de protocolo derrubaria a conexão; o modelo precisa LER o motivo.
    expect(res.error).toBeUndefined();
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toContain('users:write');
  });

  it('erro de tool não registra log de execução', async () => {
    mockRegistry.dispatch.mockResolvedValue({ status: 'error', message: 'Unknown tool: x' });

    const res = (await call({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'x' },
    })) as { result: { isError: boolean } };

    expect(res.result.isError).toBe(true);
    expect(mockLogging.create).not.toHaveBeenCalled();
  });

  it('tools/call sem name devolve isError em vez de estourar', async () => {
    const res = (await call({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {},
    })) as { result: { isError: boolean } };

    expect(res.result.isError).toBe(true);
    expect(mockRegistry.dispatch).not.toHaveBeenCalled();
  });

  it('notificação não gera resposta', async () => {
    expect(await call({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
  });

  it('notificação com método fora do namespace notifications/ não gera resposta nem erro', async () => {
    expect(await call({ jsonrpc: '2.0', method: 'weird/thing' })).toBeNull();
  });

  it('método desconhecido devolve -32601', async () => {
    const res = (await call({ jsonrpc: '2.0', id: 7, method: 'nope' })) as {
      error: { code: number };
    };
    expect(res.error.code).toBe(JSONRPC_ERROR.METHOD_NOT_FOUND);
  });

  it('corpo sem method é Invalid Request', async () => {
    const res = (await call({ jsonrpc: '2.0', id: 8 })) as { error: { code: number } };
    expect(res.error.code).toBe(JSONRPC_ERROR.INVALID_REQUEST);
  });

  it('exceção interna não escapa: vira -32603', async () => {
    mockRegistry.getToolDefinitions.mockRejectedValue(new Error('boom'));
    const res = (await call({ jsonrpc: '2.0', id: 9, method: 'tools/list' })) as {
      error: { code: number };
    };
    expect(res.error.code).toBe(JSONRPC_ERROR.INTERNAL);
  });

  it('lote responde só o que tem id, e null quando o lote é todo de notificações', async () => {
    const res = (await call([
      { jsonrpc: '2.0', id: 10, method: 'ping' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
    ])) as unknown[];

    expect(res).toHaveLength(1);
    expect(await call([{ jsonrpc: '2.0', method: 'notifications/initialized' }])).toBeNull();
  });

  it('resources/prompts respondem vazio — clientes sondam mesmo sem a capability', async () => {
    expect(await call({ jsonrpc: '2.0', id: 11, method: 'resources/list' })).toMatchObject({
      result: { resources: [] },
    });
    expect(await call({ jsonrpc: '2.0', id: 12, method: 'prompts/list' })).toMatchObject({
      result: { prompts: [] },
    });
    expect(
      await call({ jsonrpc: '2.0', id: 13, method: 'resources/templates/list' }),
    ).toMatchObject({ result: { resourceTemplates: [] } });
  });
});
