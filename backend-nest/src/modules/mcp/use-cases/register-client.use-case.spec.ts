import { RegisterClientUseCase } from './register-client.use-case';
import { OAuthError } from '../oauth-error';

const mockPrisma = { oAuthClient: { create: vi.fn() } };
const mockLogging = { create: vi.fn() };

describe('RegisterClientUseCase (DCR / RFC 7591)', () => {
  let useCase: RegisterClientUseCase;

  beforeEach(() => {
    useCase = new RegisterClientUseCase(mockPrisma as never, mockLogging as never);
    vi.clearAllMocks();
    mockLogging.create.mockResolvedValue(undefined);
    mockPrisma.oAuthClient.create.mockImplementation(({ data }: never) => ({
      id: 'c1',
      createdAt: new Date('2026-09-24T00:00:00.000Z'),
      ...(data as object),
    }));
  });

  const register = (body: Record<string, unknown>) => useCase.execute(body);

  it('registra cliente público sem secret — PKCE é a credencial', async () => {
    const res = await register({
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    });

    expect(res.token_endpoint_auth_method).toBe('none');
    expect(res).not.toHaveProperty('client_secret');
    expect(res.client_id).toBe('c1');
  });

  it('aceita http:// em loopback (Claude Code sobe listener local)', async () => {
    await expect(
      register({ redirect_uris: ['http://localhost:51763/callback'] }),
    ).resolves.toBeTruthy();
    await expect(
      register({ redirect_uris: ['http://127.0.0.1:51763/callback'] }),
    ).resolves.toBeTruthy();
  });

  it('aceita scheme customizado de app nativo', async () => {
    await expect(
      register({ redirect_uris: ['cursor://anysphere.cursor/oauth/callback'] }),
    ).resolves.toBeTruthy();
  });

  it('recusa http:// fora de loopback — code em texto claro na rede', async () => {
    await expect(register({ redirect_uris: ['http://evil.com/cb'] })).rejects.toThrow(
      OAuthError,
    );
  });

  it('recusa redirect_uri com fragmento (RFC 6749 §3.1.2)', async () => {
    await expect(
      register({ redirect_uris: ['https://app.com/cb#x'] }),
    ).rejects.toThrow(OAuthError);
  });

  it('recusa redirect_uri relativa ou não-string', async () => {
    await expect(register({ redirect_uris: ['/cb'] })).rejects.toThrow(OAuthError);
    await expect(register({ redirect_uris: [42] })).rejects.toThrow(OAuthError);
  });

  it('recusa registro sem redirect_uris', async () => {
    await expect(register({})).rejects.toThrow(OAuthError);
    await expect(register({ redirect_uris: [] })).rejects.toThrow(OAuthError);
  });

  it('client_name ausente ganha padrão e nome gigante é truncado', async () => {
    const anon = await register({ redirect_uris: ['https://a.com/cb'] });
    expect(anon.client_name).toBe('Cliente MCP');

    const long = await register({
      client_name: 'x'.repeat(500),
      redirect_uris: ['https://a.com/cb'],
    });
    expect(long.client_name).toHaveLength(100);
  });

  it('loga o registro sem usuário — DCR é anônimo', async () => {
    await register({ redirect_uris: ['https://a.com/cb'] });
    expect(mockLogging.create).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'MCP' }),
      null,
    );
  });
});
