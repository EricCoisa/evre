import { ExchangeTokenUseCase } from './exchange-token.use-case';
import { McpTokenService } from '../mcp-token.service';
import { OAuthError } from '../oauth-error';

const mockPrisma = {
  oAuthGrant: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

const VERIFIER = 'a'.repeat(64);

describe('ExchangeTokenUseCase', () => {
  let useCase: ExchangeTokenUseCase;
  const tokens = new McpTokenService(mockPrisma as never);

  const grant = (over: Record<string, unknown> = {}) => ({
    id: 'g1',
    clientId: 'c1',
    scopes: ['users:read'],
    codeHash: tokens.hash('mcpac_code'),
    codeChallenge: tokens.s256(VERIFIER),
    redirectUri: 'https://claude.ai/cb',
    codeExpiresAt: new Date(Date.now() + 60_000),
    refreshHash: null,
    refreshExpiresAt: null,
    revokedAt: null,
    ...over,
  });

  beforeEach(() => {
    useCase = new ExchangeTokenUseCase(mockPrisma as never, tokens);
    vi.clearAllMocks();
    mockPrisma.oAuthGrant.update.mockResolvedValue({});
    mockPrisma.oAuthGrant.updateMany.mockResolvedValue({ count: 1 });
  });

  it('recusa grant_type desconhecido ou ausente', async () => {
    await expect(useCase.execute({ grant_type: 'password' })).rejects.toThrow(OAuthError);
    await expect(useCase.execute({})).rejects.toThrow(OAuthError);
  });

  describe('authorization_code', () => {
    const exchange = (over: Record<string, unknown> = {}) =>
      useCase.execute({
        grant_type: 'authorization_code',
        code: 'mcpac_code',
        code_verifier: VERIFIER,
        client_id: 'c1',
        redirect_uri: 'https://claude.ai/cb',
        ...over,
      });

    it('troca code por par de tokens e zera o code na mesma escrita', async () => {
      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(grant());

      const res = await exchange();

      expect(res.token_type).toBe('Bearer');
      expect(res.access_token).toMatch(/^mcpat_/);
      expect(res.refresh_token).toMatch(/^mcprt_/);
      expect(res.scope).toBe('users:read');

      const data = mockPrisma.oAuthGrant.update.mock.calls[0][0].data;
      // Single-use: sem zerar o code aqui, um code vazado seria resgatável de novo.
      expect(data.codeHash).toBeNull();
      expect(data.codeChallenge).toBeNull();
      // Só hashes vão para o banco.
      expect(data.accessHash).toBe(tokens.hash(res.access_token));
      expect(data.refreshHash).toBe(tokens.hash(res.refresh_token));
      expect(JSON.stringify(data)).not.toContain(res.access_token);
      expect(JSON.stringify(data)).not.toContain(res.refresh_token);
    });

    it('code inexistente (ou já resgatado, que zera o hash) é invalid_grant', async () => {
      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(null);
      await expect(exchange()).rejects.toThrow(OAuthError);
    });

    it('code de conexão revogada é recusado', async () => {
      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(
        grant({ revokedAt: new Date() }),
      );
      await expect(exchange()).rejects.toThrow(OAuthError);
    });

    it('code expirado é recusado', async () => {
      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(
        grant({ codeExpiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(exchange()).rejects.toThrow(OAuthError);

      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(grant({ codeExpiresAt: null }));
      await expect(exchange()).rejects.toThrow(OAuthError);
    });

    it('code_verifier errado é recusado (PKCE)', async () => {
      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(grant());
      await expect(exchange({ code_verifier: 'b'.repeat(64) })).rejects.toThrow(
        OAuthError,
      );
      expect(mockPrisma.oAuthGrant.update).not.toHaveBeenCalled();
    });

    it('grant sem challenge gravado não vira token', async () => {
      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(grant({ codeChallenge: null }));
      await expect(exchange()).rejects.toThrow(OAuthError);
    });

    it('code de outro client_id ou outra redirect_uri é recusado', async () => {
      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(grant());
      await expect(exchange({ client_id: 'c2' })).rejects.toThrow(OAuthError);

      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(grant());
      await expect(exchange({ redirect_uri: 'https://evil.com/cb' })).rejects.toThrow(
        OAuthError,
      );
    });

    it('exige code e code_verifier', async () => {
      await expect(exchange({ code: undefined })).rejects.toThrow(OAuthError);
      await expect(exchange({ code_verifier: undefined })).rejects.toThrow(OAuthError);
    });
  });

  describe('refresh_token', () => {
    const refresh = (over: Record<string, unknown> = {}) =>
      useCase.execute({
        grant_type: 'refresh_token',
        refresh_token: 'mcprt_old',
        client_id: 'c1',
        ...over,
      });

    const live = (over: Record<string, unknown> = {}) =>
      grant({
        codeHash: null,
        codeChallenge: null,
        codeExpiresAt: null,
        refreshHash: tokens.hash('mcprt_old'),
        refreshExpiresAt: new Date(Date.now() + 60_000),
        ...over,
      });

    it('rotaciona os dois tokens', async () => {
      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(live());

      const res = await refresh();
      const data = mockPrisma.oAuthGrant.update.mock.calls[0][0].data;

      expect(res.refresh_token).not.toBe('mcprt_old');
      expect(data.refreshHash).toBe(tokens.hash(res.refresh_token));
      expect(data.accessHash).toBe(tokens.hash(res.access_token));
    });

    it('refresh inválido, expirado, revogado ou de outro cliente é recusado', async () => {
      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(null);
      await expect(refresh()).rejects.toThrow(OAuthError);

      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(
        live({ refreshExpiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(refresh()).rejects.toThrow(OAuthError);

      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(live({ refreshExpiresAt: null }));
      await expect(refresh()).rejects.toThrow(OAuthError);

      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(live({ revokedAt: new Date() }));
      await expect(refresh()).rejects.toThrow(OAuthError);

      mockPrisma.oAuthGrant.findUnique.mockResolvedValue(live());
      await expect(refresh({ client_id: 'c2' })).rejects.toThrow(OAuthError);
    });

    it('exige refresh_token', async () => {
      await expect(refresh({ refresh_token: undefined })).rejects.toThrow(OAuthError);
    });
  });

  describe('revoke (RFC 7009)', () => {
    it('revoga por access OU refresh e apaga os dois hashes', async () => {
      await useCase.revoke('mcpat_abc');

      const args = mockPrisma.oAuthGrant.updateMany.mock.calls[0][0];
      expect(args.where.OR).toEqual([
        { accessHash: tokens.hash('mcpat_abc') },
        { refreshHash: tokens.hash('mcpat_abc') },
      ]);
      expect(args.data).toMatchObject({ accessHash: null, refreshHash: null });
    });

    it('token ausente é no-op silencioso — o RFC manda responder 200 de todo jeito', async () => {
      await useCase.revoke(undefined);
      expect(mockPrisma.oAuthGrant.updateMany).not.toHaveBeenCalled();
    });
  });
});
