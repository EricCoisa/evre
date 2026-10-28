import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApi = vi.hoisted(() => ({
  mcpConnectionsControllerList: vi.fn(),
  mcpConnectionsControllerRevoke: vi.fn(),
}));

vi.mock('@/lib/generated/mcp/mcp', () => ({
  getMcp: () => mockApi,
}));

const mockGet = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
vi.mock('../../api/api', () => ({
  GET: mockGet,
  POST: mockPost,
}));

import { listMcpConnections, revokeMcpConnection, getAuthorizationRequest, approveAuthorization } from './api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listMcpConnections', () => {
  it('lista as conexões MCP do usuário', async () => {
    mockApi.mcpConnectionsControllerList.mockResolvedValue([{ id: 'c1', clientName: 'Claude' }]);

    const result = await listMcpConnections();

    expect(mockApi.mcpConnectionsControllerList).toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, data: [{ id: 'c1', clientName: 'Claude' }] });
  });
});

describe('revokeMcpConnection', () => {
  it('revoga uma conexão por id', async () => {
    mockApi.mcpConnectionsControllerRevoke.mockResolvedValue(undefined);

    const result = await revokeMcpConnection('c1');

    expect(mockApi.mcpConnectionsControllerRevoke).toHaveBeenCalledWith('c1');
    expect(result.success).toBe(true);
  });
});

describe('getAuthorizationRequest', () => {
  it('busca o pedido de autorização OAuth, encodando o req na query', async () => {
    mockGet.mockResolvedValue({ success: true, data: { clientId: 'x' }, message: '', status: 200 });

    const result = await getAuthorizationRequest('req token/with+chars');

    expect(mockGet).toHaveBeenCalledWith('/oauth/authorize/request?req=req%20token%2Fwith%2Bchars');
    expect(result.data).toEqual({ clientId: 'x' });
  });
});

describe('approveAuthorization', () => {
  it('aprova a autorização com os scopes escolhidos', async () => {
    mockPost.mockResolvedValue({ success: true, data: { redirectTo: '/done' }, message: '', status: 200 });

    const result = await approveAuthorization('req1', ['read' as never]);

    expect(mockPost).toHaveBeenCalledWith('/oauth/authorize/consent', { req: 'req1', scopes: ['read'] });
    expect(result.data).toEqual({ redirectTo: '/done' });
  });
});
